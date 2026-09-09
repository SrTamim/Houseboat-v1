import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { HouseboatFacetsService } from '../houseboats/houseboat-facets.service';
import { newId } from '../common/uuid';
import { Money, money } from '../common/money';
import {
  CreatePricingProfileDto,
  GroupBandDto,
  PRICE_TYPES,
  PriceType,
  UpsertRoutePricingDto,
} from './dto/pricing.dto';

const TYPE_NAMES: Record<PriceType, string> = {
  general: 'General Day',
  weekend: 'Weekend',
  holiday: 'Holiday',
};

/** Bangladesh weekend = Friday(5) + Saturday(6). Dates are stored date-only (UTC). */
function isBdWeekend(iso: string): boolean {
  return [5, 6].includes(new Date(iso).getUTCDay());
}

/**
 * Pricing. Plan §1:
 *  - Each profile owns a FULL independent price table (not a multiplier).
 *  - Owner sets a price for every headcount a room can hold.
 *  - Two profiles claiming the same date is a config error → reject ON SAVE.
 *  - A price must exist for every occupancy a category supports → warn on save.
 */
@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    // @Optional so unit specs can construct with just prisma+audit; the facet
    // refresh is skipped there and covered by the nightly backstop in prod.
    @Optional()
    private readonly facets?: HouseboatFacetsService,
  ) {}

  /** Create a profile + its full price table. Rejects date collisions. */
  async createProfile(
    houseboatId: string,
    actorId: string,
    dto: CreatePricingProfileDto,
  ) {
    const dates = (dto.dates ?? []).map((d) => new Date(d));

    // Reject if any date is already claimed by another profile on this boat.
    if (dates.length > 0) {
      const clashing = await this.prisma.pricingProfile.findMany({
        where: { houseboatId },
        select: { name: true, dates: true },
      });
      const claimed = new Set(
        clashing.flatMap((p) => p.dates.map((d) => d.toISOString().slice(0, 10))),
      );
      const collision = dates
        .map((d) => d.toISOString().slice(0, 10))
        .find((d) => claimed.has(d));
      if (collision) {
        throw new BadRequestException(
          `Date ${collision} is already covered by another pricing profile`,
        );
      }
    }

    // A category must have a price for every occupancy 1..baseCapacity.
    await this.validateCoverage(houseboatId, dto);

    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.pricingProfile.create({
        data: {
          id: newId(),
          houseboatId,
          name: dto.name,
          isDefault: dto.isDefault ?? false,
          dates,
        },
      });
      await tx.pricingRule.createMany({
        data: dto.rules.map((r) => ({
          id: newId(),
          pricingProfileId: profile.id,
          cabinCategoryId: r.cabinCategoryId,
          occupancy: r.occupancy,
          pricePerPerson: r.pricePerPerson,
        })),
      });
      await this.audit.log(
        {
          houseboatId,
          actorAccountId: actorId,
          action: 'pricing_profile_create',
          entityType: 'pricing_profile',
          entityId: profile.id,
        },
        tx,
      );
      // Default-profile prices feed minPricePerPerson; refresh in-tx.
      await this.facets?.recompute(houseboatId, tx);
      return profile;
    });
  }

  /** Warn (reject) if a category is missing a price for any occupancy it holds. */
  private async validateCoverage(
    houseboatId: string,
    dto: CreatePricingProfileDto,
  ) {
    const categories = await this.prisma.houseboatCabinCategory.findMany({
      where: { houseboatId },
    });
    const priced = new Map<string, Set<number>>();
    for (const r of dto.rules) {
      if (!priced.has(r.cabinCategoryId)) priced.set(r.cabinCategoryId, new Set());
      priced.get(r.cabinCategoryId)!.add(r.occupancy);
    }
    for (const cat of categories) {
      const set = priced.get(cat.id);
      if (!set) continue; // category simply not priced in this profile — allowed
      for (let occ = 1; occ <= cat.baseCapacity; occ++) {
        if (!set.has(occ)) {
          throw new BadRequestException(
            `Category "${cat.name}" is missing a price for ${occ} person(s)`,
          );
        }
      }
    }
  }

  async listProfiles(houseboatId: string, activeRouteOnly = false) {
    if (!activeRouteOnly) {
      return this.prisma.pricingProfile.findMany({
        where: { houseboatId },
        include: { rules: true },
      });
    }

    // Active-route view (schedule page): show this route's profiles. Fall back to
    // legacy route-less profiles only when the route has none — mixing both would
    // duplicate names like "General Day" (one per-route + one route-less).
    const activeLink = await this.prisma.houseboatRoute.findFirst({
      where: { houseboatId },
      select: { routeId: true },
    });
    const routeProfiles = activeLink
      ? await this.prisma.pricingProfile.findMany({
          where: { houseboatId, routeId: activeLink.routeId },
          include: { rules: true },
        })
      : [];
    if (routeProfiles.length > 0) return routeProfiles;

    return this.prisma.pricingProfile.findMany({
      where: { houseboatId, routeId: null },
      include: { rules: true },
    });
  }

  // ── Per-route pricing (owner pricing page) ─────────────────
  /**
   * The three fixed price tables (general/weekend/holiday) for a boat+route.
   * Auto-provisions any missing type as an empty profile so the UI always has
   * three tables to edit. Returned in fixed order: general, weekend, holiday.
   */
  async listRoutePricing(houseboatId: string, routeId: string) {
    const existing = await this.prisma.pricingProfile.findMany({
      where: { houseboatId, routeId },
      include: { rules: true },
    });
    const byType = new Map(existing.map((p) => [p.priceType, p]));
    const missing = PRICE_TYPES.filter((t) => !byType.has(t));
    if (missing.length > 0) {
      await this.prisma.pricingProfile.createMany({
        data: missing.map((t) => ({
          id: newId(),
          houseboatId,
          routeId,
          priceType: t,
          name: TYPE_NAMES[t],
          isDefault: t === 'general',
          dates: [],
        })),
      });
    }
    const all = await this.prisma.pricingProfile.findMany({
      where: { houseboatId, routeId },
      include: { rules: true },
    });
    // Fixed order general → weekend → holiday.
    return PRICE_TYPES.map((t) => all.find((p) => p.priceType === t)!).filter(
      Boolean,
    );
  }

  /**
   * Upsert one route+type price table. Replaces that profile's rules wholesale
   * and updates its applicable dates. `general` is the route's default/fallback.
   */
  async upsertRoutePricing(
    houseboatId: string,
    actorId: string,
    dto: UpsertRoutePricingDto,
  ) {
    const dates = (dto.dates ?? []).map((d) => new Date(d));
    return this.prisma.$transaction(async (tx) => {
      let profile = await tx.pricingProfile.findFirst({
        where: { houseboatId, routeId: dto.routeId, priceType: dto.priceType },
      });
      if (!profile) {
        profile = await tx.pricingProfile.create({
          data: {
            id: newId(),
            houseboatId,
            routeId: dto.routeId,
            priceType: dto.priceType,
            name: TYPE_NAMES[dto.priceType],
            isDefault: dto.priceType === 'general',
            // Only holiday keeps a date list; weekend is weekday-driven, general is fallback.
            dates: dto.priceType === 'holiday' ? dates : [],
          },
        });
      } else {
        profile = await tx.pricingProfile.update({
          where: { id: profile.id },
          data: { dates: dto.priceType === 'holiday' ? dates : [] },
        });
      }
      // Replace the full rule table for this profile.
      await tx.pricingRule.deleteMany({ where: { pricingProfileId: profile.id } });
      if (dto.rules.length > 0) {
        await tx.pricingRule.createMany({
          data: dto.rules.map((r) => ({
            id: newId(),
            pricingProfileId: profile!.id,
            cabinCategoryId: r.cabinCategoryId,
            occupancy: r.occupancy,
            pricePerPerson: r.pricePerPerson,
          })),
        });
      }
      await this.audit.log(
        {
          houseboatId,
          actorAccountId: actorId,
          action: 'pricing_profile_upsert',
          entityType: 'pricing_profile',
          entityId: profile.id,
        },
        tx,
      );
      // Rule table for the (possibly default) profile changed → refresh in-tx.
      await this.facets?.recompute(houseboatId, tx);
      return profile;
    });
  }

  /**
   * Resolve the pricing profile that applies to a given date.
   *
   * When `routeId` is given (booking derives it from the departure's package),
   * route-scoped profiles resolve by priority:
   *   1. Holiday — the route's holiday profile listing this exact date wins
   *      (special days override everything, incl. a weekend).
   *   2. Weekend — the route's weekend profile IF the date is a BD weekend
   *      (Fri/Sat) and the owner has actually priced it.
   *   3. General — the route's default/fallback.
   * Falls back to the legacy boat-wide resolution so pre-route data and
   * free-form profiles (schedule page) still resolve.
   */
  async profileForDate(houseboatId: string, date: Date, routeId?: string | null) {
    const iso = date.toISOString().slice(0, 10);
    const profiles = await this.prisma.pricingProfile.findMany({
      where: { houseboatId },
      include: { rules: true },
    });
    const onDate = (p: (typeof profiles)[number]) =>
      p.dates.some((d) => d.toISOString().slice(0, 10) === iso);

    if (routeId) {
      const routeProfiles = profiles.filter((p) => p.routeId === routeId);
      if (routeProfiles.length > 0) {
        // 1. Holiday special date.
        const holiday = routeProfiles.find(
          (p) => p.priceType === 'holiday' && onDate(p),
        );
        if (holiday) return holiday;
        // 2. Weekend — Fri/Sat, only if the owner priced it.
        if (isBdWeekend(iso)) {
          const weekend = routeProfiles.find(
            (p) => p.priceType === 'weekend' && p.rules.length > 0,
          );
          if (weekend) return weekend;
        }
        // 3. General / default.
        const general =
          routeProfiles.find((p) => p.priceType === 'general') ??
          routeProfiles.find((p) => p.isDefault);
        if (general) return general;
      }
    }

    // Legacy / no-route fallback (unchanged behavior).
    const special = profiles.find(onDate);
    return special ?? profiles.find((p) => p.isDefault) ?? null;
  }

  /** Owner-set price for a category at an occupancy under the date's profile. */
  /** Owner-set per-person rate for this occupancy tier on this date. */
  async pricePerPersonFor(
    houseboatId: string,
    cabinCategoryId: string,
    occupancy: number,
    date: Date,
    routeId?: string | null,
  ): Promise<Money> {
    const profile = await this.profileForDate(houseboatId, date, routeId);
    if (!profile) {
      throw new NotFoundException('No pricing profile for this date');
    }
    const rule = profile.rules.find(
      (r) => r.cabinCategoryId === cabinCategoryId && r.occupancy === occupancy,
    );
    if (!rule) {
      throw new NotFoundException(
        `No price set for ${occupancy} person(s) in this cabin on ${date
          .toISOString()
          .slice(0, 10)}`,
      );
    }
    return money(rule.pricePerPerson);
  }

  async priceFor(
    houseboatId: string,
    cabinCategoryId: string,
    occupancy: number,
    date: Date,
    routeId?: string | null,
  ): Promise<Money> {
    // price_per_person × occupancy = room total for that room.
    const perPerson = await this.pricePerPersonFor(
      houseboatId,
      cabinCategoryId,
      occupancy,
      date,
      routeId,
    );
    return perPerson.mul(occupancy);
  }

  // ── Group price bands (full-boat buyout) ───────────────────
  addGroupBand(houseboatId: string, dto: GroupBandDto) {
    if (dto.maxPeople < dto.minPeople) {
      throw new BadRequestException('maxPeople must be >= minPeople');
    }
    return this.prisma.groupPriceBand.create({
      data: {
        id: newId(),
        houseboatId,
        minPeople: dto.minPeople,
        maxPeople: dto.maxPeople,
        totalPrice: dto.totalPrice,
      },
    });
  }

  listGroupBands(houseboatId: string) {
    return this.prisma.groupPriceBand.findMany({
      where: { houseboatId },
      orderBy: { minPeople: 'asc' },
    });
  }

  /** Find the band a headcount falls into; reject if outside all bands. */
  async bandForHeadcount(houseboatId: string, headcount: number) {
    const band = await this.prisma.groupPriceBand.findFirst({
      where: {
        houseboatId,
        minPeople: { lte: headcount },
        maxPeople: { gte: headcount },
      },
    });
    if (!band) {
      throw new BadRequestException(
        `Headcount ${headcount} falls outside all group bands`,
      );
    }
    return band;
  }
}
