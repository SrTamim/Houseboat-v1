import { BadRequestException } from '@nestjs/common';
import { OwnerBookingsService } from './owner-bookings.service';
import type { PosCheckoutDto } from './dto/owner-bookings.dto';

/**
 * Counter-sale confirm path. The grid now holds each cabin on select (starting
 * the visible 10-min countdown), so confirm-sale must CONVERT those existing
 * holds — never re-hold them, which would trip uq_cabin_hold_active on the
 * operator's own cabin ("just taken").
 */
describe('OwnerBookingsService.posCheckout — hold conversion', () => {
  const DEPARTURE = { id: 'dep-1' };
  const CHECKOUT_RESULT = {
    booking: { id: 'bk-1' },
    invoice: null as null | { id: string; displayTotal: string },
  };

  function makeService(invoice: { id: string; displayTotal: string } | null = null) {
    const prisma = {
      tripDeparture: { findFirst: jest.fn().mockResolvedValue(DEPARTURE) },
      account: { upsert: jest.fn().mockResolvedValue({ id: 'cust-1' }) },
    };
    const holds = {
      hold: jest.fn().mockResolvedValue({ id: 'should-not-be-called' }),
      listActiveForDeparture: jest.fn(),
    };
    const booking = {
      checkout: jest.fn().mockResolvedValue({ ...CHECKOUT_RESULT, invoice }),
      priceSelection: jest.fn(),
    };
    const payments = { recordPayment: jest.fn().mockResolvedValue(undefined) };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };

    const service = new OwnerBookingsService(
      prisma as never,
      holds as never,
      booking as never,
      payments as never,
      {} as never, // notifications — unused here
      audit as never,
    );
    return { service, holds, booking, payments };
  }

  const base: PosCheckoutDto = {
    departureId: 'dep-1',
    customerName: 'Farhana',
    customerPhone: '+8801711222290',
  };

  it('converts pre-taken holds without re-holding', async () => {
    const { service, holds, booking } = makeService();
    await service.posCheckout('boat-1', 'owner-1', {
      ...base,
      holds: [
        { cabinId: 'cab-1', holdId: 'h-1', adults: 2 },
        { cabinId: 'cab-2', holdId: 'h-2', adults: 2, children: 1 },
      ],
    });

    // The whole point: no new holds are taken on confirm.
    expect(holds.hold).not.toHaveBeenCalled();
    // The existing holdIds are passed straight to checkout for conversion.
    expect(booking.checkout).toHaveBeenCalledWith(
      'cust-1',
      'owner-1',
      expect.objectContaining({
        cabins: [
          expect.objectContaining({ cabinId: 'cab-1', holdId: 'h-1' }),
          expect.objectContaining({ cabinId: 'cab-2', holdId: 'h-2' }),
        ],
      }),
      expect.any(Object),
    );
  });

  it('legacy path still re-holds when only cabins are given', async () => {
    const { service, holds } = makeService();
    holds.hold
      .mockResolvedValueOnce({ id: 'new-1' })
      .mockResolvedValueOnce({ id: 'new-2' });

    await service.posCheckout('boat-1', 'owner-1', {
      ...base,
      cabins: [
        { cabinId: 'cab-1', adults: 2 },
        { cabinId: 'cab-2', adults: 2 },
      ],
    });

    expect(holds.hold).toHaveBeenCalledTimes(2);
  });

  it('rejects when neither holds nor cabins are provided', async () => {
    const { service } = makeService();
    await expect(
      service.posCheckout('boat-1', 'owner-1', base),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('threads a per-cabin price override and owner discount into checkout', async () => {
    const { service, booking } = makeService({ id: 'inv-1', displayTotal: '5000.00' });
    await service.posCheckout('boat-1', 'owner-1', {
      ...base,
      discount: 300,
      holds: [{ cabinId: 'cab-1', holdId: 'h-1', adults: 2, priceOverride: 4200 }],
    });

    const opts = booking.checkout.mock.calls[0][3];
    expect(opts.ownerDiscount).toBe(300);
    expect(opts.overrides.get('cab-1')).toBe(4200);
  });
});

describe('OwnerBookingsService.posCheckout — partial payment', () => {
  const base = {
    departureId: 'dep-1',
    customerName: 'Farhana',
    customerPhone: '+8801711222290',
    paymentMethod: 'cash' as const,
    holds: [{ cabinId: 'cab-1', holdId: 'h-1', adults: 2 }],
  };

  function svc(displayTotal = '5000.00') {
    const prisma = {
      tripDeparture: { findFirst: jest.fn().mockResolvedValue({ id: 'dep-1' }) },
      account: { upsert: jest.fn().mockResolvedValue({ id: 'cust-1' }) },
    };
    const holds = { hold: jest.fn(), listActiveForDeparture: jest.fn() };
    const booking = {
      checkout: jest.fn().mockResolvedValue({
        booking: { id: 'bk-1' },
        invoice: { id: 'inv-1', displayTotal },
      }),
      priceSelection: jest.fn(),
    };
    const payments = { recordPayment: jest.fn().mockResolvedValue(undefined) };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new OwnerBookingsService(
      prisma as never, holds as never, booking as never,
      payments as never, {} as never, audit as never,
    );
    return { service, payments };
  }

  it('records exactly the partial amount the customer paid', async () => {
    const { service, payments } = svc('5000.00');
    await service.posCheckout('boat-1', 'owner-1', { ...base, amountPaid: 2000 });
    expect(payments.recordPayment).toHaveBeenCalledWith(
      'inv-1', 'owner-1', false,
      expect.objectContaining({ amount: 2000, method: 'cash' }),
    );
  });

  it('records the full total when amountPaid is omitted (legacy behaviour)', async () => {
    const { service, payments } = svc('5000.00');
    await service.posCheckout('boat-1', 'owner-1', base);
    expect(payments.recordPayment).toHaveBeenCalledWith(
      'inv-1', 'owner-1', false,
      expect.objectContaining({ amount: 5000 }),
    );
  });

  it('records NOTHING when amountPaid is 0 (invoice stays due)', async () => {
    const { service, payments } = svc('5000.00');
    await service.posCheckout('boat-1', 'owner-1', { ...base, amountPaid: 0 });
    expect(payments.recordPayment).not.toHaveBeenCalled();
  });
});

describe('OwnerBookingsService.posQuote — read-only pricing', () => {
  function svc() {
    const prisma = {
      tripDeparture: { findFirst: jest.fn().mockResolvedValue({ id: 'dep-1' }) },
    };
    const holds = { hold: jest.fn(), listActiveForDeparture: jest.fn() };
    const booking = {
      checkout: jest.fn(),
      priceSelection: jest.fn().mockResolvedValue({
        cabinRows: [
          { cabinId: 'cab-1', roomPrice: { toFixed: () => '4000.00' }, priced: true },
          { cabinId: 'cab-2', roomPrice: { toFixed: () => '0.00' }, priced: false },
        ],
        bill: {
          roomTotal: { toFixed: () => '4000.00' },
          discountAmount: { toFixed: () => '0.00' },
          displayTotal: { toFixed: () => '4000.00' },
        },
      }),
    };
    const payments = { recordPayment: jest.fn() };
    const audit = { log: jest.fn() };
    const service = new OwnerBookingsService(
      prisma as never, holds as never, booking as never,
      payments as never, {} as never, audit as never,
    );
    return { service, holds, booking, payments };
  }

  it('returns per-cabin prices + totals and creates no holds/bookings', async () => {
    const { service, holds, booking, payments } = svc();
    const out = await service.posQuote('boat-1', {
      departureId: 'dep-1',
      cabins: [
        { cabinId: 'cab-1', adults: 2 },
        { cabinId: 'cab-2', adults: 3 },
      ],
    });

    expect(out.displayTotal).toBe('4000.00');
    expect(out.perCabin).toEqual([
      { cabinId: 'cab-1', roomPrice: '4000.00', priced: true },
      { cabinId: 'cab-2', roomPrice: '0.00', priced: false },
    ]);
    // Read-only: no writes.
    expect(holds.hold).not.toHaveBeenCalled();
    expect(booking.checkout).not.toHaveBeenCalled();
    expect(payments.recordPayment).not.toHaveBeenCalled();
    // Quote must not throw on an unpriced cabin.
    expect(booking.priceSelection.mock.calls[0][1].throwOnUnpriced).toBe(false);
  });
});
