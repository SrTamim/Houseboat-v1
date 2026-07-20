import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../rbac/roles.service';
import { AuditService } from '../audit/audit.service';
import { newId } from '../common/uuid';
import { FULL_PERMISSIONS } from '../rbac/permission.types';
import {
  CreateHouseboatDto,
  UpdateHouseboatDto,
  CreateDeckDto,
  CreateCategoryDto,
  CreateCabinDto,
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
          foodMenu: dto.foodMenu,
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
        description: dto.description,
        safetyFeatures: dto.safetyFeatures,
        foodMenu: dto.foodMenu,
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

  get(houseboatId: string) {
    return this.prisma.houseboat.findUnique({
      where: { id: houseboatId },
      include: {
        decks: { orderBy: { position: 'asc' }, include: { cabins: true } },
        cabinCategories: true,
        routes: { include: { route: true } },
      },
    });
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

  async linkRoute(houseboatId: string, routeId: string) {
    const link = await this.prisma.houseboatRoute.create({
      data: { id: newId(), houseboatId, routeId },
    });
    await this.recomputeCompleteness(houseboatId);
    return link;
  }
}
