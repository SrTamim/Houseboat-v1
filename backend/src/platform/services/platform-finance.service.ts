import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { newId } from '../../common/uuid';
import { cursorArgs, toPage, type Page } from '../../common/paginate';
import type {
  ListCouponsQueryDto,
  ListCreditsQueryDto,
  ListInvoicesQueryDto,
  ListPayoutBatchesQueryDto,
  ListRefundsQueryDto,
  ListSubscriptionInvoicesQueryDto,
  UpsertBillingConfigDto,
} from '../dto/platform.dto';

/**
 * Cross-boat finance reads for the platform console.
 *
 * The boat-scoped equivalents live in MoneyModule and stay there — these are
 * the variants that deliberately span every boat, which is why they sit behind
 * the single @PlatformOnly() gate on PlatformFinanceController.
 */
@Injectable()
export class PlatformFinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Payout batches across all boats, newest first.
   *
   * PayoutsService.listBatches covers a single boat and had no HTTP route;
   * this is the cross-boat, paginated form the console needs.
   */
  async listPayoutBatches(
    query: ListPayoutBatchesQueryDto,
  ): Promise<Page<{ id: string }>> {
    const rows = await this.prisma.houseboatPayoutBatch.findMany({
      ...cursorArgs(query),
      where: query.houseboatId ? { houseboatId: query.houseboatId } : undefined,
      include: {
        houseboat: { select: { id: true, name: true, slug: true } },
      },
      // preparedBy/approvedBy are returned deliberately: separation of duties
      // means the same account cannot both prepare and approve a batch
      // (payouts.service.ts:117), and the console needs these to disable the
      // Approve button rather than let the click fail with a 403.
    });
    return toPage(rows, query);
  }

  /**
   * Invoices across all boats, newest first, optionally narrowed by state.
   *
   * Backs the console's verify/payout queues (e.g. status=paid is the
   * verification queue; status=payment_verified is ready for payout). The
   * boat-scoped money endpoints can't serve those screens — they all require a
   * :houseboatId.
   */
  async listInvoices(query: ListInvoicesQueryDto): Promise<Page<{ id: string }>> {
    const rows = await this.prisma.invoice.findMany({
      ...cursorArgs(query),
      where: {
        status: query.status ?? undefined,
        houseboatId: query.houseboatId ?? undefined,
      },
      select: {
        id: true,
        status: true,
        displayTotal: true,
        amountPaid: true,
        dueToBoat: true,
        commission: true,
        payoutBatchId: true,
        houseboat: { select: { id: true, name: true, slug: true } },
        customer: { select: { id: true, name: true, phone: true } },
        booking: {
          select: {
            id: true,
            status: true,
            type: true,
            createdAt: true,
            departure: { select: { startDate: true } },
          },
        },
        payments: {
          select: { id: true, amount: true, method: true, gatewayToken: true },
        },
      },
    });
    return toPage(rows, query);
  }

  /**
   * Refunds across all boats. bank_details are encrypted PII and deliberately
   * never selected here — the console shows who/what/when, not account numbers.
   */
  async listRefunds(query: ListRefundsQueryDto): Promise<Page<{ id: string }>> {
    const rows = await this.prisma.invoiceRefund.findMany({
      ...cursorArgs(query),
      where: { status: query.status ?? undefined },
      select: {
        id: true,
        amount: true,
        reason: true,
        status: true,
        claimDeadline: true,
        completedAt: true,
        requestedByAccount: { select: { id: true, name: true } },
        verifiedByAccount: { select: { id: true, name: true } },
        completedByAccount: { select: { id: true, name: true } },
        invoice: {
          select: {
            id: true,
            status: true,
            displayTotal: true,
            houseboat: { select: { id: true, name: true } },
            customer: { select: { id: true, name: true, phone: true } },
          },
        },
      },
    });
    return toPage(rows, query);
  }

  /** Invoices where the customer paid more than the final bill (buyout adjustments). */
  async listOverpayments(query: ListInvoicesQueryDto): Promise<Page<{ id: string }>> {
    const rows = await this.prisma.invoice.findMany({
      ...cursorArgs(query),
      where: {
        amountOverpaid: { gt: 0 },
        houseboatId: query.houseboatId ?? undefined,
      },
      select: {
        id: true,
        status: true,
        displayTotal: true,
        amountPaid: true,
        amountOverpaid: true,
        houseboat: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, phone: true } },
        booking: { select: { id: true, createdAt: true } },
      },
    });
    return toPage(rows, query);
  }

  async listCredits(query: ListCreditsQueryDto): Promise<Page<{ id: string }>> {
    const rows = await this.prisma.customerCredit.findMany({
      ...cursorArgs(query),
      where: { status: query.status ?? undefined },
      select: {
        id: true,
        amount: true,
        status: true,
        account: { select: { id: true, name: true, phone: true } },
        sourceInvoice: {
          select: { id: true, houseboat: { select: { name: true } } },
        },
        usedInInvoice: { select: { id: true } },
      },
    });
    return toPage(rows, query);
  }

  /** Monthly platform bills to boats, across all boats. */
  async listSubscriptionInvoices(
    query: ListSubscriptionInvoicesQueryDto,
  ): Promise<Page<{ id: string }>> {
    const rows = await this.prisma.houseboatSubscriptionInvoice.findMany({
      ...cursorArgs(query),
      where: {
        status: query.status ?? undefined,
        houseboatId: query.houseboatId ?? undefined,
      },
      select: {
        id: true,
        period: true,
        monthlyFee: true,
        commissionTotal: true,
        amountDue: true,
        status: true,
        issuedAt: true,
        houseboat: { select: { id: true, name: true } },
      },
    });
    return toPage(rows, query);
  }

  /**
   * Create or replace a boat's billing terms.
   *
   * This is the only write path for HouseboatBillingConfig — without it a boat
   * can never be commissioned (issueSubscriptionInvoice 404s with no config).
   * Keyed by findFirst({houseboatId}) to match every consumer
   * (booking.service.ts, finance.service.ts); Houseboat.billingConfigId is
   * dead and stays untouched. platformBalance NEVER appears in the update —
   * it is ledger-owned (payouts.service.ts, finance.service.ts).
   */
  async upsertBillingConfig(
    houseboatId: string,
    dto: UpsertBillingConfigDto,
    actorId: string,
  ) {
    const boat = await this.prisma.houseboat.findUnique({
      where: { id: houseboatId },
      select: { id: true },
    });
    if (!boat) throw new NotFoundException('Houseboat not found');

    const data = {
      commissionPct: dto.commissionPct ?? null,
      monthlyFee: dto.monthlyFee ?? null,
      gatewayFeePct: dto.gatewayFeePct ?? null,
      trialEnds: dto.trialEnds ? new Date(dto.trialEnds) : null,
    };

    const existing = await this.prisma.houseboatBillingConfig.findFirst({
      where: { houseboatId },
    });

    const config = existing
      ? await this.prisma.houseboatBillingConfig.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.houseboatBillingConfig.create({
          data: { id: newId(), houseboatId, ...data },
        });

    // before/after list only the four editable fields — including
    // platformBalance would imply this path can change it.
    const snapshot = (c: {
      commissionPct: unknown;
      monthlyFee: unknown;
      gatewayFeePct: unknown;
      trialEnds: Date | null;
    }) => ({
      commissionPct: c.commissionPct?.toString() ?? null,
      monthlyFee: c.monthlyFee?.toString() ?? null,
      gatewayFeePct: c.gatewayFeePct?.toString() ?? null,
      trialEnds: c.trialEnds?.toISOString().slice(0, 10) ?? null,
    });
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'billing_config_upsert',
      entityType: 'houseboat_billing_config',
      entityId: config.id,
      before: existing ? snapshot(existing) : null,
      after: snapshot(config),
    });

    return config;
  }

  /** Billing terms per boat, including the signed platform balance. */
  listBillingConfigs() {
    return this.prisma.houseboatBillingConfig.findMany({
      orderBy: { platformBalance: 'asc' },
      select: {
        id: true,
        commissionPct: true,
        monthlyFee: true,
        gatewayFeePct: true,
        platformBalance: true,
        trialEnds: true,
        houseboat: { select: { id: true, name: true, status: true } },
      },
    });
  }

  /**
   * Boats that owe the platform: negative signed balance, plus any overdue
   * subscription invoices. Balance ordering puts the deepest debt first.
   */
  async listDebtors() {
    const [configs, overdue] = await this.prisma.$transaction([
      this.prisma.houseboatBillingConfig.findMany({
        where: { platformBalance: { lt: 0 } },
        orderBy: { platformBalance: 'asc' },
        select: {
          id: true,
          platformBalance: true,
          houseboat: { select: { id: true, name: true, status: true } },
        },
      }),
      this.prisma.houseboatSubscriptionInvoice.findMany({
        where: { status: 'overdue' },
        orderBy: { issuedAt: 'asc' },
        select: {
          id: true,
          period: true,
          amountDue: true,
          issuedAt: true,
          houseboat: { select: { id: true, name: true, status: true } },
        },
      }),
    ]);
    return { negativeBalances: configs, overdueInvoices: overdue };
  }

  async listCoupons(query: ListCouponsQueryDto): Promise<Page<{ id: string }>> {
    const rows = await this.prisma.coupon.findMany({
      ...cursorArgs(query),
      where: { houseboatId: query.houseboatId ?? undefined },
      select: {
        id: true,
        code: true,
        kind: true,
        value: true,
        validFrom: true,
        validTo: true,
        houseboat: { select: { id: true, name: true } },
        _count: { select: { bookings: true } },
      },
    });
    return toPage(rows, query);
  }

  /**
   * Console analytics: platform-wide money aggregates plus a per-boat revenue
   * breakdown. Decimal sums are returned as strings — same convention as every
   * other money field on the wire.
   */
  async analyticsSummary() {
    const [totals, byBoatRaw, bookingCount, liveBoats] =
      await this.prisma.$transaction([
        this.prisma.invoice.aggregate({
          _sum: {
            displayTotal: true,
            commission: true,
            gatewayFee: true,
            amountPaid: true,
            dueToBoat: true,
          },
          _count: true,
        }),
        this.prisma.invoice.groupBy({
          by: ['houseboatId'],
          _sum: { displayTotal: true, commission: true },
          _count: true,
          orderBy: { _sum: { displayTotal: 'desc' } },
          take: 10,
        }),
        this.prisma.booking.count(),
        this.prisma.houseboat.count({ where: { status: 'live' } }),
      ]);

    // groupBy can't join, so resolve the boat names in one follow-up query.
    const boats = await this.prisma.houseboat.findMany({
      where: { id: { in: byBoatRaw.map((r) => r.houseboatId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(boats.map((b) => [b.id, b.name]));

    return {
      totals: {
        gmv: totals._sum.displayTotal ?? 0,
        commission: totals._sum.commission ?? 0,
        gatewayFees: totals._sum.gatewayFee ?? 0,
        collected: totals._sum.amountPaid ?? 0,
        dueToBoats: totals._sum.dueToBoat ?? 0,
        invoiceCount: totals._count,
        bookingCount,
        liveBoats,
      },
      revenueByBoat: byBoatRaw.map((r) => ({
        houseboatId: r.houseboatId,
        name: nameById.get(r.houseboatId) ?? r.houseboatId,
        gmv: r._sum?.displayTotal ?? 0,
        commission: r._sum?.commission ?? 0,
        invoiceCount: r._count,
      })),
    };
  }
}
