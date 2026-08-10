import { PricingService } from './pricing.service';

/**
 * profileForDate resolution priority for route-scoped pricing:
 *   1. Holiday — a listed holiday date wins over everything (incl. a weekend).
 *   2. Weekend — BD weekend (Fri/Sat) IF the weekend profile is actually priced.
 *   3. General — the route's default/fallback.
 *
 * 2026 weekday reference (UTC): 08-05 Wed, 08-07 Fri, 08-08 Sat, 08-10 Mon.
 */
describe('PricingService.profileForDate — route resolution priority', () => {
  const ROUTE = 'route-1';
  const HOUSEBOAT = 'boat-1';

  // A priced holiday whose dates cover a weekday (08-10 Mon) and a weekend (08-08 Sat).
  const holiday = {
    id: 'p-holiday',
    houseboatId: HOUSEBOAT,
    routeId: ROUTE,
    priceType: 'holiday',
    isDefault: false,
    dates: [new Date('2026-08-08'), new Date('2026-08-10')],
    rules: [{ id: 'r1', cabinCategoryId: 'c1', occupancy: 2, pricePerPerson: 9000 }],
  };
  const weekend = {
    id: 'p-weekend',
    houseboatId: HOUSEBOAT,
    routeId: ROUTE,
    priceType: 'weekend',
    isDefault: false,
    dates: [],
    rules: [{ id: 'r2', cabinCategoryId: 'c1', occupancy: 2, pricePerPerson: 7000 }],
  };
  const general = {
    id: 'p-general',
    houseboatId: HOUSEBOAT,
    routeId: ROUTE,
    priceType: 'general',
    isDefault: true,
    dates: [],
    rules: [{ id: 'r3', cabinCategoryId: 'c1', occupancy: 2, pricePerPerson: 5000 }],
  };

  function makeService(profiles: unknown[]) {
    const prisma = {
      pricingProfile: { findMany: jest.fn().mockResolvedValue(profiles) },
    };
    const audit = { log: jest.fn() };
    return new PricingService(prisma as never, audit as never);
  }

  it('weekday, no holiday → general', async () => {
    const svc = makeService([general, weekend, holiday]);
    const p = await svc.profileForDate(HOUSEBOAT, new Date('2026-08-05'), ROUTE);
    expect(p?.id).toBe('p-general');
  });

  it('Friday, not a holiday, weekend priced → weekend', async () => {
    const svc = makeService([general, weekend, holiday]);
    const p = await svc.profileForDate(HOUSEBOAT, new Date('2026-08-07'), ROUTE);
    expect(p?.id).toBe('p-weekend');
  });

  it('Saturday that is ALSO a listed holiday → holiday (holiday wins over weekend)', async () => {
    const svc = makeService([general, weekend, holiday]);
    const p = await svc.profileForDate(HOUSEBOAT, new Date('2026-08-08'), ROUTE);
    expect(p?.id).toBe('p-holiday');
  });

  it('holiday on a weekday → holiday', async () => {
    const svc = makeService([general, weekend, holiday]);
    const p = await svc.profileForDate(HOUSEBOAT, new Date('2026-08-10'), ROUTE);
    expect(p?.id).toBe('p-holiday');
  });

  it('Friday but weekend profile has no rules → general (weekend only applies when priced)', async () => {
    const unpricedWeekend = { ...weekend, rules: [] };
    const svc = makeService([general, unpricedWeekend, holiday]);
    const p = await svc.profileForDate(HOUSEBOAT, new Date('2026-08-07'), ROUTE);
    expect(p?.id).toBe('p-general');
  });
});
