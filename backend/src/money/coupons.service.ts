import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { newId } from '../common/uuid';
import { couponDiscount, CouponInput } from '../common/billing';
import { money, ZERO, add } from '../common/money';

/** Coupons + cancellation policies — owner-set money config. */
@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createCoupon(
    houseboatId: string,
    input: {
      code: string;
      kind: 'percent' | 'flat' | 'referral';
      value: number;
      validFrom?: string;
      validTo?: string;
    },
    actorId: string,
  ) {
    // Platform callers bypass PermissionGuard's boat scoping, so a bogus id
    // would otherwise surface as a raw Prisma FK error.
    const boat = await this.prisma.houseboat.findUnique({
      where: { id: houseboatId },
      select: { id: true },
    });
    if (!boat) throw new NotFoundException('Houseboat not found');

    if (input.kind === 'percent' && input.value > 100) {
      throw new BadRequestException('Percent coupon cannot exceed 100');
    }
    if (
      input.validFrom &&
      input.validTo &&
      new Date(input.validFrom) > new Date(input.validTo)
    ) {
      throw new BadRequestException('validFrom must not be after validTo');
    }

    // Service-level check, not a unique index: an index migration would fail
    // on any pre-existing duplicate rows.
    const duplicate = await this.prisma.coupon.findFirst({
      where: { houseboatId, code: input.code },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException('Coupon code already exists for this boat');
    }

    const coupon = await this.prisma.coupon.create({
      data: {
        id: newId(),
        houseboatId,
        code: input.code,
        kind: input.kind,
        value: input.value,
        validFrom: input.validFrom ? new Date(input.validFrom) : undefined,
        validTo: input.validTo ? new Date(input.validTo) : undefined,
      },
    });

    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'coupon_create',
      entityType: 'coupon',
      entityId: coupon.id,
      after: {
        code: coupon.code,
        kind: coupon.kind,
        value: coupon.value.toString(),
        validFrom: input.validFrom ?? null,
        validTo: input.validTo ?? null,
      },
    });

    return coupon;
  }

  async setCouponActive(
    houseboatId: string,
    couponId: string,
    active: boolean,
    actorId: string,
  ) {
    const coupon = await this.prisma.coupon.findFirst({
      where: { id: couponId, houseboatId },
      select: { id: true },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');

    const updated = await this.prisma.coupon.update({
      where: { id: couponId },
      data: { isActive: active },
    });

    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'coupon_set_active',
      entityType: 'coupon',
      entityId: couponId,
      after: { isActive: active },
    });

    return updated;
  }

  async listCoupons(houseboatId: string) {
    const coupons = await this.prisma.coupon.findMany({ where: { houseboatId } });

    // Usage stats: count non-cancelled bookings per coupon and recompute the
    // coupon-only discount from each booking's pre-coupon price (invoice.priceShown),
    // so an owner's ad-hoc POS discount never inflates the deducted total.
    const bookings = await this.prisma.booking.findMany({
      where: {
        couponId: { in: coupons.map((c) => c.id) },
        status: { not: 'cancelled' },
      },
      select: { couponId: true, invoice: { select: { priceShown: true } } },
    });

    return coupons.map((c) => {
      const input: CouponInput = {
        kind: c.kind as CouponInput['kind'],
        value: money(c.value),
      };
      let total = ZERO;
      let count = 0;
      for (const b of bookings) {
        if (b.couponId !== c.id) continue;
        count += 1;
        if (!b.invoice) continue; // quote-type bookings have no invoice
        total = add(total, couponDiscount(money(b.invoice.priceShown), input));
      }
      return {
        ...c,
        usageCount: count,
        totalDeducted: total.toFixed(2),
      };
    });
  }

  createPolicy(
    houseboatId: string,
    input: {
      policyTemplate: string;
      depositPct?: number;
      tiers?: unknown;
    },
  ) {
    return this.prisma.cancellationPolicy.create({
      data: {
        id: newId(),
        houseboatId,
        policyTemplate: input.policyTemplate,
        depositPct: input.depositPct,
        tiers: input.tiers as never,
      },
    });
  }

  listPolicies(houseboatId: string) {
    return this.prisma.cancellationPolicy.findMany({ where: { houseboatId } });
  }
}
