import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { StorageService } from '../storage/storage.service';

/**
 * Capacity ranges for the sidebar size chips. MIRRORS frontend
 * src/app/(customer)/search/filters.ts SIZE_BUCKETS — keep the two in sync.
 * `max: null` = open-ended (Large).
 */
const SIZE_BUCKET_RANGES: Record<string, { min: number; max: number | null }> = {
  small: { min: 0, max: 12 },
  medium: { min: 13, max: 30 },
  large: { min: 31, max: null },
};

/**
 * Amenity keyword synonyms, matched (case-insensitive substring) against the
 * rolled-up amenitiesText. MIRRORS frontend filters.ts AMENITIES[].match — keep
 * in sync. A boat matches a selected amenity if ANY synonym appears; all
 * selected amenities must match (AND across keys, OR within a key).
 */
const AMENITY_SYNONYMS: Record<string, string[]> = {
  meals: ['meal', 'food', 'buffet'],
  balcony: ['balcony', 'balconies'],
  swing: ['swing'],
  games: ['game', 'games'],
  washroom: ['attached bath', 'attached washroom'],
  generator: ['generator'],
};

/** Shared select for a search card — reads the denormalized boat-level facets. */
const SEARCH_CARD_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  safetyFeatures: true,
  createdAt: true,
  routes: { select: { route: { select: { name: true, region: true } } } },
  minPricePerPerson: true,
  maxCapacity: true,
  hasAc: true,
  hasNonAc: true,
  ratingAvg: true,
  reviewCount: true,
  amenitiesText: true,
  _count: { select: { cabinCategories: true } },
} satisfies Prisma.HouseboatSelect;

type SearchCardRow = Prisma.HouseboatGetPayload<{ select: typeof SEARCH_CARD_SELECT }>;

/** Matches a canonical UUID, so a plain name is never cast to Route.id (@db.Uuid). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A route/region/name substring filter, shared by both search paths.
 *
 * The frontend sends `route` as the destination NAME, not an id, so the id-match
 * only runs when `route` is a well-formed UUID. Route.id is `@db.Uuid`; matching
 * it against a name would make Postgres try to cast the name to uuid and abort
 * the whole query ("invalid input syntax for type uuid"), which returned 500 and
 * left the search grid empty.
 */
function routeWhere(route: string): Prisma.HouseboatWhereInput['routes'] {
  return {
    some: {
      route: {
        OR: [
          ...(UUID_RE.test(route) ? [{ id: route }] : []),
          { region: { contains: route, mode: 'insensitive' as const } },
          { name: { contains: route, mode: 'insensitive' as const } },
        ],
      },
    },
  };
}

/**
 * Map a boat row to the search card the frontend expects. Response keys stay
 * `priceFrom`/`cabinCount`/`facilities` (NOT the DB column names) — the customer
 * cards (SearchBoatCard, BoatCard) depend on these names.
 */
function toSearchCard(b: SearchCardRow) {
  return {
    id: b.id,
    name: b.name,
    slug: b.slug,
    description: b.description,
    safetyFeatures: b.safetyFeatures,
    routes: b.routes,
    reviewCount: b.reviewCount,
    priceFrom: b.minPricePerPerson != null ? Number(b.minPricePerPerson) : null,
    hasAc: b.hasAc,
    hasNonAc: b.hasNonAc,
    maxCapacity: b.maxCapacity,
    cabinCount: b._count.cabinCategories,
    ratingAvg: b.ratingAvg,
    // Amenities were previously never returned (dead filter); expose the rolled-up
    // list so the amenity filter actually matches.
    facilities: b.amenitiesText
      ? b.amenitiesText.split(/\s+/).filter(Boolean)
      : [],
  };
}

/** In-memory sort for the flat catalogue path (small live set). */
function sortSearchCards<
  T extends { priceFrom: number | null; ratingAvg: number | null },
>(rows: T[], sort?: string): T[] {
  const byPrice = (a: T, b: T) =>
    (a.priceFrom ?? Infinity) - (b.priceFrom ?? Infinity);
  switch (sort) {
    case 'price_asc':
      return [...rows].sort(byPrice);
    case 'price_desc':
      return [...rows].sort((a, b) => byPrice(b, a));
    case 'rating':
      return [...rows].sort((a, b) => (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0));
    default:
      return rows; // already newest-first from the query
  }
}

