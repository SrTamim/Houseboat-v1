import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { newId } from '../common/uuid';
import { money, add, percentOf, ZERO } from '../common/money';
import { BILLING_GRACE_DAYS } from '../rbac/rbac.service';

/**
 * Owner distributions + platform subscription billing (schema-ahead finance).
 *
 * OwnerDistribution: an owner records money paid out to a shareholder member
 * (informational ledger — the platform doesn't move this money). Suggested
 * splits come from members' shareholder_pct.
 *
 * HouseboatSubscriptionInvoice (plan §5 platform side): a monthly bill to the
 * boat = monthly_fee + commission accrued that period. Marking paid clears it
 * and adjusts the boat's signed platform_balance.
 */
@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Owner distributions (owner-side; guarded by controller money:edit) ──

  /** Suggested split of an amount across active shareholders, by shareholder_pct. */
  async suggestSplit(houseboatId: string, amount: number) {
    const members = await this.prisma.houseboatMember.findMany({
      where: { houseboatId, status: 'active', shareholderPct: { not: null } },
      select: { id: true, accountId: true, shareholderPct: true },
    });
    const total = money(amount);
    return members.map((m) => ({
      membershipId: m.id,
      accountId: m.accountId,
      shareholderPct: Number(m.shareholderPct),
      amount: percentOf(total, money(m.shareholderPct ?? 0)).toFixed(2),
    }));
  }

  /** Record a distribution paid to one shareholder membership. */
  async recordDistribution(
    houseboatId: string,
    actorId: string,
    input: { membershipId: string; amount: number; note?: string },
  ) {
    const membership = await this.prisma.houseboatMember.findUnique({
      where: { id: input.membershipId },
      select: { houseboatId: true },
    });
    if (!membership || membership.houseboatId !== houseboatId) {
      throw new BadRequestException('Membership is not on this houseboat');
    }
    const row = await this.prisma.ownerDistribution.create({
      data: {
        id: newId(),
        houseboatId,
        membershipId: input.membershipId,
        amount: input.amount,
        note: input.note,
        recordedBy: actorId,
      },
    });
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'owner_distribution',
      entityType: 'owner_distribution',
      entityId: row.id,
      after: { amount: money(input.amount).toFixed(2) },
    });
    return row;
  }

  listDistributions(houseboatId: string) {
    return this.prisma.ownerDistribution.findMany({
      where: { houseboatId },
      orderBy: { at: 'desc' },
    });
  }

  // ── Platform subscription billing (platform finance) ───────────────────

  /**
   * Issue a monthly subscription invoice for a boat: monthly_fee (if any) plus
   * commission accrued from payment_verified/in_payout invoices in the period.
   * `period` is a YYYY-MM string.
   */
  async issueSubscriptionInvoice(houseboatId: string, actorId: string, period: string) {
    if (!/^\d{4}-\d{2}$/.test(period)) {
      throw new BadRequestException('period must be YYYY-MM');
    }
    const config = await this.prisma.houseboatBillingConfig.findFirst({
      where: { houseboatId },
    });
    if (!config) throw new NotFoundException('No billing config for this houseboat');

    // Prevent a duplicate invoice for the same period.
    const existing = await this.prisma.houseboatSubscriptionInvoice.findFirst({
      where: { houseboatId, period },
    });
    if (existing) {
      throw new BadRequestException(`Already invoiced for ${period}`);
    }

    // Commission accrued that period. Invoice has no timestamp, so scope by when
    // money actually moved: payments (InvoicePayment.paidAt) in the window whose
    // invoice belongs to this boat and reached a payout-eligible state. Dedup so
    // a partially-paid invoice's commission counts once.
    const [year, mon] = period.split('-').map(Number);
    const from = new Date(Date.UTC(year, mon - 1, 1));
    const to = new Date(Date.UTC(year, mon, 1));
    const payments = await this.prisma.invoicePayment.findMany({
      where: {
        paidAt: { gte: from, lt: to },
        invoice: {
          houseboatId,
          status: { in: ['payment_verified', 'in_payout', 'bill_cleared'] },
        },
      },
      select: { invoiceId: true, invoice: { select: { commission: true } } },
    });
    const seen = new Set<string>();
    let commissionTotal = ZERO;
    for (const p of payments) {
      if (seen.has(p.invoiceId)) continue;
      seen.add(p.invoiceId);
      commissionTotal = add(commissionTotal, money(p.invoice.commission));
    }
    const monthlyFee = config.monthlyFee ? money(config.monthlyFee) : ZERO;
    const amountDue = add(monthlyFee, commissionTotal);

    const row = await this.prisma.houseboatSubscriptionInvoice.create({
      data: {
        id: newId(),
        houseboatId,
        billingConfigId: config.id,
        period,
        monthlyFee: config.monthlyFee ?? undefined,
        commissionTotal,
        amountDue,
        status: 'issued',
      },
    });
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'subscription_issue',
      entityType: 'houseboat_subscription_invoice',
      entityId: row.id,
      after: { period, amountDue: amountDue.toFixed(2) },
    });
    return row;
  }

  /** Mark a subscription invoice paid → debit it off the boat's platform_balance. */
  async paySubscriptionInvoice(invoiceId: string, actorId: string) {
    const inv = await this.prisma.houseboatSubscriptionInvoice.findUnique({
      where: { id: invoiceId },
    });
    if (!inv) throw new NotFoundException('Subscription invoice not found');
    if (inv.status === 'paid') {
      throw new BadRequestException('Already paid');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.houseboatSubscriptionInvoice.update({
        where: { id: invoiceId },
        data: { status: 'paid' },
      });
      // platform_balance is signed; paying the bill removes the debt.
      const config = await tx.houseboatBillingConfig.findFirst({
        where: { houseboatId: inv.houseboatId },
      });
      if (config) {
        await tx.houseboatBillingConfig.update({
          where: { id: config.id },
          data: {
            platformBalance: add(
              money(config.platformBalance),
              money(inv.amountDue),
            ),
          },
        });
      }
      await this.audit.log(
        {
          houseboatId: inv.houseboatId,
          actorAccountId: actorId,
          action: 'subscription_pay',
          entityType: 'houseboat_subscription_invoice',
          entityId: invoiceId,
        },
        tx,
      );
      return updated;
    });
  }

  listSubscriptionInvoices(houseboatId: string) {
    return this.prisma.houseboatSubscriptionInvoice.findMany({
      where: { houseboatId },
      orderBy: { issuedAt: 'desc' },
    });
  }

  /**
   * Billing status for a boat's dashboard: whether it's currently within the
   * grace window, how many days remain to pay, or already locked. Never blocks —
   * this is the read the owner sees to know they must pay.
   */
  async billingStatus(houseboatId: string) {
    const unpaid = await this.prisma.houseboatSubscriptionInvoice.findMany({
      where: { houseboatId, status: { not: 'paid' } },
      orderBy: { issuedAt: 'asc' },
    });
    if (unpaid.length === 0) {
      return { locked: false, inGrace: false, dueTotal: '0.00', unpaidCount: 0 };
    }
    const graceMs = BILLING_GRACE_DAYS * 24 * 60 * 60 * 1000;
    const now = Date.now();
    // The oldest unpaid invoice drives the clock.
    const oldest = unpaid[0];
    const deadline = oldest.issuedAt.getTime() + graceMs;
    const locked = deadline < now;
    const daysLeft = locked
      ? 0
      : Math.ceil((deadline - now) / (24 * 60 * 60 * 1000));
    const dueTotal = unpaid.reduce(
      (sum, i) => add(sum, money(i.amountDue)),
      ZERO,
    );
    return {
      locked,
      inGrace: !locked,
      daysLeft,
      graceDays: BILLING_GRACE_DAYS,
      dueTotal: dueTotal.toFixed(2),
      unpaidCount: unpaid.length,
    };
  }

  /**
   * Flip issued → overdue once the 14-day grace has elapsed (dashboard signal;
   * the actual edit-lock is enforced live in RbacService.assert). Runs daily.
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async markOverdue(): Promise<void> {
    const cutoff = new Date(
      Date.now() - BILLING_GRACE_DAYS * 24 * 60 * 60 * 1000,
    );
    const res = await this.prisma.houseboatSubscriptionInvoice.updateMany({
      where: { status: 'issued', issuedAt: { lt: cutoff } },
      data: { status: 'overdue' },
    });
    if (res.count > 0) {
      // eslint-disable-next-line no-console
      console.log(`Marked ${res.count} subscription invoice(s) overdue`);
    }
  }
}
