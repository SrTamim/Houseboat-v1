import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { money, add, sub, ZERO } from '../common/money';

const DAY_MS = 86_400_000;

/** Midnight-to-midnight UTC bounds for "today". */
function todayRange(): { from: Date; to: Date } {
  const from = new Date();
  from.setUTCHours(0, 0, 0, 0);
  return { from, to: new Date(from.getTime() + DAY_MS) };
}

/** Rolling 7-day window ending now — "this week" on the dashboard. */
function weekRange(): { from: Date; to: Date } {
  const to = new Date();
  return { from: new Date(to.getTime() - 7 * DAY_MS), to };
}

/**
 * The owner console's home screen, in one request.
 *
 * Every KPI, the "needs you now" queue and the sidebar badge counts come from
 * here. That is deliberate: the sidebar renders on every page, and one shared
 * SWR key for the whole console is far cheaper than a dozen count endpoints
 * each page would have to call.
 *
 * Guarded by `reports:view` at the controller.
 */
@Injectable()
export class OwnerDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
  ) {}

  async dashboard(houseboatId: string) {
    const today = todayRange();
    const week = weekRange();

    const [
      boat,
      departuresToday,
      unverifiedCash,
      pendingBatches,
      unpaidPayroll,
      inventory,
      quotes,
      openDamage,
      maintenanceTasks,
      waitlistCount,
      pendingRefunds,
      weekBookings,
      weekCosts,
      recentAudit,
      billingConfig,
      unpaidSubscription,
      locked,
    ] = await Promise.all([
      this.prisma.houseboat.findUniqueOrThrow({
        where: { id: houseboatId },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          profileCompletePct: true,
          bankAccount: true,
          engineHours: true,
        },
      }),
      this.prisma.tripDeparture.findMany({
        where: {
          package: { houseboatId },
          startDate: { gte: today.from, lt: today.to },
        },
        include: {
          package: { select: { durationLabel: true, departureGhat: true } },
          bookings: {
            where: { status: { in: ['confirmed', 'completed'] } },
            select: { id: true, cabins: { select: { id: true, occupancy: true } } },
          },
          crew: { select: { present: true } },
        },
        orderBy: { departureTime: 'asc' },
      }),
      this.prisma.invoicePayment.findMany({
        where: {
          method: 'cash',
          verifiedBy: null,
          invoice: { houseboatId },
        },
        select: { amount: true },
      }),
      this.prisma.houseboatPayoutBatch.findMany({
        where: { houseboatId, status: { in: ['prepared', 'approved'] } },
        select: { totalAmount: true, _count: { select: { invoices: true } } },
      }),
      this.prisma.staffPayroll.count({
        where: { paid: false, staff: { houseboatId } },
      }),
      // Prisma can't compare two columns in a where clause, so the low-stock
      // test happens in JS over the (small) consumable list.
      this.prisma.inventoryItem.findMany({
        where: { houseboatId, kind: 'consumable' },
        select: { id: true, name: true, currentQty: true, reorderThreshold: true },
      }),
      this.prisma.quoteRequest.findMany({
        where: { houseboatId, status: 'requested' },
        select: { id: true, expiresAt: true, groupSize: true },
        orderBy: { expiresAt: 'asc' },
      }),
      this.prisma.damageLog.count({ where: { houseboatId, status: 'open' } }),
      this.prisma.maintenanceTask.findMany({
        where: { houseboatId, status: 'active' },
        select: { dueAtHours: true, dueDate: true, intervalKind: true },
      }),
      this.prisma.bookingWaitlist.count({
        where: { departure: { package: { houseboatId } } },
      }),
      this.prisma.invoiceRefund.count({
        where: { invoice: { houseboatId }, status: { in: ['requested', 'verified'] } },
      }),
      this.prisma.booking.findMany({
        where: {
          departure: { package: { houseboatId } },
          createdAt: { gte: week.from, lte: week.to },
        },
        select: {
          id: true,
          invoice: { select: { roomTotal: true, commission: true } },
        },
      }),
      this.prisma.cost.findMany({
        where: { houseboatId, date: { gte: week.from, lte: week.to } },
        select: { amount: true },
      }),
      this.prisma.auditLog.findMany({
        where: { houseboatId },
        orderBy: { serverTime: 'desc' },
        take: 5,
        select: {
          id: true,
          action: true,
          entityType: true,
          serverTime: true,
          actor: { select: { name: true, phone: true } },
        },
      }),
      this.prisma.houseboatBillingConfig.findFirst({ where: { houseboatId } }),
      this.prisma.houseboatSubscriptionInvoice.findFirst({
        where: { houseboatId, status: { not: 'paid' } },
        orderBy: { issuedAt: 'asc' },
      }),
      this.rbac.isBillingLocked(houseboatId),
    ]);

    const cashTotal = unverifiedCash.reduce(
      (sum, p) => add(sum, money(p.amount)),
      ZERO,
    );
    const payoutTotal = pendingBatches.reduce(
      (sum, b) => add(sum, money(b.totalAmount)),
      ZERO,
    );
    const payoutInvoiceCount = pendingBatches.reduce(
      (sum, b) => sum + b._count.invoices,
      0,
    );

    const lowStock = inventory.filter(
      (i) =>
        i.reorderThreshold !== null &&
        money(i.currentQty).lessThanOrEqualTo(money(i.reorderThreshold)),
    );

    const dueMaintenance = maintenanceTasks.filter((t) => {
      if (t.intervalKind === 'engine_hours' && t.dueAtHours !== null) {
        return boat.engineHours >= t.dueAtHours - 25;
      }
      if (t.intervalKind === 'calendar' && t.dueDate) {
        return t.dueDate.getTime() - Date.now() <= 7 * DAY_MS;
      }
      return false;
    }).length;

    const weekRoom = weekBookings.reduce(
      (sum, b) => add(sum, money(b.invoice?.roomTotal ?? 0)),
      ZERO,
    );
    const weekCommission = weekBookings.reduce(
      (sum, b) => add(sum, money(b.invoice?.commission ?? 0)),
      ZERO,
    );
    const weekCostTotal = weekCosts.reduce(
      (sum, c) => add(sum, money(c.amount)),
      ZERO,
    );

    const departures = departuresToday.map((d) => {
      const cabinsSold = d.bookings.reduce((n, b) => n + b.cabins.length, 0);
      return {
        id: d.id,
        label: d.package.durationLabel,
        ghat: d.package.departureGhat,
        departureTime: d.departureTime,
        status: d.status,
        cabinsSold,
        cabinsTotal: cabinsSold + d.availableCount,
        guests: d.bookings.reduce(
          (n, b) => n + b.cabins.reduce((c, cab) => c + cab.occupancy, 0),
          0,
        ),
        crewPresent: d.crew.filter((c) => c.present).length,
        crewTotal: d.crew.length,
      };
    });

    return {
      boat: {
        id: boat.id,
        name: boat.name,
        slug: boat.slug,
        status: boat.status,
        profileCompletePct: boat.profileCompletePct,
        hasBankAccount: boat.bankAccount != null,
      },
      kpis: {
        departingToday: departures.length,
        cabinsSoldToday: departures.reduce((n, d) => n + d.cabinsSold, 0),
        cabinsTotalToday: departures.reduce((n, d) => n + d.cabinsTotal, 0),
        cashToVerify: unverifiedCash.length,
        cashToVerifyAmount: cashTotal.toFixed(2),
        payoutPending: payoutTotal.toFixed(2),
        payoutInvoiceCount,
        crewUnpaid: unpaidPayroll,
        lowStock: lowStock.length,
        lowStockNames: lowStock.map((i) => i.name),
        quotesWaiting: quotes.length,
        nextQuoteExpiresAt: quotes[0]?.expiresAt ?? null,
      },
      departuresToday: departures,
      week: {
        bookings: weekBookings.length,
        roomRevenue: weekRoom.toFixed(2),
        commission: weekCommission.toFixed(2),
        costs: weekCostTotal.toFixed(2),
        netEstimate: sub(sub(weekRoom, weekCommission), weekCostTotal).toFixed(2),
      },
      billing: {
        locked,
        platformBalance: billingConfig?.platformBalance.toFixed(2) ?? '0.00',
        trialEnds: billingConfig?.trialEnds ?? null,
        unpaidSubscription: unpaidSubscription
          ? {
              id: unpaidSubscription.id,
              period: unpaidSubscription.period,
              amountDue: unpaidSubscription.amountDue.toFixed(2),
              issuedAt: unpaidSubscription.issuedAt,
            }
          : null,
      },
      recentActivity: recentAudit,
      /**
       * Sidebar badge counts. The chrome renders on every page, so it reads
       * these from the single dashboard key rather than firing its own calls.
       */
      badges: {
        departures: departures.length,
        waitlist: waitlistCount,
        quotes: quotes.length,
        payments: unverifiedCash.length,
        refunds: pendingRefunds,
        payroll: unpaidPayroll,
        inventory: lowStock.length,
        maintenance: dueMaintenance + openDamage,
        billing: unpaidSubscription ? 1 : 0,
      },
    };
  }

  /**
   * Month view for the trip calendar: which days the boat operates and what is
   * scheduled on each. `month` is YYYY-MM, defaulting to the current month.
   */
  async calendar(houseboatId: string, month?: string) {
    const now = new Date();
    const [year, mon] = month
      ? month.split('-').map(Number)
      : [now.getUTCFullYear(), now.getUTCMonth() + 1];
    const from = new Date(Date.UTC(year, mon - 1, 1));
    const to = new Date(Date.UTC(year, mon, 1));

    const [boat, departures] = await Promise.all([
      this.prisma.houseboat.findUniqueOrThrow({
        where: { id: houseboatId },
        select: { operatingDates: true },
      }),
      this.prisma.tripDeparture.findMany({
        where: { package: { houseboatId }, startDate: { gte: from, lt: to } },
        include: {
          package: { select: { durationLabel: true, durationDays: true } },
          pricingProfile: { select: { name: true } },
          bookings: {
            where: { status: { in: ['confirmed', 'completed'] } },
            select: { cabins: { select: { id: true } } },
          },
        },
        orderBy: { startDate: 'asc' },
      }),
    ]);

    return {
      month: `${year}-${String(mon).padStart(2, '0')}`,
      operatingDates: boat.operatingDates
        .filter((d) => d >= from && d < to)
        .map((d) => d.toISOString().slice(0, 10)),
      departures: departures.map((d) => {
        const cabinsSold = d.bookings.reduce((n, b) => n + b.cabins.length, 0);
        return {
          id: d.id,
          date: d.startDate.toISOString().slice(0, 10),
          endDate: d.endDate?.toISOString().slice(0, 10) ?? null,
          label: d.package.durationLabel,
          durationDays: d.package.durationDays,
          profile: d.pricingProfile?.name ?? null,
          status: d.status,
          cabinsSold,
          cabinsTotal: cabinsSold + d.availableCount,
        };
      }),
    };
  }
}
