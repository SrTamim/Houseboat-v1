import { HouseboatsService } from './houseboats.service';

/**
 * Per-cabin availability must answer "is this cabin held by YOU?", not merely
 * "is this cabin held?".
 *
 * The snapshot is the boat page's seed state. When it reported the viewer's own
 * hold as `booked` the page had no way to tell it apart from a stranger's, which
 * produced three user-visible bugs: the guest's own cabin read "Fully booked"
 * after a reload, flashed booked while their hold request was still in flight,
 * and stayed booked for up to a minute after expiry while the once-a-minute
 * sweeper caught up.
 *
 * `booked` must keep its exact meaning for everyone else's holds — that is the
 * behaviour the whole double-booking guard depends on.
 */

const DEP = 'dep-1';
const CAB = 'cab-1';
const MIN = 60_000;

type Hold = {
  id: string;
  cabinId: string;
  heldBy: string | null;
  heldByToken: string | null;
  expiresAt: Date;
};

function makeService(
  holds: Hold[],
  bookingCabins: Array<{ cabinId: string; occupancy: number; isOpenSeat: boolean }> = [],
) {
  // The boat has whatever cabins the test mentions, plus the default one, so a
  // case can cover a held cabin and a sold cabin at the same time.
  const cabinIds = [
    ...new Set([
      CAB,
      ...holds.map((h) => h.cabinId),
      ...bookingCabins.map((b) => b.cabinId),
    ]),
  ];
  const prisma = {
    tripDeparture: {
      findFirst: jest.fn().mockResolvedValue({
        id: DEP,
        availableCount: 3,
        package: {
          houseboatId: 'boat-1',
          houseboat: {
            decks: [
              {
                cabins: cabinIds.map((id) => ({
                  id,
                  category: { baseCapacity: 2, extendedCapacity: null },
                })),
              },
            ],
          },
        },
      }),
    },
    bookingCabin: { findMany: jest.fn().mockResolvedValue(bookingCabins) },
    // The service filters expired rows in SQL; the double mirrors that so a
    // lapsed hold never reaches the mapping logic.
    cabinHold: {
      findMany: jest.fn(({ where }: any) =>
        Promise.resolve(
          holds.filter((h) => h.expiresAt > (where?.expiresAt?.gt ?? new Date())),
        ),
      ),
    },
  };
  return new HouseboatsService(prisma as never, {} as never, {} as never);
}

const live = (over: Partial<Hold> = {}): Hold => ({
  id: 'hold-1',
  cabinId: CAB,
  heldBy: 'acct-A',
  heldByToken: null,
  expiresAt: new Date(Date.now() + 5 * MIN),
  ...over,
});

const stateOf = (res: { cabins: Array<{ cabinId: string; state: string }> }) =>
  res.cabins.find((c) => c.cabinId === CAB)!.state;

