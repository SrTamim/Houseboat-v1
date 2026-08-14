import type { SearchBoat } from '@/lib/customer/types';

/**
 * Search filter model + the pure functions that apply it.
 *
 * Everything here runs in the browser against a single unfiltered
 * GET /houseboats/search response. That endpoint already reads the whole live
 * catalogue on every request (only `route` is a real Prisma WHERE — ac/price/
 * guests/sort are applied in memory server-side), so filtering per keystroke on
 * the server would cost one full catalogue read per change and buy nothing.
 * Fetching once and filtering here is both fewer DB reads and zero-latency.
 *
 * TODO: past ~200 live boats the payload gets heavy and the endpoint needs real
 * DB-level filtering plus server-side pagination.
 */

export type Ac = 'ac' | 'nonac' | 'both';
export type Sort = 'recommended' | 'price_asc' | 'price_desc' | 'rating' | 'reviews';
export type SizeKey = 'small' | 'medium' | 'large';

export const PAGE_SIZE = 9;

/** Boat-size buckets (design preview: "Small (up to 12 guests)" etc.). */
export const SIZE_BUCKETS: { key: SizeKey; label: string; min: number; max: number }[] = [
  { key: 'small', label: 'Small (up to 12 guests)', min: 0, max: 12 },
  { key: 'medium', label: 'Medium (13–30 guests)', min: 13, max: 30 },
  { key: 'large', label: 'Large (31+ guests)', min: 31, max: Infinity },
];

/** Rating thresholds, highest first (preview: 5.0 / 4.0 & up / 3.0 & up / any). */
export const RATING_OPTIONS: { value: number; label: string }[] = [
  { value: 5, label: '5.0' },
  { value: 4, label: '4.0 & up' },
  { value: 3, label: '3.0 & up' },
];

/**
 * Amenity keywords matched case-insensitively against each boat's rolled-up
 * cabin-category `facilities` text.
 *
 * Caveat: `HouseboatCabinCategory.facilities` is free-text prose, not a tag
 * list, so this is substring matching — "private balcony" matches Balcony,
 * "verandah" does not. Options that match nothing render disabled rather than
 * silently returning zero results. A precise fix needs a structured amenity
 * column (Prisma migration + owner-console editing), which is out of scope here.
 */
export const AMENITIES: { key: string; label: string; match: string[] }[] = [
  { key: 'meals', label: 'Meals included', match: ['meal', 'food', 'buffet'] },
  { key: 'balcony', label: 'Balcony', match: ['balcony', 'balconies'] },
  { key: 'swing', label: 'Swing', match: ['swing'] },
  { key: 'games', label: 'Indoor games', match: ['game', 'games'] },
  { key: 'washroom', label: 'Attached washroom', match: ['attached bath', 'attached washroom'] },
  { key: 'generator', label: 'Generator backup', match: ['generator'] },
];

export interface SearchFilters {
  route?: string;
  date?: string;
  guests?: number;
  ac: Ac;
  maxPrice?: number;
  sizes: SizeKey[];
  rating?: number;
  amenities: string[];
  sort: Sort;
}

