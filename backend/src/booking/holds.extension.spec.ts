import { ConflictException } from '@nestjs/common';
import { HoldsService, HOLD_CHECKOUT_EXTENSION_MIN } from './holds.service';

/**
 * The checkout hold extension.
 *
 * A cabin is held for 10 minutes, and some of that is spent picking cabins, so
 * reaching checkout grants ONE extension of +10 minutes on the time REMAINING.
 * Three properties have to hold, and none of them are observable from the
 * client:
 *
 *  1. Additive, not absolute — a hold with 8 minutes left goes to 18, never
 *     back down to a flat 10.
 *  2. Once only, enforced server-side via extended_at, so reloading checkout
 *     cannot renew a hold indefinitely.
 *  3. Cart-scoped — hold() keeps every hold of one owner on one departure on a
 *     single shared expiry, so extending one row would desync the countdown.
 *
 * Plus the interaction between the two: taking a NEW hold after an extension
 * must not sweep the extended cart back to a fresh 10 minutes, because
 * extended_at is already spent and the guest could never win that time back.
 */

/** Minimal prisma double: one cabin_hold table, transactions run inline. */
function makePrisma(rows: Array<Record<string, unknown>>) {
  const state = { rows };
  const matches = (row: Record<string, unknown>, where: Record<string, any>) => {
    for (const [k, v] of Object.entries(where)) {
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        const cur = row[k] as Date;
        if ('gt' in v && !(cur > v.gt)) return false;
        if ('lt' in v && !(cur < v.lt)) return false;
      } else if (row[k] !== v) {
        return false;
      }
    }
    return true;
  };
  const cabinHold = {
    findMany: jest.fn(({ where }: any) =>
      Promise.resolve(state.rows.filter((r) => matches(r, where))),
    ),
    aggregate: jest.fn(({ where }: any) => {
      const hit = state.rows.filter((r) => matches(r, where));
      const max = hit.reduce<Date | null>(
        (m, r) => (m == null || (r.expiresAt as Date) > m ? (r.expiresAt as Date) : m),
        null,
      );
      return Promise.resolve({ _max: { expiresAt: max } });
    }),
    updateMany: jest.fn(({ where, data }: any) => {
      let count = 0;
      state.rows.forEach((r) => {
        if (matches(r, where)) {
          Object.assign(r, data);
          count++;
        }
      });
      return Promise.resolve({ count });
    }),
    count: jest.fn(({ where }: any) =>
      Promise.resolve(state.rows.filter((r) => matches(r, where)).length),
    ),
    create: jest.fn(({ data }: any) => {
      state.rows.push({ ...data });
      return Promise.resolve({ ...data });
    }),
  };
  const prisma = {
    cabinHold,
    tripDeparture: {
      findUnique: jest.fn().mockResolvedValue({
        status: 'scheduled',
        availableCount: 5,
      }),
      update: jest.fn().mockResolvedValue({ availableCount: 4 }),
    },
    $transaction: (fn: (tx: unknown) => unknown) => fn(prisma),
  };
  return { prisma, state };
}

function makeService(rows: Array<Record<string, unknown>>) {
  const { prisma, state } = makePrisma(rows);
  const svc = new HoldsService(
    prisma as never,
    { instance: null } as never, // no Redis → rate limit skipped
    { emitCabinState: jest.fn(), emitAvailability: jest.fn() } as never,
  );
  return { svc, state, prisma };
}

const DEP = 'dep-1';
const TOKEN = 'guest-token';
const MIN = 60_000;

