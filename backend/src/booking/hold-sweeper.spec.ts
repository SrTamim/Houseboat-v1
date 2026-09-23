import { HoldSweeperService } from './hold-sweeper.service';
import { HOLD_GRACE_MIN } from './holds.service';

/**
 * Which holds the sweeper is allowed to reclaim.
 *
 * Two independent rules, and the interaction between them is where the risk is:
 *
 *   1. expires_at passed        → reclaim (the long-standing hard TTL).
 *   2. heartbeat went quiet     → reclaim, so a closed tab frees its cabins in
 *                                 ~2 min instead of the full 10-20 min TTL.
 *
 * Rule 2 must NEVER fire on a hold that has no heartbeat at all. The owner POS
 * takes holds through the same endpoint as customers and never heartbeats, so
 * its rows keep last_seen_at NULL — treating NULL as "stale" would cancel every
 * counter sale two minutes in, while staff were taking cash.
 */

const MIN = 60_000;
const GRACE_MS = HOLD_GRACE_MIN * MIN;

type Row = {
  id: string;
  departureId: string;
  cabinId: string;
  state: string;
  expiresAt: Date;
  lastSeenAt: Date | null;
};

/** Prisma double implementing just the operators the sweeper's where-clause uses. */
function makeSweeper(rows: Row[]) {
  const matches = (row: Row, where: any): boolean => {
    if (where.state && row.state !== where.state) return false;
    if (Array.isArray(where.OR)) {
      return where.OR.some((branch: any) => {
        if (branch.expiresAt?.lte) return row.expiresAt <= branch.expiresAt.lte;
        if (branch.lastSeenAt) {
          const c = branch.lastSeenAt;
          // `not: null` — a hold that never reported is not "stale".
          if ('not' in c && c.not === null && row.lastSeenAt === null) return false;
          if (c.lt) return row.lastSeenAt !== null && row.lastSeenAt < c.lt;
        }
        return false;
      });
    }
    return true;
  };

  const tx = {
    cabinHold: {
      // Batch release: flip every still-held row in the id set, return the count.
      updateMany: jest.fn(({ where, data }: any) => {
        const ids: string[] = where.id?.in ?? [];
        let count = 0;
        for (const r of rows) {
          if (ids.includes(r.id) && r.state === (where.state ?? r.state)) {
            Object.assign(r, data);
            count += 1;
          }
        }
        return Promise.resolve({ count });
      }),
    },
    tripDeparture: { update: jest.fn().mockResolvedValue({ availableCount: 1 }) },
  };

  const prisma = {
    cabinHold: {
      findMany: jest.fn(({ where }: any) =>
        Promise.resolve(
          rows
            .filter((r) => matches(r, where))
            .map((r) => ({ id: r.id, departureId: r.departureId, cabinId: r.cabinId })),
        ),
      ),
    },
    // Intent expiry runs first in the sweep (audit M-H2); no-op in this mock.
    bookingIntent: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    tripDeparture: {
      findUnique: jest.fn().mockResolvedValue({ availableCount: 1 }),
      update: tx.tripDeparture.update,
    },
    $transaction: (fn: (t: unknown) => unknown) => fn(tx),
  };

  const realtime = { emitCabinState: jest.fn(), emitAvailability: jest.fn() };
  const svc = new HoldSweeperService(prisma as never, realtime as never);
  return { svc, rows, realtime };
}

const row = (over: Partial<Row> = {}): Row => ({
  id: 'h-1',
  departureId: 'dep-1',
  cabinId: 'cab-1',
  state: 'held',
  // Comfortably in the future, so only the heartbeat rule can apply.
  expiresAt: new Date(Date.now() + 8 * MIN),
  lastSeenAt: new Date(),
  ...over,
});

describe('HoldSweeperService.sweep', () => {
  it('reclaims a hold whose heartbeat went quiet past the grace window', async () => {
    const { svc, rows } = makeSweeper([
      row({ lastSeenAt: new Date(Date.now() - GRACE_MS - 10_000) }),
    ]);
    await svc.sweep();
    expect(rows[0].state).toBe('released');
  });

  it('leaves a hold alone while its heartbeat is recent', async () => {
    const { svc, rows } = makeSweeper([
      row({ lastSeenAt: new Date(Date.now() - 20_000) }),
    ]);
    await svc.sweep();
    expect(rows[0].state).toBe('held');
  });

  it('NEVER reclaims a hold that has no heartbeat at all (owner POS)', async () => {
    // POS shares the customer hold endpoint and does not heartbeat. Its holds
    // must live out the full TTL — counter staff are mid-sale.
    const { svc, rows } = makeSweeper([row({ lastSeenAt: null })]);
    await svc.sweep();
    expect(rows[0].state).toBe('held');
  });

  it('still reclaims an expired hold, heartbeat or not', async () => {
    const { svc, rows } = makeSweeper([
      row({ expiresAt: new Date(Date.now() - 1_000), lastSeenAt: new Date() }),
    ]);
    await svc.sweep();
    expect(rows[0].state).toBe('released');
  });

  it('still reclaims an expired hold with no heartbeat (POS TTL path)', async () => {
    const { svc, rows } = makeSweeper([
      row({ expiresAt: new Date(Date.now() - 1_000), lastSeenAt: null }),
    ]);
    await svc.sweep();
    expect(rows[0].state).toBe('released');
  });

  it('skips a hold that is no longer held (idempotent, another worker won)', async () => {
    const { svc, rows, realtime } = makeSweeper([
      row({
        state: 'converted',
        expiresAt: new Date(Date.now() - 1_000),
      }),
    ]);
    await svc.sweep();
    expect(rows[0].state).toBe('converted');
    expect(realtime.emitCabinState).not.toHaveBeenCalled();
  });

  it('frees the cabin for everyone else watching', async () => {
    const { svc, realtime } = makeSweeper([
      row({ lastSeenAt: new Date(Date.now() - GRACE_MS - 10_000) }),
    ]);
    await svc.sweep();
    expect(realtime.emitCabinState).toHaveBeenCalledWith('dep-1', 'cab-1', 'released');
    expect(realtime.emitAvailability).toHaveBeenCalled();
  });
});
