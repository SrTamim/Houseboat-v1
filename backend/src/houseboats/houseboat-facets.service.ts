import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Keeps the denormalized search facets on Houseboat fresh:
 *   minPricePerPerson, maxCapacity, hasAc, hasNonAc, ratingAvg, reviewCount,
 *   amenitiesText.
 *
 * These let GET /houseboats/search filter/sort/paginate in the DB instead of
 * reading the whole live catalogue per request. The rollups here are the SAME
 * ones houseboats.service.ts search() computed per request, so search and boat
 * detail stay consistent.
 *
 * recompute() is called from every mutation that changes an input (pricing
 * rules, cabin categories, reviews). A nightly cron re-derives all live boats as
 * a backstop against any missed hook.
 *
 * Global (see HouseboatFacetsModule) so pricing/assets/ops/platform can inject
 * it without import churn or circular deps.
 */
@Injectable()
export class HouseboatFacetsService {
  private readonly logger = new Logger(HouseboatFacetsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recompute and persist all facets for one boat. Pass `tx` to run inside the
   * caller's transaction (so the mutation and the facet update commit together);
   * otherwise it runs on its own connection.
   */
  async recompute(
    houseboatId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const db = tx ?? this.prisma;

    const boat = await db.houseboat.findUnique({
      where: { id: houseboatId },
      select: {
        cabinCategories: {
          select: {
            isAc: true,
            baseCapacity: true,
            extendedCapacity: true,
            facilities: true,
          },
        },
        // Min per-person price across the DEFAULT profile's rules only — mirrors
        // search()'s original "from" semantics.
        pricingProfiles: {
          where: { isDefault: true },
          select: { rules: { select: { pricePerPerson: true } } },
        },
        reviews: { where: { hidden: false }, select: { rating: true } },
      },
    });
    if (!boat) return;

    const prices = boat.pricingProfiles
      .flatMap((p) => p.rules)
      .map((r) => Number(r.pricePerPerson))
      .filter((n) => n > 0);
    const minPricePerPerson = prices.length
      ? new Prisma.Decimal(Math.min(...prices))
      : null;

    const hasAc = boat.cabinCategories.some((c) => c.isAc);
    const hasNonAc = boat.cabinCategories.some((c) => !c.isAc);
    const maxCapacity = boat.cabinCategories.reduce(
      (m, c) => Math.max(m, c.extendedCapacity ?? c.baseCapacity),
      0,
    );

    const reviewCount = boat.reviews.length;
    const ratingAvg = reviewCount
      ? boat.reviews.reduce((s, r) => s + r.rating, 0) / reviewCount
      : null;

    // Space-joined, lowercased amenity text for a cheap `contains` match. Falls
    // back to null when no category has facilities, so the column reads NULL
    // rather than an empty string.
    const amenityText = boat.cabinCategories
      .map((c) => (c.facilities ?? '').trim())
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    await db.houseboat.update({
      where: { id: houseboatId },
      data: {
        minPricePerPerson,
        maxCapacity,
        hasAc,
        hasNonAc,
        ratingAvg,
        reviewCount,
        amenitiesText: amenityText || null,
      },
    });
  }

  /** Recompute facets for every live boat — nightly backstop for missed hooks. */
  private running = false;

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async recomputeAllLive(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const boats = await this.prisma.houseboat.findMany({
        where: { status: 'live' },
        select: { id: true },
      });
      for (const b of boats) {
        await this.recompute(b.id);
      }
      if (boats.length) {
        this.logger.log(`Recomputed search facets for ${boats.length} live boats`);
      }
    } catch (e) {
      this.logger.warn(`Facet backstop failed: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
