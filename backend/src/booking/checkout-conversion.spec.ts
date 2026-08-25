import { BadRequestException } from '@nestjs/common';
import { BookingService } from './booking.service';
import { money, ZERO } from '../common/money';

/**
 * Hold conversion at checkout must refuse an EXPIRED hold.
 *
 * HoldSweeperService runs once a minute, so a lapsed hold sits in state='held'
 * for up to ~60s. During that window the row still occupies
 * uq_cabin_hold_active, which blocks a live guest from taking the cabin — so if
 * checkout also accepted it, an abandoned cart would beat the guest who was
 * correctly refused. The conversion therefore filters on expires_at as well as
 * state, and a miss rolls the whole booking back via the existing
 * `converted.count !== 1` guard.
 *
 * These tests drive the conversion loop directly rather than the whole
 * checkout(): pricing, invoices and guest rows are irrelevant to the ownership
 * and expiry checks, and stubbing priceSelection keeps the assertions on the
 * one `where` clause that matters.
 */

const DEP = 'dep-1';
const CUSTOMER = 'cust-1';
const MIN = 60_000;

type Row = {
  id: string;
  cabinId: string;
  departureId: string;
  heldBy: string | null;
  heldByToken: string | null;
  state: string;
  expiresAt: Date;
};

/**
 * Prisma double for cabin_hold covering exactly the operators the conversion
 * uses: scalar equality, `expiresAt: { gt }`, and the two-branch ownership `OR`.
 */
function makePrisma(rows: Row[]) {
  const scalarMatch = (row: Row, where: Record<string, any>): boolean => {
    for (const [k, v] of Object.entries(where)) {
      if (k === 'OR') continue;
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        if ('gt' in v && !((row as any)[k] > v.gt)) return false;
        if ('not' in v && (row as any)[k] === v.not) return false;
      } else if ((row as any)[k] !== v) {
        return false;
      }
    }
    if (Array.isArray(where.OR)) {
      return where.OR.some((branch: Record<string, any>) =>
        scalarMatch(row, branch),
      );
    }
    return true;
  };

  const tx = {
    cabinHold: {
      updateMany: jest.fn(({ where, data }: any) => {
        let count = 0;
        rows.forEach((r) => {
          if (scalarMatch(r, where)) {
            Object.assign(r, data);
            count++;
          }
        });
        return Promise.resolve({ count });
      }),
    },
    booking: { create: jest.fn().mockResolvedValue({ id: 'bk-1' }) },
    bookingCabin: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    bookingGuest: { create: jest.fn().mockResolvedValue({}) },
    invoice: {
      create: jest.fn().mockResolvedValue({ id: 'inv-1', status: 'customer_due' }),
      update: jest.fn().mockResolvedValue({}),
    },
    // policySnapshot() reads this; no policy configured is a valid state.
    cancellationPolicy: { findFirst: jest.fn().mockResolvedValue(null) },
    payment: { create: jest.fn().mockResolvedValue({}) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };

  const prisma = {
    ...tx,
    $transaction: (fn: (t: unknown) => unknown) => fn(tx),
  };
  return { prisma, tx };
}

/**
 * BookingService with priceSelection stubbed: the conversion loop consumes only
 * cabinRows (cabinId + holdId), so the pricing pipeline is noise here.
 */
function makeService(rows: Row[], cabinRows: Array<{ cabinId: string; holdId: string }>) {
  const { prisma, tx } = makePrisma(rows);
  const svc = new BookingService(
    prisma as never,
    {} as never, // pricing — unused, priceSelection is stubbed below
    { log: jest.fn().mockResolvedValue(undefined) } as never, // audit
    {} as never, // rbac
    { bookingConfirmed: jest.fn().mockResolvedValue(undefined) } as never,
    { emitAvailability: jest.fn(), emitCabinState: jest.fn() } as never,
    { get: () => 'test-key' } as never,
  );
  jest.spyOn(svc as never, 'priceSelection' as never).mockResolvedValue({
    departure: { id: DEP, startDate: new Date(), package: {} },
    houseboatId: 'boat-1',
    cabinRows: cabinRows.map((c) => ({
      ...c,
      adults: 2,
      children: 0,
      occupancy: 2,
      roomPrice: money(1000),
      isOpenSeat: false,
      priced: true,
    })),
    coupon: null,
    bill: {
      roomTotal: money(1000),
      gatewayFee: ZERO,
      priceShown: money(1000),
      discountAmount: ZERO,
      displayTotal: money(1000),
      commission: ZERO,
    },
  } as never);
  return { svc, tx, rows };
}

const liveHold = (over: Partial<Row> = {}): Row => ({
  id: 'h-1',
  cabinId: 'cab-1',
  departureId: DEP,
  heldBy: CUSTOMER,
  heldByToken: null,
  state: 'held',
  expiresAt: new Date(Date.now() + 5 * MIN),
  ...over,
});

