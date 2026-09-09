import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../rbac/roles.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { HouseboatFacetsService } from '../houseboats/houseboat-facets.service';
import { newId } from '../common/uuid';
import { FULL_PERMISSIONS } from '../rbac/permission.types';
import {
  CreateHouseboatDto,
  UpdateHouseboatDto,
  CreateDeckDto,
  CreateCategoryDto,
  CreateCabinDto,
  UpdateDeckDto,
  UpdateCategoryDto,
  UpdateCabinDto,
} from './dto/assets.dto';

/**
 * Owner-side houseboat management. A new boat starts as `draft`; profile
 * completeness drives when a platform admin can approve it to `live`
 * (plan §Houseboat Assets). Creating a boat also bootstraps the creator as
 * Owner (role + membership) so they immediately have full access.
 */
@Injectable()
export class HouseboatAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly facets: HouseboatFacetsService,
  ) {}

  private slugify(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `${base}-${Math.random().toString(36).slice(2, 7)}`;
  }

  async create(creatorId: string, dto: CreateHouseboatDto) {
    return this.prisma.$transaction(async (tx) => {
      const boat = await tx.houseboat.create({
        data: {
          id: newId(),
          name: dto.name,
          slug: this.slugify(dto.name),
          description: dto.description,
          safetyFeatures: dto.safetyFeatures,
          foodMenu: dto.foodMenu as never,
          status: 'draft',
          profileCompletePct: 0,
          operatingDates: [],
          defaultCrew: [],
        },
      });

      // Owner role + membership for the creator.
      const ownerRole = await tx.role.create({
        data: {
          id: newId(),
          houseboatId: boat.id,
          name: 'Owner',
          permissions: FULL_PERMISSIONS as never,
        },
      });
      await tx.houseboatMember.create({
        data: {
          id: newId(),
          accountId: creatorId,
          houseboatId: boat.id,
          roleId: ownerRole.id,
          startDate: new Date(),
          status: 'active',
          shareholderPct: 100,
        },
      });

      await this.audit.log(
        {
          houseboatId: boat.id,
          actorAccountId: creatorId,
          action: 'houseboat_create',
          entityType: 'houseboat',
          entityId: boat.id,
        },
        tx,
      );
      return boat;
    });
  }

  /** Recompute a coarse profile-completeness %. Reaches 100 → admin can approve. */
  private async recomputeCompleteness(houseboatId: string): Promise<number> {
    const boat = await this.prisma.houseboat.findUnique({
      where: { id: houseboatId },
      include: {
        decks: { include: { cabins: true } },
        cabinCategories: true,
        routes: true,
      },
    });
    if (!boat) return 0;
    const checks = [
      Boolean(boat.description),
      Boolean(boat.safetyFeatures),
      Boolean(boat.bankAccount), // mandatory before payout
      boat.cabinCategories.length > 0,
      boat.decks.some((d) => d.cabins.length > 0),
      boat.routes.length > 0,
      boat.operatingDates.length > 0,
    ];
    const pct = Math.round((checks.filter(Boolean).length / checks.length) * 100);
    await this.prisma.houseboat.update({
      where: { id: houseboatId },
      data: { profileCompletePct: pct },
    });
    return pct;
  }

  async update(houseboatId: string, actorId: string, dto: UpdateHouseboatDto) {
    const boat = await this.prisma.houseboat.update({
      where: { id: houseboatId },
      data: {
        name: dto.name,
        // Public URL derives from the name, so a rename re-slugifies. slugify
        // appends a random suffix, keeping the @unique constraint safe.
        slug: dto.name ? this.slugify(dto.name) : undefined,
        description: dto.description,
        safetyFeatures: dto.safetyFeatures,
        cancellationPolicy: dto.cancellationPolicy,
        foodMenu: dto.foodMenu as never,
        bankAccount: dto.bankAccount as never,
        childPolicy: dto.childPolicy as never,
        operatingDates: dto.operatingDates
          ? dto.operatingDates.map((d) => new Date(d))
          : undefined,
        defaultCrew: dto.defaultCrew,
      },
    });
    await this.recomputeCompleteness(houseboatId);
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'houseboat_update',
      entityType: 'houseboat',
      entityId: houseboatId,
    });
    return boat;
  }

  async get(houseboatId: string) {
    const boat = await this.prisma.houseboat.findUnique({
      where: { id: houseboatId },
      include: {
        decks: { orderBy: { position: 'asc' }, include: { cabins: true } },
        cabinCategories: true,
        routes: { include: { route: true } },
      },
    });
    if (!boat) return boat;
    return {
      ...boat,
      logoUrl: boat.logoStorageKey
        ? this.storage.publicUrl(boat.logoStorageKey)
        : null,
    };
  }

  // ── Decks ──────────────────────────────────────────────────
  async addDeck(houseboatId: string, dto: CreateDeckDto) {
    const deck = await this.prisma.houseboatDeck.create({
      data: {
        id: newId(),
        houseboatId,
        name: dto.name,
        position: dto.position ?? 0,
      },
    });
    await this.recomputeCompleteness(houseboatId);
    return deck;
  }

  // ── Cabin categories ───────────────────────────────────────
  async addCategory(houseboatId: string, dto: CreateCategoryDto) {
    const cat = await this.prisma.houseboatCabinCategory.create({
      data: {
        id: newId(),
        houseboatId,
        name: dto.name,
        isAc: dto.isAc ?? false,
        baseCapacity: dto.baseCapacity,
        extendedCapacity: dto.extendedCapacity,
        facilities: dto.facilities,
      },
    });
    await this.recomputeCompleteness(houseboatId);
    // Category AC/capacity/facilities feed the search facets.
    await this.facets.recompute(houseboatId);
    return cat;
  }

  // ── Cabins ─────────────────────────────────────────────────
  async addCabin(houseboatId: string, dto: CreateCabinDto) {
    const cabin = await this.prisma.houseboatCabin.create({
      data: {
        id: newId(),
        deckId: dto.deckId,
        cabinCategoryId: dto.cabinCategoryId,
        name: dto.name,
        gridRow: dto.gridRow,
        gridCol: dto.gridCol,
      },
    });
    await this.recomputeCompleteness(houseboatId);
    return cabin;
  }

  // ── Deck update/delete ─────────────────────────────────────
  async updateDeck(
    houseboatId: string,
    deckId: string,
    actorId: string,
    dto: UpdateDeckDto,
  ) {
    await this.assertDeckOwned(houseboatId, deckId);
    const deck = await this.prisma.houseboatDeck.update({
      where: { id: deckId },
      data: { name: dto.name, position: dto.position },
    });
    await this.recomputeCompleteness(houseboatId);
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'deck_update',
      entityType: 'houseboat_deck',
      entityId: deckId,
    });
    return deck;
  }

  async deleteDeck(houseboatId: string, deckId: string, actorId: string) {
    await this.assertDeckOwned(houseboatId, deckId);
    const cabins = await this.prisma.houseboatCabin.count({ where: { deckId } });
    if (cabins > 0) {
      throw new ConflictException(
        'This deck still has cabins. Remove or move them before deleting the deck.',
      );
    }
    await this.prisma.houseboatDeck.delete({ where: { id: deckId } });
    await this.recomputeCompleteness(houseboatId);
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'deck_delete',
      entityType: 'houseboat_deck',
      entityId: deckId,
    });
    return { ok: true };
  }

  // ── Category update/delete ─────────────────────────────────
  async updateCategory(
    houseboatId: string,
    categoryId: string,
    actorId: string,
    dto: UpdateCategoryDto,
  ) {
    await this.assertCategoryOwned(houseboatId, categoryId);
    const cat = await this.prisma.houseboatCabinCategory.update({
      where: { id: categoryId },
      data: {
        name: dto.name,
        isAc: dto.isAc,
        baseCapacity: dto.baseCapacity,
        extendedCapacity: dto.extendedCapacity,
        facilities: dto.facilities,
      },
    });
    await this.recomputeCompleteness(houseboatId);
    await this.facets.recompute(houseboatId);
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'category_update',
      entityType: 'houseboat_cabin_category',
      entityId: categoryId,
    });
    return cat;
  }

  async deleteCategory(
    houseboatId: string,
    categoryId: string,
    actorId: string,
  ) {
    await this.assertCategoryOwned(houseboatId, categoryId);
    const [cabins, rules] = await Promise.all([
      this.prisma.houseboatCabin.count({
        where: { cabinCategoryId: categoryId },
      }),
      this.prisma.pricingRule.count({
        where: { cabinCategoryId: categoryId },
      }),
    ]);
    if (cabins > 0) {
      throw new ConflictException(
        'This category is used by cabins. Reassign or delete those cabins first.',
      );
    }
    if (rules > 0) {
      throw new ConflictException(
        'This category has pricing rules. Remove them before deleting the category.',
      );
    }
    await this.prisma.houseboatCabinCategory.delete({
      where: { id: categoryId },
    });
    await this.recomputeCompleteness(houseboatId);
    await this.facets.recompute(houseboatId);
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'category_delete',
      entityType: 'houseboat_cabin_category',
      entityId: categoryId,
    });
    return { ok: true };
  }

  // ── Cabin update/delete ────────────────────────────────────
  async updateCabin(
    houseboatId: string,
    cabinId: string,
    actorId: string,
    dto: UpdateCabinDto,
  ) {
    await this.assertCabinOwned(houseboatId, cabinId);
    // Guard cross-boat reparenting: a new deck/category must belong to this boat.
    if (dto.deckId) await this.assertDeckOwned(houseboatId, dto.deckId);
    if (dto.cabinCategoryId)
      await this.assertCategoryOwned(houseboatId, dto.cabinCategoryId);
    const cabin = await this.prisma.houseboatCabin.update({
      where: { id: cabinId },
      data: {
        deckId: dto.deckId,
        cabinCategoryId: dto.cabinCategoryId,
        name: dto.name,
        gridRow: dto.gridRow,
        gridCol: dto.gridCol,
      },
    });
    await this.recomputeCompleteness(houseboatId);
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'cabin_update',
      entityType: 'houseboat_cabin',
      entityId: cabinId,
    });
    return cabin;
  }

  async deleteCabin(houseboatId: string, cabinId: string, actorId: string) {
    await this.assertCabinOwned(houseboatId, cabinId);
    const [bookings, holds] = await Promise.all([
      this.prisma.bookingCabin.count({ where: { cabinId } }),
      this.prisma.cabinHold.count({ where: { cabinId } }),
    ]);
    if (bookings > 0 || holds > 0) {
      throw new ConflictException(
        'This cabin is tied to bookings or held reservations and cannot be deleted.',
      );
    }
    // Media is nullable-linked; detach its gallery rows so the FK is clear.
    await this.prisma.$transaction([
      this.prisma.houseboatMedia.updateMany({
        where: { cabinId },
        data: { cabinId: null },
      }),
      this.prisma.houseboatCabin.delete({ where: { id: cabinId } }),
    ]);
    await this.recomputeCompleteness(houseboatId);
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'cabin_delete',
      entityType: 'houseboat_cabin',
      entityId: cabinId,
    });
    return { ok: true };
  }

  // Ownership guards: a row must belong to the boat in the URL, else 404 —
  // this stops one owner editing another boat's deck/category/cabin by id.
  private async assertDeckOwned(houseboatId: string, deckId: string) {
    const deck = await this.prisma.houseboatDeck.findFirst({
      where: { id: deckId, houseboatId },
      select: { id: true },
    });
    if (!deck) throw new NotFoundException('Deck not found on this houseboat.');
  }

  private async assertCategoryOwned(houseboatId: string, categoryId: string) {
    const cat = await this.prisma.houseboatCabinCategory.findFirst({
      where: { id: categoryId, houseboatId },
      select: { id: true },
    });
    if (!cat)
      throw new NotFoundException('Category not found on this houseboat.');
  }

  private async assertCabinOwned(houseboatId: string, cabinId: string) {
    const cabin = await this.prisma.houseboatCabin.findFirst({
      where: { id: cabinId, deck: { houseboatId } },
      select: { id: true },
    });
    if (!cabin)
      throw new NotFoundException('Cabin not found on this houseboat.');
  }

  /**
   * A boat runs exactly ONE route (§9) — the single source of truth the weekly
   * schedule reads. Setting a route replaces any existing link rather than
   * adding to it.
   *
   * Switching to a DIFFERENT route is guarded by the active schedule: if that
   * schedule has bookings on its generated departures, the change is blocked
   * (bookings must be resolved first). With no bookings, the active schedule is
   * deactivated (its departures are kept as history) so it stops generating on
   * the old route. Reselecting the old route later still surfaces those past
   * departures and lets the owner re-save to resume.
   */
  async linkRoute(houseboatId: string, routeId: string) {
    const current = await this.prisma.houseboatRoute.findFirst({
      where: { houseboatId },
      select: { routeId: true },
    });
    const isSwitch = !!current && current.routeId !== routeId;

    const link = await this.prisma.$transaction(async (tx) => {
      if (isSwitch) {
        const schedule = await tx.boatSchedule.findFirst({
          where: { houseboatId, active: true },
          include: { slots: { select: { id: true } } },
        });
        if (schedule) {
          const slotIds = schedule.slots.map((s) => s.id);
          const booked =
            slotIds.length > 0
              ? await tx.booking.count({
                  where: {
                    departure: { scheduleSlotId: { in: slotIds } },
                    status: { not: 'cancelled' },
                  },
                })
              : 0;
          if (booked > 0) {
            throw new ConflictException(
              'This schedule has bookings — cancel or complete them before changing route.',
            );
          }
          // Unbooked: retire the old-route schedule; departures stay as history.
          await tx.boatSchedule.update({
            where: { id: schedule.id },
            data: { active: false },
          });
        }
      }

      await tx.houseboatRoute.deleteMany({
        where: { houseboatId, routeId: { not: routeId } },
      });
      return tx.houseboatRoute.upsert({
        where: { houseboatId_routeId: { houseboatId, routeId } },
        update: {},
        create: { id: newId(), houseboatId, routeId },
      });
    });
    await this.recomputeCompleteness(houseboatId);
    return link;
  }
}
