import { BadRequestException } from '@nestjs/common';
import { BookingService } from './booking.service';
import { money } from '../common/money';

/**
 * Deposit-gated booking via BookingIntent (audit M-H2).
 *
 * createIntent prices a checkout and stashes it WITHOUT making a booking;
 * confirmIntent creates the booking only when a deposit >= minDeposit is
 * confirmed. These tests drive both against a Prisma double.
 */
describe('BookingService — booking intent (M-H2 deposit gate)', () => {
  const CABIN = {
    id: 'cab-1',
    name: 'Rose',
    cabinCategoryId: 'cat-1',
    category: { baseCapacity: 4, extendedCapacity: 4 },
  };
  const DEPARTURE = {
    id: 'dep-1',
    status: 'scheduled',
    startDate: new Date('2026-09-01'),
    package: { houseboatId: 'boat-1', houseboat: { id: 'boat-1', childPolicy: null } },
  };

  // Shared mutable intent store so confirmIntent sees what createIntent wrote.
  function makeService(seedIntent?: Record<string, unknown>) {
    const intents: Record<string, any> = {};
    if (seedIntent) intents[seedIntent.id as string] = { ...seedIntent };

    const created: any = { booking: null, invoice: null, payments: [] };

    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      bookingIntent: {
        findUnique: jest.fn(({ where }: any) =>
          Promise.resolve(intents[where.id] ?? null),
        ),
        update: jest.fn(({ where, data }: any) => {
          Object.assign(intents[where.id], data);
          return Promise.resolve(intents[where.id]);
        }),
      },
      cabinHold: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      booking: {
        create: jest.fn(({ data }: any) => {
          created.booking = { ...data };
          return Promise.resolve({ ...data });
        }),
      },
      bookingCabin: { createMany: jest.fn().mockResolvedValue({}) },
      bookingGuest: { create: jest.fn().mockResolvedValue({}) },
      invoicePayment: {
        create: jest.fn(({ data }: any) => {
          created.payments.push({ ...data });
          return Promise.resolve({ ...data });
        }),
      },
      invoice: {
        create: jest.fn(({ data }: any) => {
          created.invoice = { ...data };
          return Promise.resolve({ ...data });
        }),
        update: jest.fn(({ data }: any) => {
          Object.assign(created.invoice, data);
          return Promise.resolve(created.invoice);
        }),
        findFirst: jest.fn().mockResolvedValue({ id: 'inv-1' }),
      },
      cancellationPolicy: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    const prisma = {
      tripDeparture: { findUnique: jest.fn().mockResolvedValue(DEPARTURE) },
      houseboatBillingConfig: { findFirst: jest.fn().mockResolvedValue(null) },
      houseboatCabin: { findUnique: jest.fn().mockResolvedValue(CABIN) },
      coupon: { findFirst: jest.fn().mockResolvedValue(null) },
      booking: { count: jest.fn().mockResolvedValue(0) },
      cabinHold: {
        count: jest.fn().mockResolvedValue(1),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _max: { expiresAt: new Date(Date.now() + 600_000) } }),
      },
      bookingIntent: {
        findUnique: jest.fn(({ where }: any) =>
          Promise.resolve(intents[where.id] ?? null),
        ),
        create: jest.fn(({ data }: any) => {
          intents[data.id] = { ...data };
          return Promise.resolve({ ...data });
        }),
      },
      account: {
        findUnique: jest.fn().mockResolvedValue({ name: 'A', phone: '1', email: null }),
      },
      invoice: { findFirst: jest.fn().mockResolvedValue({ id: 'inv-1' }) },
      $transaction: jest.fn((fn: (t: unknown) => unknown) =>
        Promise.resolve(fn(tx)),
      ),
    };
    const pricing = {
      pricePerPersonFor: jest.fn().mockResolvedValue(money(1000)),
      priceFor: jest.fn().mockResolvedValue(money(2000)),
    };
    const svc = new BookingService(
      prisma as never,
      pricing as never,
      { log: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      { get: () => 'test-key' } as never,
    );
    return { svc, intents, created };
  }

  const DTO = {
    departureId: 'dep-1',
    cabins: [{ cabinId: 'cab-1', holdId: 'h-1', adults: 2 }],
    leadGuestName: 'A',
    leadGuestPhone: '01700000000',
  } as never;

  it('createIntent prices the checkout and makes NO booking', async () => {
    const { svc, intents, created } = makeService();
    const res = await svc.createIntent('cust-1', 'cust-1', DTO, {
      callerToken: undefined,
    });
    // ৳2000 room total, 50% floor → ৳1000 min deposit.
    expect(res.displayTotal).toBe('2000.00');
    expect(res.minDeposit).toBe('1000.00');
    expect(Object.keys(intents)).toHaveLength(1);
    expect(created.booking).toBeNull();
  });

  it('confirmIntent REJECTS a deposit below the minimum', async () => {
    const seed = {
      id: 'int-1',
      departureId: 'dep-1',
      houseboatId: 'boat-1',
      customerId: 'cust-1',
      bookedBy: 'cust-1',
      channel: 'web',
      payload: DTO,
      displayTotal: '2000',
      minDeposit: '1000',
      status: 'requested',
      bookingId: null,
      expiresAt: new Date(Date.now() + 600_000),
    };
    const { svc, created } = makeService(seed);
    await expect(
      svc.confirmIntent('int-1', { amount: 500, method: 'gateway' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(created.booking).toBeNull();
  });

  it('confirmIntent creates the booking + records the deposit at the floor', async () => {
    const seed = {
      id: 'int-1',
      departureId: 'dep-1',
      houseboatId: 'boat-1',
      customerId: 'cust-1',
      bookedBy: 'cust-1',
      channel: 'web',
      payload: DTO,
      displayTotal: '2000',
      minDeposit: '1000',
      status: 'requested',
      bookingId: null,
      expiresAt: new Date(Date.now() + 600_000),
    };
    const { svc, created, intents } = makeService(seed);
    const res = await svc.confirmIntent('int-1', {
      amount: 1000,
      method: 'gateway',
      gatewayToken: 'tok-1',
    });
    expect(res.alreadyDone).toBe(false);
    expect(created.booking).not.toBeNull();
    expect(created.booking.status).toBe('confirmed');
    expect(created.payments).toHaveLength(1);
    expect(created.payments[0].amount).toBe(1000);
    // Deposit < total → invoice stays customer_due.
    expect(created.invoice.status).toBe('customer_due');
    expect(intents['int-1'].status).toBe('consumed');
  });

  it('confirmIntent is idempotent on a replay (already consumed)', async () => {
    const seed = {
      id: 'int-1',
      departureId: 'dep-1',
      houseboatId: 'boat-1',
      customerId: 'cust-1',
      bookedBy: 'cust-1',
      channel: 'web',
      payload: DTO,
      displayTotal: '2000',
      minDeposit: '1000',
      status: 'consumed',
      bookingId: 'bk-existing',
      expiresAt: new Date(Date.now() + 600_000),
    };
    const { svc, created } = makeService(seed);
    const res = await svc.confirmIntent('int-1', {
      amount: 1000,
      method: 'gateway',
    });
    expect(res.alreadyDone).toBe(true);
    expect(res.bookingId).toBe('bk-existing');
    expect(created.booking).toBeNull(); // no second booking
  });

  it('confirmIntent flips the invoice to paid on a full payment', async () => {
    const seed = {
      id: 'int-1',
      departureId: 'dep-1',
      houseboatId: 'boat-1',
      customerId: 'cust-1',
      bookedBy: 'cust-1',
      channel: 'web',
      payload: DTO,
      displayTotal: '2000',
      minDeposit: '1000',
      status: 'requested',
      bookingId: null,
      expiresAt: new Date(Date.now() + 600_000),
    };
    const { svc, created } = makeService(seed);
    await svc.confirmIntent('int-1', { amount: 2000, method: 'gateway' });
    expect(created.invoice.status).toBe('paid');
  });
});