describe('HoldsService.extendForCheckout', () => {
  it('adds 10 minutes to the time REMAINING, not a flat reset', async () => {
    // 8 minutes left — an absolute "now + 10" would be near-neutral here, and
    // "now + 5" (the old extendForPayment) would actively SHORTEN it.
    const expiresAt = new Date(Date.now() + 8 * MIN);
    const { svc } = makeService([
      { cabinId: 'c1', departureId: DEP, heldByToken: TOKEN, state: 'held', expiresAt, extendedAt: null },
    ]);

    const res = await svc.extendForCheckout(DEP, null, TOKEN);

    expect(res.extended).toBe(true);
    expect(res.expiresAt.getTime()).toBe(
      expiresAt.getTime() + HOLD_CHECKOUT_EXTENSION_MIN * MIN,
    );
  });

  it('extends every cabin in the cart onto ONE shared expiry', async () => {
    const expiresAt = new Date(Date.now() + 9 * MIN);
    const { svc, state } = makeService([
      { cabinId: 'c1', departureId: DEP, heldByToken: TOKEN, state: 'held', expiresAt, extendedAt: null },
      { cabinId: 'c2', departureId: DEP, heldByToken: TOKEN, state: 'held', expiresAt, extendedAt: null },
      { cabinId: 'c3', departureId: DEP, heldByToken: TOKEN, state: 'held', expiresAt, extendedAt: null },
    ]);

    const res = await svc.extendForCheckout(DEP, null, TOKEN);

    const distinct = new Set(state.rows.map((r) => (r.expiresAt as Date).getTime()));
    expect(distinct.size).toBe(1);
    expect([...distinct][0]).toBe(res.expiresAt.getTime());
    state.rows.forEach((r) => expect(r.extendedAt).not.toBeNull());
  });

  it('refuses a second extension — a reload cannot stack more time', async () => {
    const expiresAt = new Date(Date.now() + 9 * MIN);
    const { svc } = makeService([
      { cabinId: 'c1', departureId: DEP, heldByToken: TOKEN, state: 'held', expiresAt, extendedAt: null },
    ]);

    const first = await svc.extendForCheckout(DEP, null, TOKEN);
    const second = await svc.extendForCheckout(DEP, null, TOKEN);
    const third = await svc.extendForCheckout(DEP, null, TOKEN);

    expect(first.extended).toBe(true);
    expect(second.extended).toBe(false);
    expect(third.extended).toBe(false);
    // Unchanged expiry: the worst case life of a hold stays 10 + 10.
    expect(second.expiresAt.getTime()).toBe(first.expiresAt.getTime());
    expect(third.expiresAt.getTime()).toBe(first.expiresAt.getTime());
  });

  it('409s when the caller has no live holds left to extend', async () => {
    const { svc } = makeService([]);
    await expect(svc.extendForCheckout(DEP, null, TOKEN)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('never touches another owner’s cart', async () => {
    const mine = new Date(Date.now() + 9 * MIN);
    const theirs = new Date(Date.now() + 9 * MIN);
    const { svc, state } = makeService([
      { cabinId: 'c1', departureId: DEP, heldByToken: TOKEN, state: 'held', expiresAt: mine, extendedAt: null },
      { cabinId: 'c2', departureId: DEP, heldByToken: 'other-guest', state: 'held', expiresAt: theirs, extendedAt: null },
    ]);

    await svc.extendForCheckout(DEP, null, TOKEN);

    const other = state.rows.find((r) => r.heldByToken === 'other-guest')!;
    expect((other.expiresAt as Date).getTime()).toBe(theirs.getTime());
    expect(other.extendedAt).toBeNull();
  });
});

describe('HoldsService.hold — cart sweep vs a granted extension', () => {
  it('does not claw back an extended cart when another cabin is added', async () => {
    // Cart already extended: 18 minutes out, well past a fresh 10.
    const extended = new Date(Date.now() + 18 * MIN);
    const { svc, state } = makeService([
      {
        cabinId: 'c1',
        departureId: DEP,
        heldByToken: TOKEN,
        state: 'held',
        expiresAt: extended,
        extendedAt: new Date(),
      },
    ]);

    const res = await svc.hold('c2', DEP, null, TOKEN);

    // The new cabin joins the extended deadline instead of dragging the whole
    // cart back to its own 10 minutes.
    expect(res.expiresAt.getTime()).toBe(extended.getTime());
    state.rows.forEach((r) =>
      expect((r.expiresAt as Date).getTime()).toBe(extended.getTime()),
    );
  });

  it('still sweeps a normal cart forward onto the newest hold', async () => {
    // Not extended: an older hold with 4 minutes left should move UP to the
    // fresh 10-minute mark, which is the long-standing shared-cart behaviour.
    const stale = new Date(Date.now() + 4 * MIN);
    const { svc, state } = makeService([
      { cabinId: 'c1', departureId: DEP, heldByToken: TOKEN, state: 'held', expiresAt: stale, extendedAt: null },
    ]);

    const res = await svc.hold('c2', DEP, null, TOKEN);

    expect(res.expiresAt.getTime()).toBeGreaterThan(stale.getTime());
    state.rows.forEach((r) =>
      expect((r.expiresAt as Date).getTime()).toBe(res.expiresAt.getTime()),
    );
  });
});