const dto = (cabins: Array<{ cabinId: string; holdId: string }>) =>
  ({
    departureId: DEP,
    cabins: cabins.map((c) => ({ ...c, adults: 2, children: 0, childAges: [] })),
    leadGuestName: 'Test Guest',
    leadGuestPhone: '01700000000',
  }) as never;

describe('BookingService.checkout — expired holds cannot convert', () => {
  it('refuses a hold whose expires_at has passed but the sweeper has not reached', async () => {
    // The exact race: lapsed 30s ago, still state='held'.
    const rows = [liveHold({ expiresAt: new Date(Date.now() - 30_000) })];
    const { svc, rows: after } = makeService(rows, [
      { cabinId: 'cab-1', holdId: 'h-1' },
    ]);

    await expect(
      svc.checkout(CUSTOMER, CUSTOMER, dto([{ cabinId: 'cab-1', holdId: 'h-1' }])),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Nothing converted — the transaction rolls back and the sweeper is still
    // free to release the row normally.
    expect(after[0].state).toBe('held');
  });

  it('still converts a live hold', async () => {
    const rows = [liveHold()];
    const { svc, rows: after } = makeService(rows, [
      { cabinId: 'cab-1', holdId: 'h-1' },
    ]);

    await expect(
      svc.checkout(CUSTOMER, CUSTOMER, dto([{ cabinId: 'cab-1', holdId: 'h-1' }])),
    ).resolves.toBeDefined();

    expect(after[0].state).toBe('converted');
  });

  it('rolls back the whole booking when only the second cabin has lapsed', async () => {
    const rows = [
      liveHold({ id: 'h-1', cabinId: 'cab-1' }),
      liveHold({
        id: 'h-2',
        cabinId: 'cab-2',
        expiresAt: new Date(Date.now() - 1_000),
      }),
    ];
    const { svc, rows: after } = makeService(rows, [
      { cabinId: 'cab-1', holdId: 'h-1' },
      { cabinId: 'cab-2', holdId: 'h-2' },
    ]);

    await expect(
      svc.checkout(
        CUSTOMER,
        CUSTOMER,
        dto([
          { cabinId: 'cab-1', holdId: 'h-1' },
          { cabinId: 'cab-2', holdId: 'h-2' },
        ]),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    // cab-1 is flipped in-memory before the throw; the real rollback is the
    // enclosing $transaction. What matters is that the booking did not succeed
    // and cab-2 was never taken.
    expect(after[1].state).toBe('held');
  });

  it('persists channel=pos on the booking when checkout is called with the pos channel', async () => {
    const rows = [liveHold()];
    const { svc, tx } = makeService(rows, [{ cabinId: 'cab-1', holdId: 'h-1' }]);

    await svc.checkout(
      CUSTOMER,
      CUSTOMER,
      dto([{ cabinId: 'cab-1', holdId: 'h-1' }]),
      { channel: 'pos' },
    );

    expect(tx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ channel: 'pos' }),
      }),
    );
  });

  it('defaults channel to web when no channel is supplied', async () => {
    const rows = [liveHold()];
    const { svc, tx } = makeService(rows, [{ cabinId: 'cab-1', holdId: 'h-1' }]);

    await svc.checkout(CUSTOMER, CUSTOMER, dto([{ cabinId: 'cab-1', holdId: 'h-1' }]));

    expect(tx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ channel: 'web' }),
      }),
    );
  });

  it('accepts a guest-token hold that login never claimed, when still live', async () => {
    // Fallback branch: cookie cleared between holding and paying, so heldBy is
    // still null. Live holds must keep working through that path.
    const rows = [liveHold({ heldBy: null, heldByToken: 'guest-token' })];
    const { svc, rows: after } = makeService(rows, [
      { cabinId: 'cab-1', holdId: 'h-1' },
    ]);

    await expect(
      svc.checkout(CUSTOMER, CUSTOMER, dto([{ cabinId: 'cab-1', holdId: 'h-1' }])),
    ).resolves.toBeDefined();

    expect(after[0].state).toBe('converted');
  });

  it('refuses an expired guest-token hold too', async () => {
    const rows = [
      liveHold({
        heldBy: null,
        heldByToken: 'guest-token',
        expiresAt: new Date(Date.now() - 5_000),
      }),
    ];
    const { svc, rows: after } = makeService(rows, [
      { cabinId: 'cab-1', holdId: 'h-1' },
    ]);

    await expect(
      svc.checkout(CUSTOMER, CUSTOMER, dto([{ cabinId: 'cab-1', holdId: 'h-1' }])),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(after[0].state).toBe('held');
  });
});
