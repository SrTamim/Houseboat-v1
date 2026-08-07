import { BadRequestException } from '@nestjs/common';
import { BookingService } from './booking.service';

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
