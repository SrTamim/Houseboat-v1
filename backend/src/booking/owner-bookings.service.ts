import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HoldsService } from './holds.service';
import { BookingService } from './booking.service';
import { PaymentsService } from '../money/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { newId } from '../common/uuid';
import { cursorArgs, toPage } from '../common/paginate';
import {
  OwnerBookingsQueryDto,
  PosCheckoutDto,
  PosQuoteDto,
} from './dto/owner-bookings.dto';

/**
 * The owner's view of bookings on their own boat, plus counter (POS) sales.
 *
 * The customer-facing BookingController answers "my bookings" for the person
 * logged in; an owner needs the opposite axis — every booking on a boat they
 * operate. Same tables, different scoping, so it lives beside the booking
 * domain rather than in the owner module.
 */
@Injectable()
export class OwnerBookingsService {
  private readonly logger = new Logger(OwnerBookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly holds: HoldsService,
    private readonly booking: BookingService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  /** Bookings on this boat, newest first, cursor-paged. */
  async list(houseboatId: string, query: OwnerBookingsQueryDto) {
    const rows = await this.prisma.booking.findMany({
      ...cursorArgs(query),
      where: {
        departure: { package: { houseboatId } },
        ...(query.status ? { status: query.status } : {}),
        ...(query.departureId ? { departureId: query.departureId } : {}),
        ...(query.from || query.to
          ? {
              departure: {
                package: { houseboatId },
                startDate: {
                  ...(query.from ? { gte: new Date(query.from) } : {}),
                  ...(query.to ? { lte: new Date(query.to) } : {}),
                },
              },
            }
          : {}),
        ...(query.q
          ? {
              OR: [
                { customer: { name: { contains: query.q, mode: 'insensitive' } } },
                { customer: { phone: { contains: query.q } } },
                { guests: { some: { name: { contains: query.q, mode: 'insensitive' } } } },
                { guests: { some: { phone: { contains: query.q } } } },
              ],
            }
          : {}),
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        bookedByAccount: { select: { id: true, name: true } },
        departure: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            departureTime: true,
            status: true,
            package: {
              select: {
                durationLabel: true,
                route: { select: { name: true } },
              },
            },
          },
        },
        cabins: {
          select: {
            id: true,
            adults: true,
            children: true,
            occupancy: true,
            roomPrice: true,
            isOpenSeat: true,
            cabin: { select: { id: true, name: true } },
          },
        },
        guests: { select: { name: true, phone: true } },
        invoice: {
          select: {
            id: true,
            status: true,
            displayTotal: true,
            amountPaid: true,
            dueToBoat: true,
            payoutBatchId: true,
            payments: {
              select: { method: true, verifiedBy: true, amount: true },
            },
          },
        },
      },
    });

