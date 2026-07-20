import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { newId } from '../common/uuid';
import { Money, money } from '../common/money';
import { CreatePricingProfileDto, GroupBandDto } from './dto/pricing.dto';

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

  listProfiles(houseboatId: string) {
    return this.prisma.pricingProfile.findMany({
      where: { houseboatId },
      include: { rules: true },
    });
  }

  /**
   * Resolve the pricing profile that applies to a given date: the profile whose
   * `dates[]` contains it, else the default profile. (plan §1 step 2)
   */
  async profileForDate(houseboatId: string, date: Date) {
    const iso = date.toISOString().slice(0, 10);
    const profiles = await this.prisma.pricingProfile.findMany({
      where: { houseboatId },
      include: { rules: true },
    });
    const special = profiles.find((p) =>
      p.dates.some((d) => d.toISOString().slice(0, 10) === iso),
    );
    return special ?? profiles.find((p) => p.isDefault) ?? null;
  }

  /** Owner-set price for a category at an occupancy under the date's profile. */
  /** Owner-set per-person rate for this occupancy tier on this date. */
  async pricePerPersonFor(
    houseboatId: string,
    cabinCategoryId: string,
    occupancy: number,
    date: Date,
  ): Promise<Money> {
    const profile = await this.profileForDate(houseboatId, date);
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
  ): Promise<Money> {
    // price_per_person × occupancy = room total for that room.
    const perPerson = await this.pricePerPersonFor(
      houseboatId,
      cabinCategoryId,
      occupancy,
      date,
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
