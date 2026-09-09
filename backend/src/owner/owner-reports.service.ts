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

/** Round a Money percentage to a whole number, guarding divide-by-zero. */
function pctOf(part: Money, whole: Money): number {
  return whole.greaterThan(ZERO)
    ? Math.round(part.div(whole).mul(100).toNumber())
    : 0;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** The distinct YYYY-MM period labels a set of month windows covers. */
function rangePeriods(ranges: { from: Date; to: Date }[]): string[] {
  return ranges.map(
    (r) =>
      `${r.from.getUTCFullYear()}-${String(r.from.getUTCMonth() + 1).padStart(2, '0')}`,
  );
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

    // Month-level cost: ALL costs dated in the month (trip-tag ignored) plus
    // salaried crew payroll for the period. Crew/boat overhead the owner enters
    // on the Cost page isn't tied to any one trip, so it only surfaces here —
    // not in the per-departure `costs` below, which stays trip-tagged only.
    const [monthCosts, monthPayroll] = await Promise.all([
      this.prisma.cost.findMany({
        where: { houseboatId, date: { gte: from, lt: to } },
        select: { amount: true },
      }),
      this.prisma.staffPayroll.findMany({
        where: { staff: { houseboatId }, period: label },
        select: { totalAmount: true },
      }),
    ]);

    const [departures, cabinCount] = await Promise.all([
      this.prisma.tripDeparture.findMany({
        where: { package: { houseboatId }, startDate: { gte: from, lt: to } },
        include: {
          package: { select: { durationLabel: true } },
          bookings: {
            where: { status: { in: ['confirmed', 'completed'] } },
            select: {
              cabins: { select: { id: true, occupancy: true } },
              invoice: {
                select: { roomTotal: true, commission: true },
              },
            },
          },
          costs: { select: { amount: true } },
          crew: { select: { staff: { select: { perTripRate: true } } } },
        },
        orderBy: { startDate: 'asc' },
      }),
      // Rated boat capacity — stable, unlike per-departure availableCount which
      // dips while cabins are merely held. Caveat: this is the CURRENT cabin
      // count, so fill% for a past month uses today's capacity if the boat has
      // since added/removed cabins. Accepted trade — stability over exact
      // historical capacity (which we don't snapshot per departure).
      this.prisma.houseboatCabin.count({ where: { deck: { houseboatId } } }),
    ]);

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
        cabinsTotal: Math.max(cabinCount, cabinsSold),
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

    // Whole-month cost & profit/loss — the figures the owner actually reasons
    // about. Profit = room revenue − commission − (all costs + crew payroll).
    const operatingCosts = monthCosts.reduce(
      (s, c) => add(s, money(c.amount)),
      ZERO,
    );
    const crewPayroll = monthPayroll.reduce(
      (s, p) => add(s, money(p.totalAmount)),
      ZERO,
    );
    const totalCost = add(operatingCosts, crewPayroll);
    const profit = sub(sub(totals.revenue, totals.commission), totalCost);

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
      monthly: {
        operatingCosts: operatingCosts.toFixed(2),
        crewPayroll: crewPayroll.toFixed(2),
        totalCost: totalCost.toFixed(2),
        revenue: totals.revenue.toFixed(2),
        commission: totals.commission.toFixed(2),
        profit: profit.toFixed(2),
        costPerTrip: rows.length
          ? totalCost.div(rows.length).toFixed(2)
          : '0.00',
        marginPct: totals.revenue.greaterThan(ZERO)
          ? Math.round(profit.div(totals.revenue).mul(100).toNumber())
          : 0,
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
        totalCost: report.monthly.totalCost,
        profit: report.monthly.profit,
        costPerTrip: report.monthly.costPerTrip,
        fillPct: report.averages.fillPct,
      });
    }
    return { months: out };
  }

  /**
   * Financial overview for the Reports page: headline figures for a chosen
   * period, a cost breakdown, and a 12-month trend series for the charts.
   *
   * `year` present  → the single month `year`-`month` (month defaults to now).
   * `year` absent + `month` present → that calendar month summed across every
   *   year on record ("every January"), so seasonality is visible.
   * both absent → the current month.
   */
  async financials(houseboatId: string, month?: number, year?: number) {
    const now = new Date();
    const mon = month ?? now.getUTCMonth() + 1;

    // The set of [from, to) windows this query covers. One for a single month;
    // one per year on record when aggregating a month across all years.
    let ranges: { from: Date; to: Date }[];
    let periodLabel: string;

    if (year) {
      ranges = [
        {
          from: new Date(Date.UTC(year, mon - 1, 1)),
          to: new Date(Date.UTC(year, mon, 1)),
        },
      ];
      periodLabel = `${year}-${String(mon).padStart(2, '0')}`;
    } else if (month) {
      // Span every year we have data for, from the earliest booking to now.
      const earliest = await this.prisma.tripDeparture.findFirst({
        where: { package: { houseboatId } },
        orderBy: { startDate: 'asc' },
        select: { startDate: true },
      });
      const firstYear = earliest?.startDate.getUTCFullYear() ?? now.getUTCFullYear();
      const lastYear = now.getUTCFullYear();
      ranges = [];
      for (let y = firstYear; y <= lastYear; y++) {
        ranges.push({
          from: new Date(Date.UTC(y, mon - 1, 1)),
          to: new Date(Date.UTC(y, mon, 1)),
        });
      }
      periodLabel = `${MONTH_NAMES[mon - 1]} · all years`;
    } else {
      ranges = [
        {
          from: new Date(Date.UTC(now.getUTCFullYear(), mon - 1, 1)),
          to: new Date(Date.UTC(now.getUTCFullYear(), mon, 1)),
        },
      ];
      periodLabel = `${now.getUTCFullYear()}-${String(mon).padStart(2, '0')}`;
    }

    const agg = await this.aggregateRanges(houseboatId, ranges);

    // 12-month trend ending with the current month — for the charts. Run the
    // twelve monthly aggregations concurrently instead of awaiting each in turn:
    // they are independent reads, so a serial loop just paid 12× the latency and
    // held a connection for the whole chain.
    const months = Array.from({ length: 12 }, (_, k) => {
      const i = 11 - k;
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
      );
      return {
        d,
        label: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
      };
    });
    const trend = await Promise.all(
      months.map(async ({ d, label }) => {
        const m = await this.aggregateRanges(houseboatId, [
          {
            from: d,
            to: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)),
          },
        ]);
        return {
          month: label,
          revenue: m.revenue.toFixed(2),
          totalCost: m.totalCost.toFixed(2),
          profit: m.profit.toFixed(2),
          trips: m.trips,
        };
      }),
    );

    return {
      period: periodLabel,
      month: mon,
      year: year ?? null,
      kpis: {
        revenue: agg.revenue.toFixed(2),
        commission: agg.commission.toFixed(2),
        operatingCosts: agg.operatingCosts.toFixed(2),
        crewPayroll: agg.crewPayroll.toFixed(2),
        totalCost: agg.totalCost.toFixed(2),
        profit: agg.profit.toFixed(2),
        trips: agg.trips,
        guests: agg.guests,
        costPerTrip: agg.trips
          ? agg.totalCost.div(agg.trips).toFixed(2)
          : '0.00',
        revenuePerTrip: agg.trips
          ? agg.revenue.div(agg.trips).toFixed(2)
          : '0.00',
        fillPct: agg.capacity
          ? Math.round((agg.sold / agg.capacity) * 100)
          : 0,
        marginPct: pctOf(agg.profit, agg.revenue),
      },
      costBreakdown: [
        { key: 'operating', label: 'Operating costs', amount: agg.operatingCosts.toFixed(2) },
        { key: 'crew', label: 'Crew payroll', amount: agg.crewPayroll.toFixed(2) },
        { key: 'commission', label: 'Platform commission', amount: agg.commission.toFixed(2) },
      ],
      trend,
    };
  }

  /**
   * Sum revenue, commission, all costs, crew payroll, trips and occupancy
   * across one or more month windows. Shared by every period shape above.
   */
  private async aggregateRanges(
    houseboatId: string,
    ranges: { from: Date; to: Date }[],
  ) {
    const dateOr = ranges.map((r) => ({ gte: r.from, lt: r.to }));

    const [departures, costs, payrolls, cabinCount] = await Promise.all([
      this.prisma.tripDeparture.findMany({
        where: {
          package: { houseboatId },
          OR: dateOr.map((d) => ({ startDate: d })),
        },
        select: {
          bookings: {
            where: { status: { in: ['confirmed', 'completed'] } },
            select: {
              cabins: { select: { id: true, occupancy: true } },
              invoice: { select: { roomTotal: true, commission: true } },
            },
          },
        },
      }),
      this.prisma.cost.findMany({
        where: { houseboatId, OR: dateOr.map((d) => ({ date: d })) },
        select: { amount: true },
      }),
      // Payroll is keyed by a YYYY-MM period string, not a date, so match the
      // set of period labels the ranges cover.
      this.prisma.staffPayroll.findMany({
        where: {
          staff: { houseboatId },
          period: { in: rangePeriods(ranges) },
        },
        select: { totalAmount: true },
      }),
      // Rated boat capacity, stable across live holds (see tripReport). Caveat:
      // CURRENT count — historical-month fill% uses today's capacity if cabins
      // changed since. Accepted trade (stability over per-departure snapshotting).
      this.prisma.houseboatCabin.count({ where: { deck: { houseboatId } } }),
    ]);

    let revenue = ZERO;
    let commission = ZERO;
    let sold = 0;
    let capacity = 0;
    let guests = 0;
    for (const d of departures) {
      let deptSold = 0;
      for (const b of d.bookings) {
        revenue = add(revenue, money(b.invoice?.roomTotal ?? 0));
        commission = add(commission, money(b.invoice?.commission ?? 0));
        deptSold += b.cabins.length;
        for (const c of b.cabins) guests += c.occupancy;
      }
      sold += deptSold;
      // Each departure is generated at full boat capacity; use it (guarding an
      // oversell) rather than the hold-sensitive availableCount.
      capacity += Math.max(cabinCount, deptSold);
    }

    const operatingCosts = costs.reduce((s, c) => add(s, money(c.amount)), ZERO);
    const crewPayroll = payrolls.reduce(
      (s, p) => add(s, money(p.totalAmount)),
      ZERO,
    );
    const totalCost = add(operatingCosts, crewPayroll);
    const profit = sub(sub(revenue, commission), totalCost);

    return {
      revenue,
      commission,
      operatingCosts,
      crewPayroll,
      totalCost,
      profit,
      trips: departures.length,
      sold,
      capacity,
      guests,
    };
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
      sub(sub(roomRevenue, commission), operatingCosts),
      crewPayroll,
    );

    return {
      period: label,
      statement: {
        roomRevenue: roomRevenue.toFixed(2),
        commission: commission.toFixed(2),
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