/** Read the filter model out of the URL. The URL is the single source of truth. */
export function filtersFromParams(params: URLSearchParams): SearchFilters {
  const acRaw = params.get('ac');
  const ac: Ac = acRaw === 'ac' || acRaw === 'nonac' ? acRaw : 'both';

  const sortRaw = params.get('sort');
  const sort: Sort =
    sortRaw === 'price_asc' ||
    sortRaw === 'price_desc' ||
    sortRaw === 'rating' ||
    sortRaw === 'reviews'
      ? sortRaw
      : 'recommended';

  const num = (key: string): number | undefined => {
    const raw = params.get(key);
    if (raw == null) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  const sizes = (params.get('size') ?? '')
    .split(',')
    .filter((s): s is SizeKey => SIZE_BUCKETS.some((b) => b.key === s));

  const amenities = (params.get('amenities') ?? '')
    .split(',')
    .filter((a) => AMENITIES.some((x) => x.key === a));

  return {
    route: params.get('route') ?? undefined,
    date: params.get('date') ?? undefined,
    guests: num('guests'),
    ac,
    maxPrice: num('maxPrice'),
    rating: num('rating'),
    sizes,
    amenities,
    sort,
  };
}

/** True when a boat carries every requested amenity. */
function matchesAmenities(boat: SearchBoat, keys: string[]): boolean {
  if (keys.length === 0) return true;
  const haystack = (boat.facilities ?? []).join(' ').toLowerCase();
  return keys.every((key) => {
    const spec = AMENITIES.find((a) => a.key === key);
    return spec ? spec.match.some((m) => haystack.includes(m)) : true;
  });
}

/** True when a boat's capacity falls in any of the selected size buckets. */
function matchesSize(boat: SearchBoat, sizes: SizeKey[]): boolean {
  if (sizes.length === 0) return true;
  return sizes.some((key) => {
    const b = SIZE_BUCKETS.find((x) => x.key === key);
    return b ? boat.maxCapacity >= b.min && boat.maxCapacity <= b.max : true;
  });
}

/** Apply every filter except `sort`. Order is preserved (newest-first). */
export function applyFilters(boats: SearchBoat[], f: SearchFilters): SearchBoat[] {
  const routeNeedle = f.route?.toLowerCase();

  return boats.filter((b) => {
    if (routeNeedle) {
      const hit = b.routes.some(
        (r) =>
          r.route.name.toLowerCase().includes(routeNeedle) ||
          (r.route.region ?? '').toLowerCase().includes(routeNeedle),
      );
      if (!hit) return false;
    }
    if (f.ac === 'ac' && !b.hasAc) return false;
    if (f.ac === 'nonac' && !b.hasNonAc) return false;
    if (f.guests != null && b.maxCapacity < f.guests) return false;
    // Un-priced boats drop out of an explicit price filter, matching the
    // backend's own behaviour when maxPrice is set.
    if (f.maxPrice != null && (b.priceFrom == null || b.priceFrom > f.maxPrice)) return false;
    if (f.rating != null && (b.ratingAvg == null || b.ratingAvg < f.rating)) return false;
    if (!matchesSize(b, f.sizes)) return false;
    if (!matchesAmenities(b, f.amenities)) return false;
    return true;
  });
}

/** Sort a filtered list. 'recommended' keeps the server's newest-first order. */
export function sortBoats(boats: SearchBoat[], sort: Sort): SearchBoat[] {
  const byPrice = (a: SearchBoat, b: SearchBoat) =>
    (a.priceFrom ?? Infinity) - (b.priceFrom ?? Infinity);
  switch (sort) {
    case 'price_asc':
      return [...boats].sort(byPrice);
    case 'price_desc':
      return [...boats].sort((a, b) => byPrice(b, a));
    case 'rating':
      return [...boats].sort((a, b) => (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0));
    case 'reviews':
      return [...boats].sort((a, b) => b.reviewCount - a.reviewCount);
    default:
      return boats;
  }
}

/** Distinct destinations across the whole catalogue, with result counts. */
export function destinationFacets(
  boats: SearchBoat[],
): { name: string; region: string | null; count: number }[] {
  const seen = new Map<string, { name: string; region: string | null; count: number }>();
  for (const b of boats) {
    // A boat serving the same route twice must only count once.
    const names = new Set(b.routes.map((r) => r.route.name));
    for (const name of names) {
      const region = b.routes.find((r) => r.route.name === name)?.route.region ?? null;
      const row = seen.get(name);
      if (row) row.count += 1;
      else seen.set(name, { name, region, count: 1 });
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.count - a.count);
}

/** Price slider bounds derived from the data, not hardcoded. */
export function priceBounds(boats: SearchBoat[]): { min: number; max: number } {
  const prices = boats.map((b) => b.priceFrom).filter((p): p is number => p != null && p > 0);
  if (prices.length === 0) return { min: 0, max: 0 };
  const min = Math.floor(Math.min(...prices) / 100) * 100;
  const max = Math.ceil(Math.max(...prices) / 100) * 100;
  // A flat catalogue (one price) would give a zero-width slider.
  return min === max ? { min, max: max + 100 } : { min, max };
}
