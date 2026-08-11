import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BookingService } from './booking.service';
import { HoldsService } from './holds.service';

/**
 * Customer-facing IDOR regressions (G1, G2).
 *
 * G1 — BookingService.get(): reading a booking by id must be limited to the
 * booking's own customer, or a boat member with bookings:view. Without the check
 * any authenticated account could read any booking's guest PII + invoice.
 *
 * G2 — HoldsService.release(): a live hold may only be released by the account
 * that took it, else anyone could release anyone's hold and grief availability.
 * An absent/already-resolved hold stays a silent no-op (idempotent contract).
 */
describe('BookingService.get — ownership (G1)', () => {
  function makeService(booking: unknown) {
    const prisma = {
      booking: { findUnique: jest.fn().mockResolvedValue(booking) },
    };
    const rbac = { assert: jest.fn().mockRejectedValue(new Error('denied')) };
    const svc = new BookingService(
      prisma as never,
      {} as never,
      {} as never,
      rbac as never,
      {} as never,
      {} as never,
      { get: () => 'test-key' } as never,
    );
    return { svc, prisma, rbac };
  }

  it('returns the booking to its own customer without an rbac check', async () => {
    const booking = {
      id: 'bk-1',
      customerId: 'cust-A',
      invoice: { houseboatId: 'boat-A' },
    };
    const { svc, rbac } = makeService(booking);
    await expect(svc.get('bk-1', 'cust-A', false)).resolves.toBe(booking);
    expect(rbac.assert).not.toHaveBeenCalled();
  });

  it('rejects a different customer via rbac (IDOR blocked)', async () => {
    const booking = {
      id: 'bk-1',
      customerId: 'cust-A',
      invoice: { houseboatId: 'boat-A' },
    };
    const { svc, rbac } = makeService(booking);
    await expect(svc.get('bk-1', 'attacker', false)).rejects.toBeDefined();
    expect(rbac.assert).toHaveBeenCalledWith(
      'attacker',
      false,
      'boat-A',
      'bookings',
      'view',
    );
  });

  it('throws NotFound for a missing booking (no id enumeration)', async () => {
    const { svc } = makeService(null);
    await expect(svc.get('nope', 'anyone', false)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('HoldsService.release — ownership (G2)', () => {
  function makeService(hold: unknown) {
    const tx = {
      cabinHold: {
        findUnique: jest.fn().mockResolvedValue(hold),
        update: jest.fn().mockResolvedValue({}),
      },
      tripDeparture: {
        update: jest.fn().mockResolvedValue({ availableCount: 1 }),
      },
    };
    const prisma = {
      $transaction: jest.fn((fn: (t: unknown) => unknown) =>
        Promise.resolve(fn(tx)),
      ),
    };
    const realtime = {
      emitCabinState: jest.fn(),
      emitAvailability: jest.fn(),
    };
    const svc = new HoldsService(prisma as never, {} as never, realtime as never);
    return { svc, tx, realtime };
  }

  it('rejects releasing a live hold owned by another account', async () => {
    const { svc, tx } = makeService({
      id: 'h-1',
      heldBy: 'cust-A',
      state: 'held',
      departureId: 'dep-1',
      cabinId: 'cab-1',
    });
    await expect(svc.release('h-1', 'attacker', false)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(tx.cabinHold.update).not.toHaveBeenCalled();
  });

  it('releases the caller’s own live hold', async () => {
    const { svc, tx, realtime } = makeService({
      id: 'h-1',
      heldBy: 'cust-A',
      state: 'held',
      departureId: 'dep-1',
      cabinId: 'cab-1',
    });
    await svc.release('h-1', 'cust-A', false);
    expect(tx.cabinHold.update).toHaveBeenCalledTimes(1);
    expect(realtime.emitCabinState).toHaveBeenCalledWith('dep-1', 'cab-1', 'released');
  });

  it('is a silent no-op for an already-resolved hold (idempotent)', async () => {
    const { svc, tx } = makeService({
      id: 'h-1',
      heldBy: 'cust-A',
      state: 'released',
    });
    await expect(svc.release('h-1', 'attacker', false)).resolves.toBeUndefined();
    expect(tx.cabinHold.update).not.toHaveBeenCalled();
  });

  it('lets a platform actor override ownership', async () => {
    const { svc, tx } = makeService({
      id: 'h-1',
      heldBy: 'cust-A',
      state: 'held',
      departureId: 'dep-1',
      cabinId: 'cab-1',
    });
    await svc.release('h-1', 'staff', true);
    expect(tx.cabinHold.update).toHaveBeenCalledTimes(1);
  });
});
