import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../platform/settings/settings.service';
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
    // @Optional() so any positional test construction keeps working; billing
    // grace falls back to the constant when absent.
    @Optional() private readonly settings?: SettingsService,
  ) {}

  /** Editable billing grace in days, falling back to the compiled-in constant. */
  private async graceDays(): Promise<number> {
    return (
      (await this.settings?.getNumber('billing.graceDays')) ?? BILLING_GRACE_DAYS
    );
  }

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
   * commission accrued from settled invoices (paid/payment_verified/
   * payout_approved/in_payout/bill_cleared) in the period.
   * `period` is a YYYY-MM string.
   */
  async issueSubscriptionInvoice(
    houseboatId: string,
    actorId: string | null,
    period: string,
  ) {
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

    // The subscription bill is the monthly fee only. Booking commission is
    // already withheld from the booking money the platform holds, so charging it
    // again here would double-bill the owner.
    const monthlyFee = config.monthlyFee ? money(config.monthlyFee) : ZERO;
    const amountDue = monthlyFee;

    const row = await this.prisma.houseboatSubscriptionInvoice.create({
      data: {
        id: newId(),
        houseboatId,
        billingConfigId: config.id,
        period,
        monthlyFee: config.monthlyFee ?? undefined,
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
  async paySubscriptionInvoice(invoiceId: string, actorId: string | null) {
    const inv = await this.prisma.houseboatSubscriptionInvoice.findUnique({
      where: { id: invoiceId },
    });
    if (!inv) throw new NotFoundException('Subscription invoice not found');
    return this.applyPayment(inv, actorId);
  }

  /**
   * Owner-initiated payment of the owner's OWN subscription invoice. Verifies the
   * invoice belongs to the boat (an owner must never pay another boat's bill) and
   * that it is actually payable, then runs the same paid-transition as the
   * platform path. Placeholder until a real gateway is wired — for now it simply
   * marks the bill paid.
   */
  async payOwnSubscriptionInvoice(
    houseboatId: string,
    invoiceId: string,
    actorId: string,
  ) {
    const inv = await this.prisma.houseboatSubscriptionInvoice.findUnique({
      where: { id: invoiceId },
    });
    if (!inv || inv.houseboatId !== houseboatId) {
      throw new NotFoundException('Subscription invoice not found');
    }
    if (inv.status === 'trial') {
      throw new BadRequestException('A free-trial bill has nothing to pay');
    }
    return this.applyPayment(inv, actorId);
  }

  /** Shared paid-transition: flip to paid + credit the signed platform_balance. */
  private applyPayment(
    inv: {
      id: string;
      houseboatId: string;
      status: string;
      amountDue: Prisma.Decimal;
    },
    actorId: string | null,
  ) {
    if (inv.status === 'paid') {
      throw new BadRequestException('Already paid');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.houseboatSubscriptionInvoice.update({
        where: { id: inv.id },
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
          entityId: inv.id,
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
   * Owner-facing billing config values (platform balance + trial end). The owner
   * billing page reads these from billingStatus; without them its KPIs render
   * blank. Kept in sync with owner-dashboard.service.ts's billing block.
   */
  private async billingConfigView(houseboatId: string) {
    const config = await this.prisma.houseboatBillingConfig.findFirst({
      where: { houseboatId },
      select: { platformBalance: true, trialEnds: true },
    });
    return {
      platformBalance: config?.platformBalance.toFixed(2) ?? '0.00',
      trialEnds: config?.trialEnds ?? null,
    };
  }

  /**
   * Billing status for a boat's dashboard: whether it's currently within the
   * grace window, how many days remain to pay, or already locked. Never blocks —
   * this is the read the owner sees to know they must pay.
   *
   * Trial invoices ($0, status 'trial') are excluded everywhere they'd read as
   * debt: they must never count toward the amount due or drive the lock clock.
   */
  async billingStatus(houseboatId: string) {
    const configView = await this.billingConfigView(houseboatId);
    const unpaid = await this.prisma.houseboatSubscriptionInvoice.findMany({
      where: { houseboatId, status: { notIn: ['paid', 'trial'] } },
      orderBy: { issuedAt: 'asc' },
    });
    const graceDays = await this.graceDays();
    if (unpaid.length === 0) {
      return {
        locked: false,
        inGrace: false,
        dueTotal: '0.00',
        unpaidCount: 0,
        graceDays,
        ...configView,
      };
    }
    const graceMs = graceDays * 24 * 60 * 60 * 1000;
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
      graceDays,
      dueTotal: dueTotal.toFixed(2),
      unpaidCount: unpaid.length,
      ...configView,
    };
  }

  /**
   * Flip issued → overdue once the 14-day grace has elapsed (dashboard signal;
   * the actual edit-lock is enforced live in RbacService.assert). Runs daily.
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async markOverdue(): Promise<void> {
    const graceDays = await this.graceDays();
    const cutoff = new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000);
    const res = await this.prisma.houseboatSubscriptionInvoice.updateMany({
      where: { status: 'issued', issuedAt: { lt: cutoff } },
      data: { status: 'overdue' },
    });
    if (res.count > 0) {
      console.log(`Marked ${res.count} subscription invoice(s) overdue`);
    }
  }

  /** UTC last instant of a YYYY-MM period, used to decide trial-vs-monthly. */
  private periodEnd(period: string): Date {
    const [year, mon] = period.split('-').map(Number);
    // First day of the NEXT month, minus 1ms → end of this period.
    return new Date(Date.UTC(year, mon, 1) - 1);
  }

  /**
   * Issue the correct bill for one boat for one period, choosing trial vs
   * monthly automatically:
   *   • trial still active (trialEnds set AND covers this period's end) →
   *     a $0 trial invoice (status 'trial'). issuedAt marks the trial start on
   *     the owner page; trialEnds is the end. It carries no fee/commission and
   *     is excluded from every "amount due" / lock query.
   *   • trial ended (or none) → the normal monthly invoice (fee + commission),
   *     via issueSubscriptionInvoice.
   *
   * Idempotent: skips if a boat already has any invoice for `period`. Skips a
   * boat with no billing config (nothing to bill yet). Returns the created row,
   * or null when skipped.
   */
  async issueDueInvoiceForPeriod(
    houseboatId: string,
    actorId: string | null,
    period: string,
  ) {
    if (!/^\d{4}-\d{2}$/.test(period)) {
      throw new BadRequestException('period must be YYYY-MM');
    }
    const config = await this.prisma.houseboatBillingConfig.findFirst({
      where: { houseboatId },
    });
    if (!config) return null;

    const existing = await this.prisma.houseboatSubscriptionInvoice.findFirst({
      where: { houseboatId, period },
    });
    if (existing) return null;

    const trialActive =
      config.trialEnds != null && config.trialEnds >= this.periodEnd(period);

    if (!trialActive) {
      return this.issueSubscriptionInvoice(houseboatId, actorId, period);
    }

    const row = await this.prisma.houseboatSubscriptionInvoice.create({
      data: {
        id: newId(),
        houseboatId,
        billingConfigId: config.id,
        period,
        monthlyFee: null,
        amountDue: ZERO,
        status: 'trial',
      },
    });
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'subscription_trial_issue',
      entityType: 'houseboat_subscription_invoice',
      entityId: row.id,
      after: { period, trialEnds: config.trialEnds?.toISOString().slice(0, 10) },
    });
    return row;
  }

  /**
   * Monthly billing run: on the 1st, issue every boat with a billing config its
   * bill for the current period (trial $0 or monthly fee). Idempotent per
   * period, so a manual mid-month run or a re-fire never double-bills.
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async issueMonthlyInvoices(): Promise<void> {
    const now = new Date();
    const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const configs = await this.prisma.houseboatBillingConfig.findMany({
      select: { houseboatId: true },
    });
    let issued = 0;
    for (const c of configs) {
      // Cron has no human actor → null actorAccountId (nullable FK on audit_log).
      const row = await this.issueDueInvoiceForPeriod(
        c.houseboatId,
        null,
        period,
      );
      if (row) issued++;
    }
    if (issued > 0) {
      console.log(`Issued ${issued} subscription invoice(s) for ${period}`);
    }
  }
}
