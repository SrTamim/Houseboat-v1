import { HouseboatsService } from './houseboats.service';

/**
 * Search reads the denormalized facets. Two paths:
 *  - search()        — flat SearchBoat[] for the home page (keys priceFrom /
 *                      cabinCount / facilities). MUST stay backward-compatible.
 *  - searchResults() — DB-side WHERE + orderBy + offset pagination, returning
 *                      { items, total, page, pageSize, facets }.
 */

const boatRow = {
  id: 'b1',
  name: 'Jol Kolol',
  slug: 'jol-kolol',
  description: 'nice',
  safetyFeatures: null,
  createdAt: new Date('2026-01-01'),
  routes: [{ route: { name: 'Tanguar Haor', region: 'Sunamganj' } }],
  minPricePerPerson: { toString: () => '3500', valueOf: () => 3500 } as never,
  maxCapacity: 20,
  hasAc: true,
  hasNonAc: true,
  ratingAvg: 4.5,
  reviewCount: 8,
  amenitiesText: 'balcony generator meals',
  _count: { cabinCategories: 4 },
};

function makeService(opts: {
  boats?: (typeof boatRow)[];
  count?: number;
} = {}) {
  const boats = opts.boats ?? [boatRow];
  const houseboat = {
    findMany: jest.fn().mockResolvedValue(boats),
    count: jest.fn().mockResolvedValue(opts.count ?? boats.length),
    aggregate: jest.fn().mockResolvedValue({
      _min: { minPricePerPerson: 3500 },
      _max: { minPricePerPerson: 12000 },
    }),
  };
  const houseboatRoute = {
    findMany: jest
      .fn()
      .mockResolvedValue([
        { route: { name: 'Tanguar Haor', region: 'Sunamganj' } },
      ]),
  };
  const tripDeparture = { findMany: jest.fn().mockResolvedValue([]) };
  const prisma = { houseboat, houseboatRoute, tripDeparture };
  const svc = new HouseboatsService(
    prisma as never,
    {} as never,
    {} as never,
  );
  return { svc, houseboat, houseboatRoute };
}

describe('HouseboatsService.search (flat, home page)', () => {
  it('returns a flat array with legacy keys priceFrom/cabinCount/facilities', async () => {
    const { svc } = makeService();
    const res = await svc.search({});
    expect(Array.isArray(res)).toBe(true);
    const card = res[0];
    expect(card.priceFrom).toBe(3500);
    expect(card.cabinCount).toBe(4);
    // Amenities were previously never returned — now populated from the rollup.
    expect(card.facilities).toEqual(['balcony', 'generator', 'meals']);
    // Column names must NOT leak onto the card.
    expect((card as Record<string, unknown>).minPricePerPerson).toBeUndefined();
  });
});

describe('HouseboatsService.searchResults (DB-side)', () => {
  it('builds indexed WHERE filters and returns the paginated envelope', async () => {
    const { svc, houseboat } = makeService({ count: 37 });
    const res = await svc.searchResults({
      ac: 'ac',
      minPrice: 2000,
      maxPrice: 8000,
      guests: 10,
      rating: 4,
      amenities: ['balcony'],
      sizes: ['medium', 'large'],
      sort: 'price_asc',
      page: 2,
      pageSize: 9,
    });

    expect(res.total).toBe(37);
    expect(res.page).toBe(2);
    expect(res.pageSize).toBe(9);
    expect(res.items[0].priceFrom).toBe(3500);
    expect(res.facets.priceMin).toBe(3500);
    expect(res.facets.priceMax).toBe(12000);
    expect(res.facets.destinations[0]).toMatchObject({ label: 'Tanguar Haor' });

    const where = houseboat.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('live');
    expect(where.hasAc).toBe(true);
    expect(where.minPricePerPerson).toEqual({ gte: 2000, lte: 8000 });
    expect(where.maxCapacity).toEqual({ gte: 10 });
    expect(where.ratingAvg).toEqual({ gte: 4 });
    // amenity 'Balcony' → AND of an OR over its synonyms
    expect(where.AND[0].OR).toEqual([
      { amenitiesText: { contains: 'balcony', mode: 'insensitive' } },
      { amenitiesText: { contains: 'balconies', mode: 'insensitive' } },
    ]);
    // size buckets → OR of capacity ranges (medium 13–30, large 31+)
    expect(where.OR).toEqual([
      { maxCapacity: { gte: 13, lte: 30 } },
      { maxCapacity: { gte: 31 } },
    ]);
    // offset pagination
    const args = houseboat.findMany.mock.calls[0][0];
    expect(args.skip).toBe(9);
    expect(args.take).toBe(9);
    expect(args.orderBy).toEqual({
      minPricePerPerson: { sort: 'asc', nulls: 'last' },
    });
  });

  it('maps sort=reviews and sort=rating to the indexed columns', async () => {
    const { svc, houseboat } = makeService();
    await svc.searchResults({ sort: 'reviews' });
    expect(houseboat.findMany.mock.calls[0][0].orderBy).toEqual({
      reviewCount: 'desc',
    });

    const again = makeService();
    await again.svc.searchResults({ sort: 'rating' });
    expect(again.houseboat.findMany.mock.calls[0][0].orderBy).toEqual({
      ratingAvg: { sort: 'desc', nulls: 'last' },
    });
  });

  it('defaults recommended/unknown sort to newest-first', async () => {
    const { svc, houseboat } = makeService();
    await svc.searchResults({ sort: 'recommended' });
    expect(houseboat.findMany.mock.calls[0][0].orderBy).toEqual({
      createdAt: 'desc',
    });
  });
});
