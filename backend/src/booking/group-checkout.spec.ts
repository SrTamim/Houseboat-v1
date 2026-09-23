import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingService } from './booking.service';

/**
 * Group (whole-boat buyout) checkout guards — the fixes for B-H1/B-M2.
 *
 * A buyout sells the WHOLE boat and writes NO booking_cabin rows, so the
 * per-cabin unique index / trigger cannot protect it. groupCheckout must:
 *   1. take a SELECT … FOR UPDATE lock on the departure and re-read it INSIDE
 *      the transaction (so two concurrent buyouts serialize on the row), and
 *   2. refuse if any active (non-cancelled) booking already exists on the
 *      departure — whether an individual cabin sale or another buyout.
 *
 * These are unit tests: the real row-lock serialization is a Postgres
 * primitive (the same FOR UPDATE idiom applyCredits already uses) and is proven
 * against a live DB, not a mock. What a mock CAN prove is the in-transaction
 * re-check logic and the existing-booking rejection, which is what regressed.
 */

const DEP = 'dep-1';
const HOUSEBOAT = 'boat-1';
const CUSTOMER = 'cust-1';

type DepState = {
  status: string;
  availableCount: number;
  existingBookings: number;
};

function makeService(dep: DepState | null) {
  const tx = {
    // FOR UPDATE lock — no-op in the mock (no real DB).
    $queryRaw: jest.fn().mockResolvedValue([]),
    tripDeparture: {
      findUnique: jest.fn().mockResolvedValue(
        dep
          ? { status: dep.status, availableCount: dep.availableCount }
          : null,
      ),
      update: jest.fn().mockResolvedValue({ id: DEP }),
    },
    booking: {
      count: jest.fn().mockResolvedValue(dep?.existingBookings ?? 0),
      create: jest.fn().mockResolvedValue({ id: 'bk-1', departureId: DEP }),
    },
    bookingGuest: { create: jest.fn().mockResolvedValue({}) },
    cabinHold: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    invoice: { create: jest.fn().mockResolvedValue({ id: 'inv-1' }) },
    cancellationPolicy: { findFirst: jest.fn().mockResolvedValue(null) },
  };

  const prisma = {
    // Pre-tx fast-fail read.
    tripDeparture: {
      findUnique: jest.fn().mockResolvedValue(
        dep
          ? {
              status: dep.status,
              availableCount: dep.availableCount,
              package: { houseboatId: HOUSEBOAT },
            }
          : null,
      ),
    },
    houseboatBillingConfig: { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn((fn: (t: unknown) => unknown) =>
      Promise.resolve(fn(tx)),
    ),
  };

  const pricing = {
    bandForHeadcount: jest
      .fn()
      .mockResolvedValue({ totalPrice: '10000', minPeople: 1, maxPeople: 40 }),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };

  const svc = new BookingService(
    prisma as never,
    pricing as never,
    audit as never,
    {} as never, // rbac
    {} as never, // notifications
    { emitAvailability: jest.fn(), emitCabinState: jest.fn() } as never,
    {} as never, // config
  );
  return { svc, tx, prisma };
}

const DTO = {
  departureId: DEP,
  headcount: 10,
  leadGuestName: 'A',
  leadGuestPhone: '01700000000',
} as never;

describe('BookingService.groupCheckout — buyout guards', () => {
  it('rejects a buyout when the departure already has an active booking', async () => {
    const { svc, tx } = makeService({
      status: 'scheduled',
      availableCount: 5,
      existingBookings: 1,
    });
    await expect(
      svc.groupCheckout(CUSTOMER, CUSTOMER, DTO),
    ).rejects.toBeInstanceOf(BadRequestException);
    // Must not have created the booking or zeroed availability.
    expect(tx.booking.create).not.toHaveBeenCalled();
    expect(tx.tripDeparture.update).not.toHaveBeenCalled();
  });

  it('takes the FOR UPDATE lock and re-reads inside the transaction', async () => {
    const { svc, tx } = makeService({
      status: 'scheduled',
      availableCount: 5,
      existingBookings: 0,
    });
    await svc.groupCheckout(CUSTOMER, CUSTOMER, DTO);
    expect(tx.$queryRaw).toHaveBeenCalled();
    // Authoritative re-read inside the tx (not just the pre-tx fast-fail).
    expect(tx.tripDeparture.findUnique).toHaveBeenCalled();
    expect(tx.booking.count).toHaveBeenCalled();
    expect(tx.tripDeparture.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { availableCount: 0 } }),
    );
  });

  it('rejects when the departure sold out between the pre-check and the lock', async () => {
    // Pre-tx read saw availability; the locked re-read sees 0 (a concurrent
    // buyout committed first). The in-tx guard must catch it.
    const { svc, tx } = makeService({
      status: 'scheduled',
      availableCount: 5,
      existingBookings: 0,
    });
    tx.tripDeparture.findUnique.mockResolvedValueOnce({
      status: 'scheduled',
      availableCount: 0,
    });
    await expect(
      svc.groupCheckout(CUSTOMER, CUSTOMER, DTO),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it('404s a missing departure', async () => {
    const { svc } = makeService(null);
    await expect(
      svc.groupCheckout(CUSTOMER, CUSTOMER, DTO),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