describe('departureCabinAvailability — hold ownership', () => {
  it('reports the viewer’s own account hold as held_by_me', async () => {
    const svc = makeService([live({ heldBy: 'acct-A' })]);
    const res = await svc.departureCabinAvailability('boat', DEP, {
      accountId: 'acct-A',
      guestToken: null,
    });
    expect(stateOf(res as never)).toBe('held_by_me');
  });

  it('returns the viewer’s own countdown so a reload can resume it', async () => {
    const expiresAt = new Date(Date.now() + 7 * MIN);
    const svc = makeService([live({ heldBy: 'acct-A', expiresAt })]);
    const res = (await svc.departureCabinAvailability('boat', DEP, {
      accountId: 'acct-A',
      guestToken: null,
    })) as { cabins: Array<{ holdExpiresAt?: Date }> };
    expect(res.cabins[0].holdExpiresAt).toEqual(expiresAt);
  });

  it('gives the owner their hold id, and never leaks it to anyone else', async () => {
    const svc = makeService([live({ heldBy: 'acct-A' })]);
    const own = (await svc.departureCabinAvailability('boat', DEP, {
      accountId: 'acct-A',
      guestToken: null,
    })) as { cabins: Array<{ holdId?: string }> };
    // The owner needs it to release the cabin on deselect and convert it at
    // checkout — it is the same id their own POST /booking/hold returned.
    expect(own.cabins[0].holdId).toBe('hold-1');

    const stranger = (await svc.departureCabinAvailability('boat', DEP, {
      accountId: 'acct-B',
      guestToken: null,
    })) as { cabins: Array<{ holdId?: string }> };
    expect(stranger.cabins[0].holdId).toBeUndefined();
  });

  it('reports ANOTHER account’s hold as held_by_other, not booked', async () => {
    const svc = makeService([live({ heldBy: 'acct-B' })]);
    const res = await svc.departureCabinAvailability('boat', DEP, {
      accountId: 'acct-A',
      guestToken: null,
    });
    // Not `held_by_me` is the security property; `held_by_other` rather than
    // `booked` is the honesty one — the hold lapses in ~10 min.
    expect(stateOf(res as never)).toBe('held_by_other');
  });

  it('matches a guest hold on the hb_gid token', async () => {
    const svc = makeService([
      live({ heldBy: null, heldByToken: 'guest-1' }),
    ]);
    const res = await svc.departureCabinAvailability('boat', DEP, {
      accountId: null,
      guestToken: 'guest-1',
    });
    expect(stateOf(res as never)).toBe('held_by_me');
  });

  it('reports another browser’s guest hold as held_by_other', async () => {
    const svc = makeService([
      live({ heldBy: null, heldByToken: 'guest-OTHER' }),
    ]);
    const res = await svc.departureCabinAvailability('boat', DEP, {
      accountId: null,
      guestToken: 'guest-1',
    });
    expect(stateOf(res as never)).toBe('held_by_other');
  });

  it('never leaks a hold to an anonymous viewer (null must not match null)', async () => {
    // A guest-owned hold with a viewer that has neither identity: the null ===
    // null trap would hand a stranger someone else's cabin.
    const svc = makeService([live({ heldBy: null, heldByToken: 'guest-1' })]);
    const res = await svc.departureCabinAvailability('boat', DEP, {
      accountId: null,
      guestToken: null,
    });
    expect(stateOf(res as never)).not.toBe('held_by_me');
    expect(stateOf(res as never)).toBe('held_by_other');
  });

  it('treats a hold as someone else’s when no viewer is passed at all', async () => {
    const svc = makeService([live({ heldBy: 'acct-A' })]);
    const res = await svc.departureCabinAvailability('boat', DEP);
    expect(stateOf(res as never)).toBe('held_by_other');
  });

  it('an account viewer does not match a token-owned hold', async () => {
    const svc = makeService([live({ heldBy: null, heldByToken: 'guest-1' })]);
    const res = await svc.departureCabinAvailability('boat', DEP, {
      accountId: 'acct-A',
      guestToken: null,
    });
    expect(stateOf(res as never)).toBe('held_by_other');
  });

  it('an expired hold is neither held_by_me nor booked', async () => {
    const svc = makeService([
      live({ heldBy: 'acct-A', expiresAt: new Date(Date.now() - MIN) }),
    ]);
    const res = await svc.departureCabinAvailability('boat', DEP, {
      accountId: 'acct-A',
      guestToken: null,
    });
    expect(stateOf(res as never)).toBe('available');
  });

  it('a confirmed booking still wins over hold state', async () => {
    const svc = makeService([], [
      { cabinId: CAB, occupancy: 2, isOpenSeat: false },
    ]);
    const res = await svc.departureCabinAvailability('boat', DEP, {
      accountId: 'acct-A',
      guestToken: null,
    });
    expect(stateOf(res as never)).toBe('booked');
  });

  it('a SOLD cabin and a HELD cabin do not collapse into one state', async () => {
    // The regression that started this: a temporary hold and a permanent sale
    // both rendered as "Fully booked". They must stay distinguishable.
    const svc = makeService(
      [live({ cabinId: 'cab-held', heldBy: 'acct-B' })],
      [{ cabinId: 'cab-sold', occupancy: 2, isOpenSeat: false }],
    );
    const res = (await svc.departureCabinAvailability('boat', DEP, {
      accountId: 'acct-A',
      guestToken: null,
    })) as { cabins: Array<{ cabinId: string; state: string }> };
    const byId = new Map(res.cabins.map((c) => [c.cabinId, c.state]));
    expect(byId.get('cab-held')).toBe('held_by_other');
    expect(byId.get('cab-sold')).toBe('booked');
  });
});
