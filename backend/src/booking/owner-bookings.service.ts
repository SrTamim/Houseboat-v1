import {
  BadRequestException,
  Injectable,
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
import { OwnerBookingsQueryDto, PosCheckoutDto } from './dto/owner-bookings.dto';

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
  async posCheckout(houseboatId: string, actorId: string, dto: PosCheckoutDto) {
    const departure = await this.prisma.tripDeparture.findFirst({
      where: { id: dto.departureId, package: { houseboatId } },
      select: { id: true },
    });
    if (!departure) throw new NotFoundException('Departure not found');

    // Find-or-create the walk-in customer. No password: they never log in
    // through this path, and a placeholder hash would be a credential we'd have
    // to manage. They can register later on the same phone.
    const customer = await this.prisma.account.upsert({
      where: { phone: dto.customerPhone },
      update: {},
      create: {
        id: newId(),
        name: dto.customerName,
        phone: dto.customerPhone,
        phoneVerified: false,
      },
      select: { id: true },
    });

    // Take a hold per cabin under the OWNER's account, then convert — the same
    // two steps the customer flow performs.
    const selections: {
      cabinId: string;
      holdId: string;
      adults: number;
      children?: number;
    }[] = [];
    for (const c of dto.cabins) {
      const hold = await this.holds.hold(c.cabinId, dto.departureId, actorId);
      selections.push({
        cabinId: c.cabinId,
        holdId: hold.id,
        adults: c.adults,
        children: c.children,
      });
    }

    const result = await this.booking.checkout(customer.id, actorId, {
      departureId: dto.departureId,
      cabins: selections,
      leadGuestName: dto.customerName,
      leadGuestPhone: dto.customerPhone,
      couponCode: dto.couponCode,
      referenceName: dto.referenceName,
      specialInstructions: dto.specialInstructions,
    });

    // Record the counter payment (owner's own channel) as an unverified payment
    // so it lands in the owner's Payments queue to verify. Non-fatal: the sale
    // itself already succeeded.
    if (dto.paymentMethod && result.invoice) {
      await this.payments
        .recordPayment(result.invoice.id, actorId, false, {
          amount: Number(result.invoice.displayTotal),
          method: dto.paymentMethod,
          receivedBy: actorId,
        })
        .catch(() => undefined);
    }

    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'pos_sale',
      entityType: 'booking',
      entityId: result.booking.id,
      after: {
        cabins: dto.cabins.length,
        customerPhone: dto.customerPhone,
        paymentMethod: dto.paymentMethod ?? null,
      },
    });

    return result;
  }
}
