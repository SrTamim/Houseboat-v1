import { BookingService } from './booking.service';
import { money } from '../common/money';

/**
 * Coupon usage-limit enforcement in priceSelection/resolveCoupon (audit M-H1).
 *
 * A coupon that is exhausted (maxUses), used up by this customer (perUserLimit),
 * or below its minSpend must NOT apply — the bill is charged in full, exactly as
 * with an invalid code. These tests drive priceSelection with one priced cabin
 * and a coupon mock, asserting whether the discount landed.
 */
describe('BookingService.priceSelection — coupon usage limits', () => {
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
  // A ৳2000/room cabin: 2 adults × ৳1000 per person.
  const COUPON = {
    id: 'cpn-1',
    houseboatId: 'boat-1',
    code: 'SAVE',
    kind: 'flat' as const,
    value: '500',
    validFrom: null,
    validTo: null,
    isActive: true,
    maxUses: null as number | null,
    perUserLimit: null as number | null,
    minSpend: null as string | null,
  };

  function makeService(
    coupon: typeof COUPON | null,
    bookingCount = 0,
  ) {
    const prisma = {
      tripDeparture: { findUnique: jest.fn().mockResolvedValue(DEPARTURE) },
      houseboatBillingConfig: { findFirst: jest.fn().mockResolvedValue(null) },
      houseboatCabin: { findUnique: jest.fn().mockResolvedValue(CABIN) },
      coupon: { findFirst: jest.fn().mockResolvedValue(coupon) },
      booking: { count: jest.fn().mockResolvedValue(bookingCount) },
    };
    const pricing = {
      pricePerPersonFor: jest.fn().mockResolvedValue(money(1000)),
      priceFor: jest.fn().mockResolvedValue(money(2000)),
    };
    const service = new BookingService(
      prisma as never,
      pricing as never,
      { log: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      { get: () => 'test-key' } as never,
    );
    return { service, prisma };
  }

  const SEL = {
    departureId: 'dep-1',
    cabins: [{ cabinId: 'cab-1', adults: 2 }],
    couponCode: 'SAVE',
  };

  it('applies a coupon that is within all limits', async () => {
    const { service } = makeService({ ...COUPON });
    const { bill, coupon } = await service.priceSelection(SEL);
    expect(coupon).not.toBeNull();
    expect(bill.discountAmount.toFixed(2)).toBe('500.00');
  });

  it('does NOT apply once maxUses is reached', async () => {
    const { service } = makeService({ ...COUPON, maxUses: 3 }, 3); // 3 used, cap 3
    const { bill, coupon } = await service.priceSelection(SEL);
    expect(coupon).toBeNull();
    expect(bill.discountAmount.toFixed(2)).toBe('0.00');
  });

  it('does NOT apply once this customer hit perUserLimit', async () => {
    const { service } = makeService({ ...COUPON, perUserLimit: 1 }, 1);
    const { bill, coupon } = await service.priceSelection(SEL, {
      customerId: 'cust-1',
    });
    expect(coupon).toBeNull();
    expect(bill.discountAmount.toFixed(2)).toBe('0.00');
  });

  it('does NOT apply below minSpend', async () => {
    // Room total is ৳2000; minSpend ৳5000 → coupon must not apply.
    const { service } = makeService({ ...COUPON, minSpend: '5000' });
    const { bill, coupon } = await service.priceSelection(SEL);
    expect(coupon).toBeNull();
    expect(bill.discountAmount.toFixed(2)).toBe('0.00');
  });

  it('applies at or above minSpend', async () => {
    const { service } = makeService({ ...COUPON, minSpend: '2000' });
    const { bill, coupon } = await service.priceSelection(SEL);
    expect(coupon).not.toBeNull();
    expect(bill.discountAmount.toFixed(2)).toBe('500.00');
  });
});
