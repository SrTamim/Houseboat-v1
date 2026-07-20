import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { newId } from '../common/uuid';

/** Coupons + cancellation policies — owner-set money config. */
@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  createCoupon(
    houseboatId: string,
    input: {
      code: string;
      kind: 'percent' | 'flat' | 'referral';
      value: number;
      validFrom?: string;
      validTo?: string;
    },
  ) {
    return this.prisma.coupon.create({
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
  }

  listCoupons(houseboatId: string) {
    return this.prisma.coupon.findMany({ where: { houseboatId } });
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
