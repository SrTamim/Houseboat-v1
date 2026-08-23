import { BadRequestException } from '@nestjs/common';
import { BookingService } from './booking.service';
import { money } from '../common/money';

/**
 * priceSelection over-capacity behaviour (counter oversell).
 *
 * A cabin rated for up to `cap` people has no rate row beyond capacity. Online
 * booking rejects an over-capacity party; the counter may oversell but must set
 * a manual price. So:
 *   - quote (allowOverCapacity, !throwOnUnpriced): cabin comes back priced:false
 *   - checkout (allowOverCapacity, throwOnUnpriced) with NO override: throws
 *   - either path WITH an override: billed at the override, priced:true
 *   - online path (no opts): still throws on over-capacity (unchanged)
 */
describe('BookingService.priceSelection — over-capacity oversell', () => {
  const CABIN = {
    id: 'cab-1',
    name: 'Rose',
    cabinCategoryId: 'cat-1',
    category: { baseCapacity: 3, extendedCapacity: 3 },
  };
  const DEPARTURE = {
    id: 'dep-1',
    status: 'scheduled',
    startDate: new Date('2026-09-01'),
    package: { houseboatId: 'boat-1', houseboat: { id: 'boat-1', childPolicy: null } },
  };

  function makeService() {
    const prisma = {
      tripDeparture: { findUnique: jest.fn().mockResolvedValue(DEPARTURE) },
      houseboatBillingConfig: { findFirst: jest.fn().mockResolvedValue(null) },
      houseboatCabin: { findUnique: jest.fn().mockResolvedValue(CABIN) },
      houseboatCoupon: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    // pricePerPersonFor would never be hit for an over-capacity party.
    const pricing = { pricePerPersonFor: jest.fn(), priceFor: jest.fn() };
    const service = new BookingService(
      prisma as never,
      pricing as never,
      { log: jest.fn() } as never,
      {} as never, // rbac
      {} as never, // notifications
      {} as never, // realtime
      { get: () => 'test-key' } as never, // config
    );
    return { service, pricing };
  }

  const overCapacity = { cabinId: 'cab-1', adults: 4 }; // 4 > cap 3

  it('quote path marks an over-capacity cabin unpriced (no throw)', async () => {
    const { service, pricing } = makeService();
    const { cabinRows } = await service.priceSelection(
      { departureId: 'dep-1', cabins: [overCapacity] },
      { throwOnUnpriced: false, allowOverCapacity: true },
    );
    expect(cabinRows[0].priced).toBe(false);
    expect(cabinRows[0].roomPrice.toFixed(2)).toBe('0.00');
    expect(pricing.pricePerPersonFor).not.toHaveBeenCalled();
  });

  it('over-capacity WITH a manual override is priced at the override', async () => {
    const { service } = makeService();
    const { cabinRows, bill } = await service.priceSelection(
      { departureId: 'dep-1', cabins: [overCapacity] },
      {
        throwOnUnpriced: false,
        allowOverCapacity: true,
        overrides: new Map([['cab-1', 7500]]),
      },
    );
    expect(cabinRows[0].priced).toBe(true);
    expect(cabinRows[0].roomPrice.toFixed(2)).toBe('7500.00');
    expect(bill.displayTotal.toFixed(2)).toBe('7500.00');
  });

  it('checkout path (throwOnUnpriced) rejects an over-capacity cabin with no price', async () => {
    const { service } = makeService();
    await expect(
      service.priceSelection(
        { departureId: 'dep-1', cabins: [overCapacity] },
        { throwOnUnpriced: true, allowOverCapacity: true },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('online path (no opts) still rejects over-capacity outright', async () => {
    const { service } = makeService();
    await expect(
      service.priceSelection({ departureId: 'dep-1', cabins: [overCapacity] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

/**
 * Children price as a DISCOUNT off the adult rate — they never pick the rate row.
 *
 * The owner sets a per-person price per adult party size ("2 people", "3 people"…).
 * Counting children into that lookup asked for a row the owner never set: a
 * 2-berth cabin with 2 adults + 3 children looked like occupancy 5, was rejected
 * as over capacity, and the customer's price silently stopped updating the moment
 * a child was added.
 *
 * Two separate numbers now, and conflating them again would corrupt real data:
 *   - the rate lookup + capacity check use ADULTS
 *   - `occupancy` stays TOTAL HEADS, because it is persisted on booking_cabin and
 *     read as a head count by the owner dashboard, the financial reports,
 *     booking.headcount and the open-seat `spare` calculation.
 */
describe('BookingService.priceSelection — children', () => {
  // Contiguous bands as an owner enters them ("Age from"/"Age to", both
  // inclusive): 0-4 free, 5-11 half, 12+ full. Every age has exactly one band.
  const POLICY = [
    { min: 0, max: 4, chargePct: 0 },
    { min: 5, max: 11, chargePct: 50 },
    { min: 12, max: 120, chargePct: 100 },
  ];
  const CABIN = {
    id: 'cab-1',
    name: 'Rose',
    cabinCategoryId: 'cat-1',
    // Two berths — the case the user reported.
    category: { baseCapacity: 2, extendedCapacity: 2 },
  };

  function makeService(childPolicy: unknown = POLICY) {
    const prisma = {
      tripDeparture: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'dep-1',
          status: 'scheduled',
          startDate: new Date('2026-09-01'),
          package: {
            houseboatId: 'boat-1',
            houseboat: { id: 'boat-1', childPolicy },
          },
        }),
      },
      houseboatBillingConfig: { findFirst: jest.fn().mockResolvedValue(null) },
      houseboatCabin: { findUnique: jest.fn().mockResolvedValue(CABIN) },
      houseboatCoupon: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    // 1000 per person, whatever occupancy row is asked for, so the assertions
    // isolate WHICH row was requested and how children were charged.
    const pricing = {
      pricePerPersonFor: jest.fn().mockResolvedValue(money(1000)),
      priceFor: jest.fn(),
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
    return { service, pricing };
  }

  it('quotes 2 adults + 3 children in a 2-berth cabin (previously threw)', async () => {
    const { service } = makeService();
    const { cabinRows } = await service.priceSelection({
      departureId: 'dep-1',
      cabins: [
        { cabinId: 'cab-1', adults: 2, children: 3, childAges: [2, 7, 14] },
      ],
    });
    expect(cabinRows[0].priced).toBe(true);
    // 2 adults @1000 + free(2y) + half(7y) + full(14y) = 2000 + 0 + 500 + 1000
    expect(cabinRows[0].roomPrice.toFixed(2)).toBe('3500.00');
  });

  it('uses the ADULTS row, not the head-count row', async () => {
    const { service, pricing } = makeService();
    await service.priceSelection({
      departureId: 'dep-1',
      cabins: [{ cabinId: 'cab-1', adults: 2, children: 3, childAges: [2, 2, 2] }],
    });
    // 3rd arg is occupancy: must be 2 (adults), never 5 (heads).
    expect(pricing.pricePerPersonFor.mock.calls[0][2]).toBe(2);
  });

  it('keeps `occupancy` as TOTAL HEADS for the manifest', async () => {
    const { service } = makeService();
    const { cabinRows } = await service.priceSelection({
      departureId: 'dep-1',
      cabins: [{ cabinId: 'cab-1', adults: 2, children: 3, childAges: [2, 2, 2] }],
    });
    // Persisted to booking_cabin.occupancy and summed into booking.headcount;
    // the owner dashboard, reports and open-seat `spare` all read it as heads.
    expect(cabinRows[0].occupancy).toBe(5);
    expect(cabinRows[0].adults).toBe(2);
    expect(cabinRows[0].children).toBe(3);
  });

  it('prices the TOP age of a band from that band, not as a gap', async () => {
    const { service } = makeService();
    const { cabinRows } = await service.priceSelection({
      departureId: 'dep-1',
      // 4 tops the free band, 11 tops the half band. Both were charged full while
      // the matcher treated `max` as exclusive — the reported bug.
      cabins: [{ cabinId: 'cab-1', adults: 1, children: 2, childAges: [4, 11] }],
    });
    // 1 adult (1000) + age 4 free (0) + age 11 half (500) = 1500
    expect(cabinRows[0].roomPrice.toFixed(2)).toBe('1500.00');
  });

  it('charges an age in a GENUINE policy gap at full fare', async () => {
    // A real seeded boat has 0-5 then 12-120 and nothing between. That gap is the
    // owner's own omission, so full fare is the correct, honest outcome.
    const { service } = makeService([
      { min: 0, max: 5, chargePct: 0 },
      { min: 12, max: 120, chargePct: 100 },
    ]);
    const { cabinRows } = await service.priceSelection({
      departureId: 'dep-1',
      cabins: [{ cabinId: 'cab-1', adults: 1, children: 1, childAges: [8] }],
    });
    // 1 adult + 1 unbanded child at full fare = 2000
    expect(cabinRows[0].roomPrice.toFixed(2)).toBe('2000.00');
  });

  it('rejects a cabin of children with no adult', async () => {
    const { service } = makeService();
    await expect(
      service.priceSelection({
        departureId: 'dep-1',
        cabins: [{ cabinId: 'cab-1', adults: 0, children: 2, childAges: [3, 4] }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('still rejects too many ADULTS for the cabin', async () => {
    const { service } = makeService();
    await expect(
      service.priceSelection({
        departureId: 'dep-1',
        cabins: [{ cabinId: 'cab-1', adults: 3 }], // 3 > cap 2
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prices an adults-only cabin exactly as before (regression guard)', async () => {
    const { service, pricing } = makeService();
    const { cabinRows } = await service.priceSelection({
      departureId: 'dep-1',
      cabins: [{ cabinId: 'cab-1', adults: 2 }],
    });
    expect(pricing.pricePerPersonFor.mock.calls[0][2]).toBe(2);
    expect(cabinRows[0].roomPrice.toFixed(2)).toBe('2000.00');
    expect(cabinRows[0].occupancy).toBe(2);
  });

  it('charges children full when the boat has no child policy', async () => {
    const { service } = makeService(null);
    const { cabinRows } = await service.priceSelection({
      departureId: 'dep-1',
      cabins: [{ cabinId: 'cab-1', adults: 1, children: 1, childAges: [3] }],
    });
    expect(cabinRows[0].roomPrice.toFixed(2)).toBe('2000.00');
  });
});