    return toPage(rows, query);
  }

  /**
   * Mark a booking's departure attendance from the manifest (§4). Orthogonal to
   * Booking.status — this is who physically boarded, set on departure day.
   */
  async setCheckin(
    houseboatId: string,
    bookingId: string,
    actorId: string,
    status: 'pending' | 'checked_in' | 'absent',
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, departure: { package: { houseboatId } } },
      select: { id: true, checkinStatus: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { checkinStatus: status },
      select: { id: true, checkinStatus: true },
    });

    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'booking_checkin',
      entityType: 'booking',
      entityId: bookingId,
      before: { checkinStatus: booking.checkinStatus },
      after: { checkinStatus: status },
    });

    return updated;
  }

  /** Counts per status for the filter bar chips. */
  async statusCounts(houseboatId: string) {
    const rows = await this.prisma.booking.groupBy({
      by: ['status'],
      where: { departure: { package: { houseboatId } } },
      _count: { _all: true },
    });
    const counts: Record<string, number> = {};
    let all = 0;
    for (const r of rows) {
      counts[r.status] = r._count._all;
      all += r._count._all;
    }
    return { all, ...counts };
  }

  // ── Waitlist (owner side) ──────────────────────────────────

  /** Who is waiting, grouped by departure, with the boat's free cabins. */
  async waitlist(houseboatId: string) {
    const rows = await this.prisma.bookingWaitlist.findMany({
      where: { departure: { package: { houseboatId } } },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        departure: {
          select: {
            id: true,
            startDate: true,
            availableCount: true,
            package: { select: { durationLabel: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const byDeparture = new Map<
      string,
      {
        departureId: string;
        date: Date;
        label: string | null;
        cabinsFree: number;
        partySizes: number[];
        entries: { id: string; name: string | null; phone: string; partySize: number }[];
      }
    >();

    for (const r of rows) {
      const entry = byDeparture.get(r.departureId) ?? {
        departureId: r.departureId,
        date: r.departure.startDate,
        label: r.departure.package.durationLabel,
        cabinsFree: r.departure.availableCount,
        partySizes: [],
        entries: [],
      };
      entry.partySizes.push(r.partySize);
      entry.entries.push({
        id: r.id,
        name: r.customer.name,
        phone: r.customer.phone,
        partySize: r.partySize,
      });
      byDeparture.set(r.departureId, entry);
    }

    return { items: [...byDeparture.values()] };
  }

  /**
   * Tell everyone waiting on a departure that a place is free. Notifies all at
   * once by design (plan §2) — the link routes through a normal hold attempt,
   * so first-to-hold wins rather than a stored queue position.
   */
  async notifyWaitlist(houseboatId: string, departureId: string, actorId: string) {
    const departure = await this.prisma.tripDeparture.findFirst({
      where: { id: departureId, package: { houseboatId } },
      include: { package: { select: { houseboat: { select: { name: true } } } } },
    });
    if (!departure) throw new NotFoundException('Departure not found');
    if (departure.availableCount < 1) {
      throw new BadRequestException(
        'No cabins are free on this departure — nothing to notify about',
      );
    }

    const waiting = await this.prisma.bookingWaitlist.findMany({
      where: { departureId },
      include: { customer: { select: { id: true, phone: true, email: true } } },
    });

    const boatName = departure.package.houseboat.name;
    await Promise.all(
      waiting.map((w) =>
        this.notifications.notify({
          accountId: w.customer.id,
          event: 'waitlist_open',
          to: {
            phone: w.customer.phone ?? undefined,
            email: w.customer.email ?? undefined,
          },
          subject: `A place opened on ${boatName}`,
          message: `A cabin just freed on ${boatName}. First to book wins — grab it now.`,
        }),
      ),
    );

    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'waitlist_notified',
      entityType: 'trip_departure',
      entityId: departureId,
      after: { notified: waiting.length },
    });

    return { notified: waiting.length };
  }

  // ── Counter sale (POS) ─────────────────────────────────────

  /**
   * Walk-up sale taken at the counter. The owner books on behalf of a guest who
   * may have no account, so we find-or-create one by phone.
   *
   * This deliberately rides the ordinary hold → checkout path: the partial
   * unique index on active holds is what makes double-booking impossible, and a
   * separate insert path here would bypass it.
   */
  /**
   * Live holds on a departure of this boat, whoever took them. Seeds the counter
   * grid so a cabin another operator is holding shows as unavailable on load,
   * before the availability socket delivers the 'held' event.
   */
  async departureHolds(houseboatId: string, departureId: string) {
    const departure = await this.prisma.tripDeparture.findFirst({
      where: { id: departureId, package: { houseboatId } },
      select: { id: true },
    });
    if (!departure) throw new NotFoundException('Departure not found');
    return this.holds.listActiveForDeparture(departureId);
  }

  /**
   * Read-only price preview for a counter-sale selection — no holds, no writes.
   * Reuses the SAME pricing path as checkout (booking.priceSelection), so the
   * quoted figures can never drift from what the sale is actually billed.
   * Cabins with no configured rate come back `priced:false` so the grid can
   * show a manual-price input instead of erroring.
   */
  async posQuote(houseboatId: string, dto: PosQuoteDto) {
    const departure = await this.prisma.tripDeparture.findFirst({
      where: { id: dto.departureId, package: { houseboatId } },
      select: { id: true },
    });
    if (!departure) throw new NotFoundException('Departure not found');

    const overrides = new Map<string, number>();
    for (const c of dto.cabins) {
      if (c.priceOverride != null) overrides.set(c.cabinId, c.priceOverride);
    }

    const { cabinRows, bill } = await this.booking.priceSelection(
      {
        departureId: dto.departureId,
        cabins: dto.cabins.map((c) => ({
          cabinId: c.cabinId,
          adults: c.adults,
          children: c.children,
          childAges: c.childAges,
        })),
        couponCode: dto.couponCode,
      },
      {
        overrides: overrides.size > 0 ? overrides : undefined,
        ownerDiscount: dto.discount ?? null,
        throwOnUnpriced: false,
        allowOverCapacity: true,
      },
    );

    return {
      perCabin: cabinRows.map((r) => ({
        cabinId: r.cabinId,
        roomPrice: r.roomPrice.toFixed(2),
        priced: r.priced,
      })),
      roomTotal: bill.roomTotal.toFixed(2),
      discountAmount: bill.discountAmount.toFixed(2),
      displayTotal: bill.displayTotal.toFixed(2),
    };
  }

  async posCheckout(houseboatId: string, actorId: string, dto: PosCheckoutDto) {
    const departure = await this.prisma.tripDeparture.findFirst({
      where: { id: dto.departureId, package: { houseboatId } },
      select: { id: true },
    });
    if (!departure) throw new NotFoundException('Departure not found');

    // Find-or-create the walk-in customer. No password: they never log in
    // through this path, and a placeholder hash would be a credential we'd have
    // to manage. They can register later on the same phone.
    //
    // Guard against silently attaching the sale to a stranger: if the typed phone
    // already belongs to an account whose name doesn't match what the operator
    // typed, that is very likely a mistyped number. We refuse (409) unless the
    // operator explicitly confirms attaching to the existing customer — otherwise
    // the walk-in's booking, history and credits would land on someone else.
    const existing = await this.prisma.account.findUnique({
      where: { phone: dto.customerPhone },
      select: { id: true, name: true },
    });

    let customer: { id: string };
    if (existing) {
      const nameMatches =
        (existing.name ?? '').trim().toLowerCase() ===
        dto.customerName.trim().toLowerCase();
      if (!nameMatches && !dto.attachToExisting) {
        throw new ConflictException(
          'An account with this phone already exists under a different name. ' +
            'Confirm you want to attach this sale to that customer, or re-check the number.',
        );
      }
      customer = { id: existing.id };
    } else {
      customer = await this.prisma.account.create({
        data: {
          id: newId(),
          name: dto.customerName,
          phone: dto.customerPhone,
          phoneVerified: false,
        },
        select: { id: true },
      });
    }

    // Build the per-cabin selections that checkout converts. Two ways in:
    //  - `holds`: the counter grid already took the holds on select (and started
    //    the visible countdown), so we just pass those holdIds through. We must
    //    NOT re-hold them — a second hold on the operator's own cabin would trip
    //    uq_cabin_hold_active ("just taken").
    //  - `cabins` (legacy single-request path): hold + convert in one call.
    // A per-cabin manual price (owner-typed, for cabins with no configured rate)
    // is carried in `overrides` so the confirmed invoice bills at that price.
    const selections: {
      cabinId: string;
      holdId: string;
      adults: number;
      children?: number;
      childAges?: number[];
    }[] = [];
    const overrides = new Map<string, number>();
    if (dto.holds && dto.holds.length > 0) {
      for (const h of dto.holds) {
        selections.push({
          cabinId: h.cabinId,
          holdId: h.holdId,
          adults: h.adults,
          children: h.children,
          childAges: h.childAges,
        });
        if (h.priceOverride != null) overrides.set(h.cabinId, h.priceOverride);
      }
    } else if (dto.cabins && dto.cabins.length > 0) {
      for (const c of dto.cabins) {
        const hold = await this.holds.hold(c.cabinId, dto.departureId, actorId);
        selections.push({
          cabinId: c.cabinId,
          holdId: hold.id,
          adults: c.adults,
          children: c.children,
        });
      }
    } else {
      throw new BadRequestException('Select at least one cabin');
    }

    const result = await this.booking.checkout(
      customer.id,
      actorId,
      {
        departureId: dto.departureId,
        cabins: selections,
        leadGuestName: dto.customerName,
        leadGuestPhone: dto.customerPhone,
        couponCode: dto.couponCode,
        referenceName: dto.referenceName,
        specialInstructions: dto.specialInstructions,
      },
      {
        overrides: overrides.size > 0 ? overrides : undefined,
        ownerDiscount: dto.discount ?? null,
        // Counter operator must have priced every cabin (manual price fills the
        // gap), so a genuinely unpriced cabin should still fail loudly here.
        throwOnUnpriced: true,
        // The counter may oversell beyond rated capacity; such a cabin arrives
        // with a manual priceOverride, which prices it. Without an override it
        // stays unpriced and throwOnUnpriced rejects it — the operator must set
        // a price. (The frontend blocks confirm until then.)
        allowOverCapacity: true,
      },
    );

    // Record the counter payment (owner's own channel) as an unverified payment
    // so it lands in the owner's Payments queue to verify. Non-fatal: the sale
    // itself already succeeded.
    //
    // `amountPaid` is what the customer actually handed over — defaults to the
    // full total (unchanged legacy behaviour) and may be a partial deposit. The
    // remaining due is implicit (displayTotal − amountPaid); recordPayment
    // accumulates. A zero payment records nothing and leaves the invoice due.
    const paid = dto.amountPaid ?? Number(result.invoice?.displayTotal ?? 0);
    const attemptedPayment = Boolean(
      dto.paymentMethod && result.invoice && paid > 0,
    );
    // Whether the counter payment actually landed. The sale itself already
    // committed; a payment failure here must NOT silently vanish (money would
    // read as collected while amountPaid stayed 0). We surface it instead so the
    // audit trail stays truthful and the UI can prompt the operator to re-record.
    let paymentRecorded = false;
    if (attemptedPayment && result.invoice && dto.paymentMethod) {
      try {
        await this.payments.recordPayment(result.invoice.id, actorId, false, {
          amount: paid,
          method: dto.paymentMethod,
          receivedBy: actorId,
        });
        paymentRecorded = true;
      } catch (err) {
        // Non-fatal to the sale, but loud: log it and leave paymentRecorded false
        // so the audit `after` below does not claim money was collected.
        this.logger.error(
          `POS payment failed to record for invoice ${result.invoice.id} (booking ${result.booking.id})`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'pos_sale',
      entityType: 'booking',
      entityId: result.booking.id,
      after: {
        cabins: selections.length,
        customerPhone: dto.customerPhone,
        // Only record the method when the payment actually landed — otherwise the
        // trail would show a collection that never happened.
        paymentMethod: paymentRecorded ? dto.paymentMethod : null,
      },
    });

    return {
      ...result,
      // True when a payment was attempted (method + non-zero amount) but did not
      // record — the UI warns the operator to re-record it on the Departure page.
      paymentFailed: attemptedPayment && !paymentRecorded,
    };
  }
}