/** Map a sort key to an indexed orderBy for the DB-side results query. */
function searchOrderBy(sort?: string): Prisma.HouseboatOrderByWithRelationInput {
  switch (sort) {
    case 'price_asc':
      return { minPricePerPerson: { sort: 'asc', nulls: 'last' } };
    case 'price_desc':
      return { minPricePerPerson: { sort: 'desc', nulls: 'last' } };
    case 'rating':
      return { ratingAvg: { sort: 'desc', nulls: 'last' } };
    case 'reviews':
      return { reviewCount: 'desc' };
    default:
      return { createdAt: 'desc' }; // newest / recommended
  }
}

/**
 * Public-facing houseboat read model. Only `live` boats are ever exposed
 * to customers — draft/pending/suspended stay invisible on the public site.
 */
@Injectable()
export class HouseboatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly storage: StorageService,
  ) {}

  /** Resolve a live boat's id from its public slug, or 404. */
  private async liveBoatId(slug: string): Promise<string> {
    const boat = await this.prisma.houseboat.findFirst({
      where: { slug, status: 'live' },
      select: { id: true },
    });
    if (!boat) throw new NotFoundException(`No live houseboat found for "${slug}"`);
    return boat.id;
  }

  /** List boats bookable by the public. */
  async listLive() {
    return this.prisma.houseboat.findMany({
      where: { status: 'live' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        safetyFeatures: true,
        createdAt: true,
        routes: {
          select: { route: { select: { name: true, region: true } } },
        },
        // Public review count excludes platform-hidden reviews.
        _count: { select: { reviews: { where: { hidden: false } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Backward-compatible flat-array search used by the home page (HomeHero +
   * FeaturedBoats fetch it with no params). Reads the denormalized facets and
   * filters/sorts in memory over the small live set. The scalable, paginated,
   * faceted path is searchResults() below — do NOT change this method's flat
   * `SearchBoat[]` shape or the home page breaks.
   */
  async search(q: {
    route?: string;
    date?: string;
    ac?: 'ac' | 'nonac' | 'both';
    minPrice?: number;
    maxPrice?: number;
    guests?: number;
    sort?: 'price_asc' | 'price_desc' | 'rating' | 'newest';
  }) {
    // Unfiltered flat-array catalogue read used by the home page (HomeHero
    // destination chips + FeaturedBoats). Kept backward-compatible on purpose:
    // the filtered/paginated/faceted path lives in searchResults() below. Facets
    // are read from the denormalized columns (no per-request rollup) and mapped
    // back to the legacy response keys (priceFrom/cabinCount) the cards expect.
    const boats = await this.prisma.houseboat.findMany({
      where: {
        status: 'live',
        ...(q.route ? { routes: routeWhere(q.route) } : {}),
      },
      select: SEARCH_CARD_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    // Availability-by-date: which boats have a scheduled, bookable departure
    // on/after the requested date. One grouped query, not N per boat.
    let availableBoatIds: Set<string> | null = null;
    if (q.date) {
      availableBoatIds = await this.availableBoatIdsFrom(q.date);
    }

    const rows = boats.map(toSearchCard);
    const filtered = rows.filter((r) => {
      if (q.ac === 'ac' && !r.hasAc) return false;
      if (q.ac === 'nonac' && !r.hasNonAc) return false;
      if (q.minPrice != null && (r.priceFrom == null || r.priceFrom < q.minPrice)) {
        return false;
      }
      if (q.maxPrice != null && (r.priceFrom == null || r.priceFrom > q.maxPrice)) {
        return false;
      }
      if (q.guests != null && r.maxCapacity < q.guests) return false;
      if (availableBoatIds && !availableBoatIds.has(r.id)) return false;
      return true;
    });
    return sortSearchCards(filtered, q.sort);
  }

  /**
   * True when at least one bookable departure lands ON the exact `date` (the
   * `[date, date+1)` day window). Distinct from availableBoatIdsFrom's `gte`
   * fallback: search shows on/after-date boats, so without this the user can't
   * tell their chosen day was actually empty. Same predicate as the fallback so
   * the two stay consistent. `startDate` is @db.Date; new Date('YYYY-MM-DD') is
   * UTC midnight, matching the stored date boundaries.
   */
  private async exactDateHasDepartures(date: string): Promise<boolean> {
    const from = new Date(date);
    if (Number.isNaN(from.getTime())) return false;
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 1);
    const n = await this.prisma.tripDeparture.count({
      where: {
        status: 'scheduled',
        availableCount: { gt: 0 },
        startDate: { gte: from, lt: to },
        package: { houseboat: { status: 'live' } },
      },
    });
    return n > 0;
  }

  /** Grouped one-shot: boat ids with a bookable departure on/after `date`. */
  private async availableBoatIdsFrom(date: string): Promise<Set<string> | null> {
    const from = new Date(date);
    if (Number.isNaN(from.getTime())) return null;
    const deps = await this.prisma.tripDeparture.findMany({
      where: {
        status: 'scheduled',
        availableCount: { gt: 0 },
        startDate: { gte: from },
        package: { houseboat: { status: 'live' } },
      },
      select: { package: { select: { houseboatId: true } } },
    });
    return new Set(deps.map((d) => d.package.houseboatId));
  }

  /**
   * DB-side filtered + sorted + paginated search backing the results page.
   *
   * Every filter is a real WHERE against the denormalized facets (or a relation
   * for route/date), sort maps to an indexed column, and pagination is offset
   * (`page`/`pageSize`) since price/rating sorts can't ride the id cursor helper.
   * Returns the flat cards plus `total` (for the numbered pager) and `facets`
   * (so the sidebar counts/price bounds don't need the whole catalogue).
   */
  async searchResults(q: {
    route?: string;
    date?: string;
    ac?: 'ac' | 'nonac' | 'both';
    minPrice?: number;
    maxPrice?: number;
    guests?: number;
    rating?: number;
    amenities?: string[];
    /** Size-bucket keys from the sidebar chips (small/medium/large). */
    sizes?: string[];
    sort?: string;
    page?: number;
    pageSize?: number;
  }) {
    const pageSize = Math.min(Math.max(q.pageSize ?? 9, 1), 60);
    const page = Math.max(q.page ?? 1, 1);

    // Date availability narrows to a boat-id set (relation filter would need a
    // nested availableCount>0 some — the grouped set is cheaper and reused).
    const availableIds =
      q.date != null ? await this.availableBoatIdsFrom(q.date) : null;

    const where: Prisma.HouseboatWhereInput = {
      status: 'live',
      ...(q.route ? { routes: routeWhere(q.route) } : {}),
      ...(q.ac === 'ac' ? { hasAc: true } : {}),
      ...(q.ac === 'nonac' ? { hasNonAc: true } : {}),
      // min + max share one column — merge into a single range, else the second
      // spread would clobber the first and drop a bound.
      ...(q.minPrice != null || q.maxPrice != null
        ? {
            minPricePerPerson: {
              ...(q.minPrice != null ? { gte: q.minPrice } : {}),
              ...(q.maxPrice != null ? { lte: q.maxPrice } : {}),
            },
          }
        : {}),
      ...(q.guests != null ? { maxCapacity: { gte: q.guests } } : {}),
      // Size buckets = union of capacity ranges; a boat matching ANY selected
      // bucket qualifies. Ranges mirror the frontend SIZE_BUCKETS (filters.ts) —
      // kept here too so the DB WHERE is self-contained; keep the two in sync.
      ...(() => {
        const ranges = (q.sizes ?? [])
          .map((k) => SIZE_BUCKET_RANGES[k])
          .filter((r): r is { min: number; max: number | null } => !!r);
        return ranges.length
          ? {
              OR: ranges.map((r) => ({
                maxCapacity:
                  r.max != null ? { gte: r.min, lte: r.max } : { gte: r.min },
              })),
            }
          : {};
      })(),
      ...(q.rating != null ? { ratingAvg: { gte: q.rating } } : {}),
      // Each selected amenity must match ANY of its synonyms (OR within a key),
      // and all selected amenities must match (AND across keys).
      ...(() => {
        const clauses = (q.amenities ?? [])
          .map((key) => AMENITY_SYNONYMS[key] ?? [key.toLowerCase()])
          .map((syns) => ({
            OR: syns.map((s) => ({
              amenitiesText: { contains: s, mode: 'insensitive' as const },
            })),
          }));
        return clauses.length ? { AND: clauses } : {};
      })(),
      ...(availableIds ? { id: { in: [...availableIds] } } : {}),
    };

    const [total, boats] = await Promise.all([
      this.prisma.houseboat.count({ where }),
      this.prisma.houseboat.findMany({
        where,
        select: SEARCH_CARD_SELECT,
        orderBy: searchOrderBy(q.sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const [facets, dateExactEmpty] = await Promise.all([
      this.searchFacets(),
      // Only meaningful when a date was chosen: true = nothing departs ON that
      // exact day, so the grid (gte fallback) is showing later dates.
      q.date != null
        ? this.exactDateHasDepartures(q.date).then((has) => !has)
        : Promise.resolve(false),
    ]);
    return {
      items: boats.map(toSearchCard),
      total,
      page,
      pageSize,
      facets,
      dateExactEmpty,
    };
  }

  /**
   * Sidebar facets over the FULL live set (independent of the current filter, so
   * options never read 0 merely because another group is narrowing). Price
   * bounds + distinct destinations; size/amenity counts are derived client-side
   * from the returned items today, so only the always-needed aggregates are here.
   */
  private async searchFacets() {
    const [agg, routeRows] = await Promise.all([
      this.prisma.houseboat.aggregate({
        where: { status: 'live', minPricePerPerson: { not: null } },
        _min: { minPricePerPerson: true },
        _max: { minPricePerPerson: true },
      }),
      this.prisma.houseboatRoute.findMany({
        where: { houseboat: { status: 'live' } },
        select: { route: { select: { name: true, region: true } } },
      }),
    ]);

    const destSeen = new Map<string, { label: string; sub: string }>();
    for (const r of routeRows) {
      const name = r.route?.name;
      if (name && !destSeen.has(name)) {
        destSeen.set(name, { label: name, sub: r.route?.region ?? '' });
      }
    }
    return {
      priceMin: agg._min.minPricePerPerson
        ? Number(agg._min.minPricePerPerson)
        : null,
      priceMax: agg._max.minPricePerPerson
        ? Number(agg._max.minPricePerPerson)
        : null,
      destinations: [...destSeen.values()],
    };
  }

  /** Public boat detail by slug. */
  async getBySlug(slug: string) {
    const boat = await this.prisma.houseboat.findFirst({
      where: { slug, status: 'live' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        safetyFeatures: true,
        cancellationPolicy: true,
        foodMenu: true,
        childPolicy: true,
        // Boat-level gallery only: cabin-scoped rows carry a cabinId and are
        // selected per-cabin below.
        media: {
          where: { kind: 'image', cabinId: null },
          select: { storageKey: true },
          orderBy: { sortOrder: 'asc' },
        },
        decks: {
          select: {
            id: true,
            name: true,
            position: true,
            cabins: {
              select: {
                id: true,
                name: true,
                gridRow: true,
                gridCol: true,
                media: {
                  where: { kind: 'image' },
                  select: { storageKey: true },
                  orderBy: { sortOrder: 'asc' },
                },
                category: {
                  select: {
                    name: true,
                    isAc: true,
                    baseCapacity: true,
                    extendedCapacity: true,
                    facilities: true,
                    pricingRules: { select: { pricePerPerson: true } },
                  },
                },
              },
            },
          },
          orderBy: { position: 'asc' },
        },
        routes: {
          select: { route: { select: { name: true, region: true } } },
        },
        // Rating/count read from the denormalized facets so the detail page and
        // the search grid show an IDENTICAL score (the facet is the mean over all
        // non-hidden reviews, kept fresh by HouseboatFacetsService). The reviews
        // list below is only the recent sample shown on the page.
        ratingAvg: true,
        reviewCount: true,
        reviews: {
          where: { hidden: false },
          select: {
            id: true,
            rating: true,
            text: true,
            ownerReply: true,
            customer: { select: { name: true } },
          },
          take: 6,
        },
      },
    });

    if (!boat) {
      throw new NotFoundException(`No live houseboat found for "${slug}"`);
    }

    // storageKey → public URL via StorageService, never by string concatenation:
    // the local dev driver returns a root-relative /uploads/* path so uploaded
    // images stay same-origin and satisfy CSP `img-src 'self'`.
    const urls = (rows: { storageKey: string | null }[]) =>
      rows.map((m) => m.storageKey).filter((k): k is string => !!k).map((k) => this.storage.publicUrl(k));

    return {
      ...boat,
      media: undefined,
      // ratingAvg + reviewCount come straight from the selected facet columns.
      photos: urls(boat.media),
      decks: boat.decks.map((d) => ({
        ...d,
        cabins: d.cabins.map((c) => {
          const prices = c.category.pricingRules
            .map((r) => Number(r.pricePerPerson))
            .filter((n) => n > 0);
          const { pricingRules, ...category } = c.category;
          return {
            ...c,
            media: undefined,
            photos: urls(c.media),
            pricePerPerson: prices.length ? Math.min(...prices) : null,
            category,
          };
        }),
      })),
    };
  }

  /**
   * Per-cabin availability snapshot for one departure — the seed state the boat
   * detail page needs, since TripDeparture.availableCount is only a single
   * free-cabin COUNT, not which cabins are free. The client applies live `/rt`
   * `cabin` socket deltas on top of this snapshot.
   *
   * A cabin is:
   *   - `held_by_me`    — a live hold owned by THIS viewer (account or hb_gid).
   *   - `held_by_other` — a live hold owned by someone else. Temporary: it
   *                       expires in ~10 minutes and the cabin usually comes
   *                       back, which is why it is not lumped in with `booked`.
   *   - `booked`    — a confirmed booking_cabin that is not an open seat (the
   *                   room is genuinely sold).
   *   - `open_seat` — a confirmed booking_cabin flagged isOpenSeat with spare
   *                   capacity left; `spare` = capacity − current occupancy.
   *   - `available` — no live hold and no booking_cabin.
   *
   * `held_by_me` exists because this snapshot is the boat page's seed state, and
   * a hold is invisible in it otherwise: reporting the viewer's OWN cabin as
   * "booked" made their selection read as fully booked after a reload, flash
   * booked for a moment while their own hold request was in flight, and stay
   * booked for up to a minute after expiry while the sweeper caught up. The
   * client cannot tell the difference on its own — only the server knows who
   * owns the row.
   *
   * `viewer` is optional: an anonymous caller (no session, no hb_gid cookie)
   * matches no hold, so every branch returns exactly what it did before.
   *
   * Only reads live/scheduled departures of a live boat; 404 otherwise so a
   * suspended boat's availability can't be probed.
   */
  async departureCabinAvailability(
    slug: string,
    departureId: string,
    viewer?: { accountId: string | null; guestToken: string | null },
  ) {
    const departure = await this.prisma.tripDeparture.findFirst({
      where: {
        id: departureId,
        package: { houseboat: { slug, status: 'live' } },
      },
      select: {
        id: true,
        availableCount: true,
        package: {
          select: {
            houseboatId: true,
            houseboat: {
              select: {
                decks: {
                  select: {
                    cabins: {
                      select: {
                        id: true,
                        category: {
                          select: {
                            baseCapacity: true,
                            extendedCapacity: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!departure) {
      throw new NotFoundException('Departure not found');
    }

    const now = new Date();
    const [bookingCabins, holds] = await Promise.all([
      // Cabins with a live (non-cancelled) booking on this departure.
      this.prisma.bookingCabin.findMany({
        where: {
          booking: { departureId, status: { not: 'cancelled' } },
        },
        select: { cabinId: true, occupancy: true, isOpenSeat: true },
      }),
      // Cabins currently held (unexpired) by anyone. The owner columns come
      // along so a hold can be attributed to the viewer rather than lumped in
      // with everyone else's.
      this.prisma.cabinHold.findMany({
        where: { departureId, state: 'held', expiresAt: { gt: now } },
        select: {
          id: true,
          cabinId: true,
          heldBy: true,
          heldByToken: true,
          expiresAt: true,
        },
      }),
    ]);

    const holdByCabin = new Map(holds.map((h) => [h.cabinId, h]));
    const bookingByCabin = new Map(
      bookingCabins.map((bc) => [bc.cabinId, bc]),
    );
    /**
     * Whose hold this is. Null owners never match: an anonymous viewer has no
     * accountId and no guestToken, so `null === null` must not be allowed to
     * hand them someone else's cabin.
     */
    const ownedByViewer = (hold: {
      heldBy: string | null;
      heldByToken: string | null;
    }) => {
      if (!viewer) return false;
      if (hold.heldBy && viewer.accountId) return hold.heldBy === viewer.accountId;
      if (hold.heldByToken && viewer.guestToken) {
        return hold.heldByToken === viewer.guestToken;
      }
      return false;
    };

    const allCabins = departure.package.houseboat.decks.flatMap((d) => d.cabins);
    const cabins = allCabins.map((cabin) => {
      const hold = holdByCabin.get(cabin.id);
      if (hold) {
        return ownedByViewer(hold)
          ? {
              cabinId: cabin.id,
              state: 'held_by_me' as const,
              spare: 0,
              // The viewer's own countdown, so the page can resume the real
              // remaining time after a reload without a second request.
              holdExpiresAt: hold.expiresAt,
              // Only ever sent to the account/browser that owns the row — the
              // same id their own POST /booking/hold returned. The page needs it
              // to release the cabin on deselect and to convert it at checkout.
              holdId: hold.id,
            }
          : // Someone else's hold — temporary (10 min) and usually lapses, so it
            // is NOT the same as a sold cabin. Kept distinct from `booked` so the
            // page can say "on hold by another guest" instead of "fully booked".
            // No holdId/expiresAt/owner: a stranger's hold identity and countdown
            // are not this viewer's business.
            { cabinId: cabin.id, state: 'held_by_other' as const, spare: 0 };
      }
      const bc = bookingByCabin.get(cabin.id);
      if (bc) {
        if (bc.isOpenSeat) {
          const cap =
            cabin.category.extendedCapacity ?? cabin.category.baseCapacity;
          const spare = Math.max(cap - bc.occupancy, 0);
          return spare > 0
            ? { cabinId: cabin.id, state: 'open_seat' as const, spare }
            : { cabinId: cabin.id, state: 'booked' as const, spare: 0 };
        }
        return { cabinId: cabin.id, state: 'booked' as const, spare: 0 };
      }
      return { cabinId: cabin.id, state: 'available' as const, spare: 0 };
    });

    return { departureId: departure.id, availableCount: departure.availableCount, cabins };
  }

  /**
   * Public upcoming departures for a boat, optionally within [from, to]. Returns
   * the bookable units the boat page + search need: date/times, duration, live
   * availableCount, and a route/ghat summary from the package. Only
   * `scheduled` future departures of a live boat.
   */
  async listDepartures(slug: string, from?: Date, to?: Date) {
    const houseboatId = await this.liveBoatId(slug);
    const startDate: { gte: Date; lte?: Date } = {
      gte: from ?? new Date(),
    };
    if (to) startDate.lte = to;

    const departures = await this.prisma.tripDeparture.findMany({
      where: {
        status: 'scheduled',
        startDate,
        package: { houseboatId },
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        departureTime: true,
        arrivalTime: true,
        availableCount: true,
        package: {
          select: {
            durationDays: true,
            durationLabel: true,
            departureGhat: true,
            returnGhat: true,
            route: { select: { name: true, region: true } },
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });
    return departures;
  }

  /** Public full-boat group buyout bands for the boat page's group UI. */
  async listGroupBands(slug: string) {
    const houseboatId = await this.liveBoatId(slug);
    return this.pricing.listGroupBands(houseboatId);
  }
}
