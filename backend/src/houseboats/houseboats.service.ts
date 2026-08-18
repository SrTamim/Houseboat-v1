import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { StorageService } from '../storage/storage.service';

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
        _count: { select: { reviews: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Public search over live boats. Price/AC/capacity live per-cabin-category and
   * per-pricing-rule, and availability per-departure — none are boat-level — so
   * this rolls those up into a boat-level summary the search cards need, then
   * filters + sorts in memory. The live-boat set is small (public catalogue), so
   * a rollup-then-filter is fine; revisit with a denormalized summary if it grows.
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
    const boats = await this.prisma.houseboat.findMany({
      where: {
        status: 'live',
        ...(q.route
          ? {
              routes: {
                some: {
                  route: {
                    OR: [
                      { id: q.route },
                      { region: { contains: q.route, mode: 'insensitive' } },
                      { name: { contains: q.route, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        safetyFeatures: true,
        createdAt: true,
        routes: { select: { route: { select: { name: true, region: true } } } },
        _count: { select: { reviews: true } },
        cabinCategories: {
          select: {
            id: true,
            isAc: true,
            baseCapacity: true,
            extendedCapacity: true,
          },
        },
        // Min per-person price across the boat's default profile rules = "from".
        pricingProfiles: {
          where: { isDefault: true },
          select: { rules: { select: { pricePerPerson: true } } },
        },
        reviews: { select: { rating: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Availability-by-date: which boats have a scheduled, bookable departure
    // on/after the requested date. One grouped query, not N per boat.
    let availableBoatIds: Set<string> | null = null;
    if (q.date) {
      const from = new Date(q.date);
      if (!Number.isNaN(from.getTime())) {
        const deps = await this.prisma.tripDeparture.findMany({
          where: {
            status: 'scheduled',
            availableCount: { gt: 0 },
            startDate: { gte: from },
            package: { houseboat: { status: 'live' } },
          },
          select: { package: { select: { houseboatId: true } } },
        });
        availableBoatIds = new Set(deps.map((d) => d.package.houseboatId));
      }
    }

    const rows = boats.map((b) => {
      const prices = b.pricingProfiles
        .flatMap((p) => p.rules)
        .map((r) => Number(r.pricePerPerson))
        .filter((n) => n > 0);
      const priceFrom = prices.length ? Math.min(...prices) : null;
      const hasAc = b.cabinCategories.some((c) => c.isAc);
      const hasNonAc = b.cabinCategories.some((c) => !c.isAc);
      const maxCapacity = b.cabinCategories.reduce(
        (m, c) => Math.max(m, c.extendedCapacity ?? c.baseCapacity),
        0,
      );
      const ratingCount = b.reviews.length;
      const ratingAvg = ratingCount
        ? b.reviews.reduce((s, r) => s + r.rating, 0) / ratingCount
        : null;
      return {
        id: b.id,
        name: b.name,
        slug: b.slug,
        description: b.description,
        safetyFeatures: b.safetyFeatures,
        routes: b.routes,
        reviewCount: b._count.reviews,
        priceFrom,
        hasAc,
        hasNonAc,
        maxCapacity,
        cabinCount: b.cabinCategories.length,
        ratingAvg,
      };
    });

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

    const sorted = this.sortSearch(filtered, q.sort);
    return sorted;
  }

  private sortSearch<
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
        return [...rows].sort(
          (a, b) => (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0),
        );
      default:
        return rows; // already newest-first from the query
    }
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
        _count: { select: { reviews: true } },
        reviews: {
          select: {
            id: true,
            rating: true,
            text: true,
            customer: { select: { name: true } },
          },
          take: 6,
        },
      },
    });

    if (!boat) {
      throw new NotFoundException(`No live houseboat found for "${slug}"`);
    }

    // Rating rolled up the same way `search` does (lines 139–142), so a boat
    // shows an identical score on the results grid and on its detail page.
    const ratingCount = boat.reviews.length;
    const ratingAvg = ratingCount
      ? boat.reviews.reduce((s, r) => s + r.rating, 0) / ratingCount
      : null;

    // storageKey → public URL via StorageService, never by string concatenation:
    // the local dev driver returns a root-relative /uploads/* path so uploaded
    // images stay same-origin and satisfy CSP `img-src 'self'`.
    const urls = (rows: { storageKey: string | null }[]) =>
      rows.map((m) => m.storageKey).filter((k): k is string => !!k).map((k) => this.storage.publicUrl(k));

    return {
      ...boat,
      media: undefined,
      photos: urls(boat.media),
      ratingAvg,
      reviewCount: boat._count.reviews,
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
