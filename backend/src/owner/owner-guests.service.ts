import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { money, add, ZERO } from '../common/money';
import { DEFAULT_PAGE_SIZE } from '../common/paginate';

/**
 * Guest directory — a derived view, not a stored CRM.
 *
 * Everything here is aggregated from bookings and invoices on demand. That is
 * intentional: a persisted guest table would immediately drift from the
 * bookings that define it, and there is nothing an owner records about a guest
 * that isn't already in a booking.
 *
 * Paged by offset rather than cursor: the rows are a grouped aggregate, which
 * Prisma cursors cannot address. Guest counts per boat run to hundreds, so the
 * offset scan is cheap; revisit if a boat ever reaches tens of thousands.
 */
@Injectable()
export class OwnerGuestsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    houseboatId: string,
    opts: { q?: string; offset?: number; limit?: number } = {},
  ) {
    const limit = opts.limit ?? DEFAULT_PAGE_SIZE;
    const offset = opts.offset ?? 0;

    const bookings = await this.prisma.booking.findMany({
      where: {
        departure: { package: { houseboatId } },
        ...(opts.q
          ? {
              customer: {
                OR: [
                  { name: { contains: opts.q, mode: 'insensitive' } },
                  { phone: { contains: opts.q } },
                ],
              },
            }
          : {}),
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        customerId: true,
        customer: { select: { id: true, name: true, phone: true, email: true } },
        departure: { select: { startDate: true } },
        invoice: { select: { displayTotal: true, amountPaid: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const byGuest = new Map<
      string,
      {
        accountId: string;
        name: string | null;
        phone: string;
        email: string | null;
        bookings: number;
        cancellations: number;
        lifetimeValue: ReturnType<typeof money>;
        lastTrip: Date | null;
      }
    >();

    for (const b of bookings) {
      const key = b.customerId;
      const entry = byGuest.get(key) ?? {
        accountId: b.customer.id,
        name: b.customer.name,
        phone: b.customer.phone,
        email: b.customer.email,
        bookings: 0,
        cancellations: 0,
        lifetimeValue: ZERO,
        lastTrip: null as Date | null,
      };
      entry.bookings += 1;
      if (b.status === 'cancelled') entry.cancellations += 1;
      // Lifetime value counts money actually received, not billed.
      entry.lifetimeValue = add(entry.lifetimeValue, money(b.invoice?.amountPaid ?? 0));
      if (!entry.lastTrip || b.departure.startDate > entry.lastTrip) {
        entry.lastTrip = b.departure.startDate;
      }
      byGuest.set(key, entry);
    }

    // Credits are per-account but only those sourced from this boat's invoices
    // are the boat's liability.
    const credits = await this.prisma.customerCredit.groupBy({
      by: ['accountId'],
      where: {
        status: 'open',
        accountId: { in: [...byGuest.keys()] },
        sourceInvoice: { houseboatId },
      },
      _sum: { amount: true },
    });
    const creditByAccount = new Map(
      credits.map((c) => [c.accountId, c._sum.amount]),
    );

    const all = [...byGuest.values()]
      .map((g) => ({
        accountId: g.accountId,
        name: g.name,
        phone: g.phone,
        email: g.email,
        bookings: g.bookings,
        cancellations: g.cancellations,
        lifetimeValue: g.lifetimeValue.toFixed(2),
        lastTrip: g.lastTrip,
        openCredit: money(creditByAccount.get(g.accountId) ?? 0).toFixed(2),
        isRepeat: g.bookings > 1,
      }))
      .sort((a, b) => (b.lastTrip?.getTime() ?? 0) - (a.lastTrip?.getTime() ?? 0));

    const creditTotal = all.reduce((s, g) => add(s, money(g.openCredit)), ZERO);

    return {
      items: all.slice(offset, offset + limit),
      total: all.length,
      offset,
      limit,
      summary: {
        guests: all.length,
        repeat: all.filter((g) => g.isRepeat).length,
        creditHeld: creditTotal.toFixed(2),
        creditGuests: all.filter((g) => money(g.openCredit).greaterThan(ZERO))
          .length,
      },
    };
  }

  /** All guest rows as a CSV string, for the owner's download (§8). */
  async exportCsv(houseboatId: string, q?: string): Promise<string> {
    // Reuse the aggregation with a wide window — guest counts per boat run to
    // hundreds (see the class note), so an unpaginated pull is cheap.
    const { items } = await this.list(houseboatId, { q, limit: 1_000_000, offset: 0 });

    const header = [
      'Name',
      'Phone',
      'Email',
      'Trips',
      'Cancellations',
      'Lifetime value',
      'Last trip',
      'Open credit',
      'Repeat',
    ];
    const esc = (v: unknown) => {
      let s = v === null || v === undefined ? '' : String(v);
      // CSV formula injection: a cell starting with = + - @ (or tab/CR) is run as
      // a formula by Excel/Sheets. Guest names are attacker-controlled, so prefix
      // such values with a single quote to force them to be read as text.
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      // Quote if the value contains a comma, quote, or newline; double inner quotes.
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = items.map((g) =>
      [
        g.name ?? '',
        g.phone,
        g.email ?? '',
        g.bookings,
        g.cancellations,
        g.lifetimeValue,
        g.lastTrip ? g.lastTrip.toISOString().slice(0, 10) : '',
        g.openCredit,
        g.isRepeat ? 'yes' : 'no',
      ]
        .map(esc)
        .join(','),
    );
    return [header.join(','), ...rows].join('\n');
  }
}
