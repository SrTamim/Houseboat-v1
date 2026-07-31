import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { money, add, sub, ZERO, Money } from '../common/money';

/** Month bounds [from, to) in UTC for a YYYY-MM string (defaults to now). */
function monthRange(month?: string): { from: Date; to: Date; label: string } {
  const now = new Date();
  const [year, mon] = month
    ? month.split('-').map(Number)
    : [now.getUTCFullYear(), now.getUTCMonth() + 1];
  return {
    from: new Date(Date.UTC(year, mon - 1, 1)),
    to: new Date(Date.UTC(year, mon, 1)),
    label: `${year}-${String(mon).padStart(2, '0')}`,
  };
}

/**
 * Profit reporting — per trip and per month.
 *
 * Costs attach to a departure only when the owner tagged them with a trip;
 * untagged costs are boat-level overhead and are reported separately rather
 * than being spread across trips, because any allocation would be invented.
 */
@Injectable()
export class OwnerReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Profit per departure for one month. */
  async tripReport(houseboatId: string, month?: string) {
    const { from, to, label } = monthRange(month);

    const departures = await this.prisma.tripDeparture.findMany({
      where: { package: { houseboatId }, startDate: { gte: from, lt: to } },
      include: {
        package: { select: { durationLabel: true } },
        bookings: {
          where: { status: { in: ['confirmed', 'completed'] } },
          select: {
            cabins: { select: { id: true, occupancy: true } },
            invoice: {
              select: { roomTotal: true, commission: true, gatewayFee: true },
            },
          },
        },
        costs: { select: { amount: true } },
        crew: { select: { staff: { select: { perTripRate: true } } } },
      },
      orderBy: { startDate: 'asc' },
    });

    const rows = departures.map((d) => {
      const revenue = d.bookings.reduce(
        (s, b) => add(s, money(b.invoice?.roomTotal ?? 0)),
        ZERO,
      );
      const commission = d.bookings.reduce(
        (s, b) => add(s, money(b.invoice?.commission ?? 0)),
        ZERO,
      );
      const costs = d.costs.reduce((s, c) => add(s, money(c.amount)), ZERO);
      // Salaried crew are paid monthly regardless of trips, so only per-trip
      // rates are a cost *of this trip*.
      const crew = d.crew.reduce(
        (s, c) => add(s, money(c.staff.perTripRate ?? 0)),
        ZERO,
      );
      const cabinsSold = d.bookings.reduce((n, b) => n + b.cabins.length, 0);

      return {
        departureId: d.id,
        date: d.startDate.toISOString().slice(0, 10),
        label: d.package.durationLabel,
        status: d.status,
        cabinsSold,
        cabinsTotal: cabinsSold + d.availableCount,
        guests: d.bookings.reduce(
          (n, b) => n + b.cabins.reduce((c, cab) => c + cab.occupancy, 0),
          0,
        ),
        revenue: revenue.toFixed(2),
        commission: commission.toFixed(2),
        costs: costs.toFixed(2),
        crew: crew.toFixed(2),
        net: sub(sub(sub(revenue, commission), costs), crew).toFixed(2),
      };
    });

    const sumOf = (pick: (r: (typeof rows)[number]) => string): Money =>
      rows.reduce((s, r) => add(s, money(pick(r))), ZERO);

    const totals = {
      revenue: sumOf((r) => r.revenue),
      commission: sumOf((r) => r.commission),
      costs: sumOf((r) => r.costs),
      crew: sumOf((r) => r.crew),
      net: sumOf((r) => r.net),
    };

    const soldTotal = rows.reduce((n, r) => n + r.cabinsSold, 0);
    const capacityTotal = rows.reduce((n, r) => n + r.cabinsTotal, 0);

    return {
      month: label,
      trips: rows,
      totals: {
        revenue: totals.revenue.toFixed(2),
        commission: totals.commission.toFixed(2),
        costs: totals.costs.toFixed(2),
        crew: totals.crew.toFixed(2),
        net: totals.net.toFixed(2),
      },
      averages: {
        fillPct: capacityTotal
          ? Math.round((soldTotal / capacityTotal) * 100)
          : 0,
        revenuePerTrip: rows.length
          ? money(totals.revenue).div(rows.length).toFixed(2)
          : '0.00',
        marginPct: totals.revenue.greaterThan(ZERO)
          ? Math.round(
              totals.net.div(totals.revenue).mul(100).toNumber(),
            )
          : 0,
      },
    };
  }

  /** Rolling month-by-month summary, most recent last. */
  async monthlyReport(houseboatId: string, months = 6) {
    const now = new Date();
    const out = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
      );
      const label = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const report = await this.tripReport(houseboatId, label);
      out.push({
        month: label,
        trips: report.trips.length,
        ...report.totals,
        fillPct: report.averages.fillPct,
      });
    }
    return { months: out };
  }

  /**
   * Earnings statement for a period: what the boat billed, what the platform
   * took, what actually landed, and what the owner spent running it.
   */
  async earnings(houseboatId: string, month?: string) {
    const { from, to, label } = monthRange(month);

    const [invoices, payouts, distributions, costs, payroll, subscription] =
      await Promise.all([
        // Invoices have no timestamp of their own; scope by the booking that
        // created them, which is when the money was actually committed.
        this.prisma.invoice.findMany({
          where: {
            houseboatId,
            booking: { createdAt: { gte: from, lt: to } },
          },
          select: {
            roomTotal: true,
            commission: true,
            gatewayFee: true,
            dueToBoat: true,
            amountPaid: true,
          },
        }),
        this.prisma.houseboatPayoutBatch.findMany({
          where: { houseboatId, status: 'paid', paidAt: { gte: from, lt: to } },
          select: { totalAmount: true },
        }),
        this.prisma.ownerDistribution.findMany({
          where: { houseboatId, at: { gte: from, lt: to } },
          include: {
            membership: {
              select: {
                id: true,
                shareholderPct: true,
                account: { select: { name: true, phone: true } },
              },
            },
          },
        }),
        this.prisma.cost.findMany({
          where: { houseboatId, date: { gte: from, lt: to } },
          select: { amount: true },
        }),
        this.prisma.staffPayroll.findMany({
          where: { staff: { houseboatId }, period: label },
          select: { totalAmount: true },
        }),
        this.prisma.houseboatSubscriptionInvoice.findMany({
          where: { houseboatId, period: label },
          select: { amountDue: true, status: true },
        }),
      ]);

    const roomRevenue = invoices.reduce((s, i) => add(s, money(i.roomTotal)), ZERO);
    const commission = invoices.reduce((s, i) => add(s, money(i.commission)), ZERO);
    const gatewayFees = invoices.reduce((s, i) => add(s, money(i.gatewayFee)), ZERO);
    const payoutsReceived = payouts.reduce(
      (s, p) => add(s, money(p.totalAmount)),
      ZERO,
    );
    const operatingCosts = costs.reduce((s, c) => add(s, money(c.amount)), ZERO);
    const crewPayroll = payroll.reduce(
      (s, p) => add(s, money(p.totalAmount)),
      ZERO,
    );
    const subscriptionFees = subscription.reduce(
      (s, i) => add(s, money(i.amountDue)),
      ZERO,
    );

    const net = sub(
      sub(sub(sub(roomRevenue, commission), gatewayFees), operatingCosts),
      crewPayroll,
    );

    return {
      period: label,
      statement: {
        roomRevenue: roomRevenue.toFixed(2),
        commission: commission.toFixed(2),
        gatewayFees: gatewayFees.toFixed(2),
        payoutsReceived: payoutsReceived.toFixed(2),
        operatingCosts: operatingCosts.toFixed(2),
        crewPayroll: crewPayroll.toFixed(2),
        subscriptionFees: subscriptionFees.toFixed(2),
        net: net.toFixed(2),
      },
      distributions: distributions.map((d) => ({
        id: d.id,
        membershipId: d.membershipId,
        name: d.membership.account.name ?? d.membership.account.phone,
        shareholderPct: d.membership.shareholderPct
          ? Number(d.membership.shareholderPct)
          : null,
        amount: d.amount.toFixed(2),
        note: d.note,
        at: d.at,
      })),
      distributionsTotal: distributions
        .reduce((s, d) => add(s, money(d.amount)), ZERO)
        .toFixed(2),
    };
  }
}
