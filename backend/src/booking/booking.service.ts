import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { AuditService } from '../audit/audit.service';
import { RbacService } from '../rbac/rbac.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AvailabilityGateway } from '../realtime/availability.gateway';
import { newId } from '../common/uuid';
import { money, ZERO, add, sub } from '../common/money';
import { buildBill, CouponInput } from '../common/billing';
import { priceForParty, ChildBand } from '../common/child-policy';
import {
  refundPercent,
  refundAmount,
  daysUntil,
  PolicySnapshot,
} from '../common/cancellation';
import { InvoiceStatus, assertTransition } from '../money/invoice-state';
import { CheckoutDto } from './dto/booking.dto';

/**
 * Booking + checkout. Converts held cabins into a confirmed booking, its
 * booking_cabin rows, and a single invoice — atomically (plan §11).
 *
 * Price is set at the ROOM SELECTION step from adults+children and the date's
 * pricing profile. The invoice is built with the fixed bill order (billing.ts).
 * Confirmation is instant; no owner approval.
 */
@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly audit: AuditService,
    private readonly rbac: RbacService,
    private readonly notifications: NotificationsService,
    private readonly realtime: AvailabilityGateway,
  ) {}

  /** Notify every waitlisted customer that a place freed (plan §2, all at once). */
  private async notifyWaitlist(
    departureId: string,
    boatName: string,
  ): Promise<void> {
    const waiting = await this.prisma.bookingWaitlist.findMany({
      where: { departureId },
      include: { customer: { select: { id: true, phone: true, email: true } } },
    });
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
  }

  /**
   * Spend the customer's open credits toward an invoice, up to `cap` (the amount
   * owed). Consumes credits oldest-first; a credit larger than the remaining cap
   * is split (the leftover stays open). Returns the total credit applied.
   */
  private async applyCredits(
    tx: Prisma.TransactionClient,
    accountId: string,
    invoiceId: string,
    cap: Prisma.Decimal,
  ): Promise<Prisma.Decimal> {
    const credits = await tx.customerCredit.findMany({
      where: { accountId, status: 'open' },
      orderBy: { id: 'asc' }, // UUIDv7 ids are time-ordered → FIFO
    });
    let remaining = money(cap);
    let applied = ZERO;
    for (const c of credits) {
      if (!remaining.greaterThan(ZERO)) break;
      const amt = money(c.amount);
      if (amt.greaterThan(remaining)) {
        // Partially spend: close this credit for `remaining`, reopen the rest.
        await tx.customerCredit.update({
          where: { id: c.id },
          data: { amount: remaining, status: 'used', usedInInvoiceId: invoiceId },
        });
        await tx.customerCredit.create({
          data: {
            id: newId(),
            accountId,
            sourceInvoiceId: c.sourceInvoiceId,
            amount: sub(amt, remaining),
            status: 'open',
          },
        });
        applied = add(applied, remaining);
        remaining = ZERO;
      } else {
        await tx.customerCredit.update({
          where: { id: c.id },
          data: { status: 'used', usedInInvoiceId: invoiceId },
        });
        applied = add(applied, amt);
        remaining = sub(remaining, amt);
      }
    }
    return applied;
  }

  private async resolveCoupon(
    houseboatId: string,
    code: string | undefined,
    when: Date,
  ): Promise<{ id: string; input: CouponInput } | null> {
    if (!code) return null;
    const coupon = await this.prisma.coupon.findFirst({
      where: {
        houseboatId,
        code,
        OR: [{ validFrom: null }, { validFrom: { lte: when } }],
        AND: [{ OR: [{ validTo: null }, { validTo: { gte: when } }] }],
      },
    });
    if (!coupon) return null;
    return {
      id: coupon.id,
      input: {
        kind: coupon.kind as CouponInput['kind'],
        value: money(coupon.value),
      },
    };
  }

  /**
   * Checkout: caller must already hold every cabin (holdId per cabin). We
   * convert the holds, create booking + cabins + invoice in one transaction.
   * If any hold is not valid/owned, the whole thing rolls back.
   */
  async checkout(customerId: string, bookedBy: string, dto: CheckoutDto) {
    const departure = await this.prisma.tripDeparture.findUnique({
      where: { id: dto.departureId },
      include: { package: { include: { houseboat: { select: { id: true, childPolicy: true } } } } },
    });
    if (!departure) throw new NotFoundException('Departure not found');
    if (departure.status !== 'scheduled') {
      throw new BadRequestException('Departure is no longer bookable');
    }
    const houseboatId = departure.package.houseboatId;

    const billing = await this.prisma.houseboatBillingConfig.findFirst({
      where: { houseboatId },
    });
    const gatewayFeePct = money(billing?.gatewayFeePct ?? 0);
    const commissionPct = billing?.commissionPct
      ? money(billing.commissionPct)
      : null;

    // Compute each cabin's room price from its category + occupancy + date.
    const cabinRows: {
      cabinId: string;
      holdId: string;
      adults: number;
      children: number;
      occupancy: number;
      roomPrice: Prisma.Decimal;
      isOpenSeat: boolean;
    }[] = [];
    let roomTotal = ZERO;

    for (const sel of dto.cabins) {
      const cabin = await this.prisma.houseboatCabin.findUnique({
        where: { id: sel.cabinId },
        include: { category: true },
      });
      if (!cabin) throw new NotFoundException(`Cabin ${sel.cabinId} not found`);

      const children = sel.children ?? 0;
      const occupancy = sel.adults + children;
      const baseCap = cabin.category.baseCapacity;
      const cap = cabin.category.extendedCapacity ?? baseCap;
      if (occupancy > cap) {
        throw new BadRequestException(
          `Cabin ${cabin.name}: ${occupancy} exceeds capacity ${cap}`,
        );
      }

      // Open seat (plan §3): the party doesn't fill the room and chooses to share
      // the spare place(s). It's priced at the full-capacity BUYOUT, and the room
      // is offered to others until it fills.
      const isOpenSeat = Boolean(sel.openSeat) && occupancy < baseCap;
      if (sel.openSeat && occupancy >= baseCap) {
        throw new BadRequestException(
          `Cabin ${cabin.name}: it is already full — no open seat to share`,
        );
      }

      // Buyout price for an open seat = full base capacity at the owner-set rate.
      // Otherwise the room total is the per-person rate for this occupancy tier
      // applied per party member — children charged per the boat's child_policy.
      let roomPrice: Prisma.Decimal;
      if (isOpenSeat) {
        roomPrice = await this.pricing.priceFor(
          houseboatId,
          cabin.cabinCategoryId,
          baseCap,
          departure.startDate,
        );
      } else {
        const perPerson = await this.pricing.pricePerPersonFor(
          houseboatId,
          cabin.cabinCategoryId,
          occupancy,
          departure.startDate,
        );
        roomPrice = priceForParty({
          pricePerPerson: perPerson,
          adults: sel.adults,
          children,
          childAges: sel.childAges,
          childPolicy: departure.package.houseboat.childPolicy as
            | ChildBand[]
            | null,
        });
      }
      roomTotal = add(roomTotal, roomPrice);
      cabinRows.push({
        cabinId: sel.cabinId,
        holdId: sel.holdId,
        adults: sel.adults,
        children,
        occupancy,
        roomPrice,
        isOpenSeat,
      });
    }

    const coupon = await this.resolveCoupon(
      houseboatId,
      dto.couponCode,
      departure.startDate,
    );
    const bill = buildBill({
      roomTotal,
      gatewayFeePct,
      commissionPct,
      coupon: coupon?.input,
    });

    return this.prisma.$transaction(async (tx) => {
      // Convert each hold. If a hold isn't held/owned, abort (rolls back).
      for (const row of cabinRows) {
        const converted = await tx.cabinHold.updateMany({
          where: {
            id: row.holdId,
            cabinId: row.cabinId,
            departureId: dto.departureId,
            heldBy: bookedBy,
            state: 'held',
          },
          data: { state: 'converted' },
        });
        if (converted.count !== 1) {
          throw new BadRequestException(
            'A held cabin expired or was taken — please re-select',
          );
        }
      }

      const booking = await tx.booking.create({
        data: {
          id: newId(),
          departureId: dto.departureId,
          customerId,
          bookedBy,
          type: 'cabin',
          headcount: cabinRows.reduce((n, r) => n + r.occupancy, 0),
          specialInstructions: dto.specialInstructions,
          couponId: coupon?.id,
          referenceName: dto.referenceName,
          status: 'confirmed',
        },
      });

      await tx.bookingCabin.createMany({
        data: cabinRows.map((r) => ({
          id: newId(),
          bookingId: booking.id,
          cabinId: r.cabinId,
          adults: r.adults,
          children: r.children,
          occupancy: r.occupancy,
          roomPrice: r.roomPrice,
          isOpenSeat: r.isOpenSeat,
        })),
      });

      await tx.bookingGuest.create({
        data: {
          id: newId(),
          bookingId: booking.id,
          name: dto.leadGuestName,
          phone: dto.leadGuestPhone,
        },
      });

      const invoice = await tx.invoice.create({
        data: {
          id: newId(),
          bookingId: booking.id,
          houseboatId,
          customerId,
          roomTotal: bill.roomTotal,
          gatewayFee: bill.gatewayFee,
          priceShown: bill.priceShown,
          discountAmount: bill.discountAmount,
          displayTotal: bill.displayTotal,
          commission: bill.commission,
          dueToBoat: ZERO,
          amountPaid: ZERO,
          status: 'customer_due',
          policySnapshot: await this.policySnapshot(tx, houseboatId),
        },
      });

      // Apply the customer's open credits toward this invoice (plan §credit).
      if (dto.useCredit) {
        const applied = await this.applyCredits(
          tx,
          customerId,
          invoice.id,
          bill.displayTotal,
        );
        if (applied.greaterThan(ZERO)) {
          const status = applied.greaterThanOrEqualTo(bill.displayTotal)
            ? 'paid'
            : 'customer_due';
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { amountPaid: applied, status },
          });
          invoice.amountPaid = applied;
          invoice.status = status;
        }
      }

      await this.audit.log(
        {
          houseboatId,
          actorAccountId: bookedBy,
          action: 'booking_create',
          entityType: 'booking',
          entityId: booking.id,
          after: { invoiceId: invoice.id, displayTotal: bill.displayTotal.toFixed(2) },
        },
        tx,
      );

      return { booking, invoice };
    });
  }

  /**
   * Group / full-boat buyout checkout (plan §1 Group bookings). The customer
   * picks a band and types a headcount; if it falls in a band, the band's
   * total_price becomes the whole bill — ONE total, ONE payer, no per-guest
   * split. The buyout takes the entire departure, so availability drops to 0.
   */
  async groupCheckout(
    customerId: string,
    bookedBy: string,
    dto: {
      departureId: string;
      headcount: number;
      leadGuestName: string;
      leadGuestPhone?: string;
      specialInstructions?: string;
      referenceName?: string;
      useCredit?: boolean;
    },
  ) {
    const departure = await this.prisma.tripDeparture.findUnique({
      where: { id: dto.departureId },
      include: { package: { select: { houseboatId: true } } },
    });
    if (!departure) throw new NotFoundException('Departure not found');
    if (departure.status !== 'scheduled') {
      throw new BadRequestException('Departure is no longer bookable');
    }
    if (departure.availableCount <= 0) {
      throw new BadRequestException('Departure is not available for buyout');
    }
    const houseboatId = departure.package.houseboatId;

    // Band lookup rejects a headcount outside every band.
    const band = await this.pricing.bandForHeadcount(houseboatId, dto.headcount);

    const billing = await this.prisma.houseboatBillingConfig.findFirst({
      where: { houseboatId },
    });
    const gatewayFeePct = money(billing?.gatewayFeePct ?? 0);
    const commissionPct = billing?.commissionPct
      ? money(billing.commissionPct)
      : null;

    // The band price IS the room total; no coupon on group buyout (spec §1).
    const bill = buildBill({
      roomTotal: money(band.totalPrice),
      gatewayFeePct,
      commissionPct,
    });

    return this.prisma.$transaction(async (tx) => {
      // Buyout takes the whole boat — no more cabin bookings on this departure.
      const dep = await tx.tripDeparture.update({
        where: { id: dto.departureId },
        data: { availableCount: 0 },
        select: { id: true },
      });

      const booking = await tx.booking.create({
        data: {
          id: newId(),
          departureId: dto.departureId,
          customerId,
          bookedBy,
          type: 'group',
          headcount: dto.headcount,
          specialInstructions: dto.specialInstructions,
          referenceName: dto.referenceName,
          status: 'confirmed',
        },
      });

      await tx.bookingGuest.create({
        data: {
          id: newId(),
          bookingId: booking.id,
          name: dto.leadGuestName,
          phone: dto.leadGuestPhone,
        },
      });

      const invoice = await tx.invoice.create({
        data: {
          id: newId(),
          bookingId: booking.id,
          houseboatId,
          customerId,
          roomTotal: bill.roomTotal,
          gatewayFee: bill.gatewayFee,
          priceShown: bill.priceShown,
          discountAmount: bill.discountAmount,
          displayTotal: bill.displayTotal,
          commission: bill.commission,
          dueToBoat: ZERO,
          amountPaid: ZERO,
          status: 'customer_due',
          policySnapshot: await this.policySnapshot(tx, houseboatId),
        },
      });

      if (dto.useCredit) {
        const applied = await this.applyCredits(
          tx,
          customerId,
          invoice.id,
          bill.displayTotal,
        );
        if (applied.greaterThan(ZERO)) {
          const status = applied.greaterThanOrEqualTo(bill.displayTotal)
            ? 'paid'
            : 'customer_due';
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { amountPaid: applied, status },
          });
          invoice.amountPaid = applied;
          invoice.status = status;
        }
      }

      await this.audit.log(
        {
          houseboatId,
          actorAccountId: bookedBy,
          action: 'group_booking_create',
          entityType: 'booking',
          entityId: booking.id,
          after: {
            headcount: dto.headcount,
            bandTotal: money(band.totalPrice).toFixed(2),
            displayTotal: bill.displayTotal.toFixed(2),
          },
        },
        tx,
      );

      // Realtime: the boat is now fully booked out for this departure.
      this.realtime.emitAvailability(dep.id, 0);

      return { booking, invoice };
    });
  }

  /** Snapshot the boat's cancellation policy onto the invoice (dispute evidence). */
  private async policySnapshot(
    tx: Prisma.TransactionClient,
    houseboatId: string,
  ) {
    const policy = await tx.cancellationPolicy.findFirst({
      where: { houseboatId },
    });
    return policy
      ? ({
          template: policy.policyTemplate,
          depositPct: policy.depositPct,
          tiers: policy.tiers,
        } as Prisma.InputJsonValue)
      : Prisma.JsonNull;
  }

  /**
   * Reschedule a booking to another departure (plan §4 Path C "Reschedule").
   * The invoice REPRICES at the new date's prices; the advance already paid
   * carries over. If the advance now exceeds the new total, the surplus becomes
   * a CustomerCredit. The previous trip is kept on record (reschedule history).
   *
   * Caller must have bookings:edit on the boat (checked by the controller guard).
   */
  async reschedule(
    bookingId: string,
    actorId: string,
    isPlatform: boolean,
    newDepartureId: string,
    reason?: string,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { invoice: true, cabins: { include: { cabin: true } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (!booking.invoice) throw new BadRequestException('Booking has no invoice');

    // Reschedule is an owner-side action — require bookings:edit on the boat.
    await this.rbac.assert(
      actorId,
      isPlatform,
      booking.invoice.houseboatId,
      'bookings',
      'edit',
    );
    if (booking.departureId === newDepartureId) {
      throw new BadRequestException('Already on that departure');
    }

    const newDep = await this.prisma.tripDeparture.findUnique({
      where: { id: newDepartureId },
      include: { package: { select: { houseboatId: true } } },
    });
    if (!newDep) throw new NotFoundException('Target departure not found');
    if (newDep.status !== 'scheduled') {
      throw new BadRequestException('Target departure is not bookable');
    }
    const houseboatId = newDep.package.houseboatId;
    if (houseboatId !== booking.invoice.houseboatId) {
      throw new BadRequestException('Cannot reschedule to a different boat');
    }

    // Reprice each cabin at the NEW date.
    const billing = await this.prisma.houseboatBillingConfig.findFirst({
      where: { houseboatId },
    });
    const gatewayFeePct = money(billing?.gatewayFeePct ?? 0);
    const commissionPct = billing?.commissionPct
      ? money(billing.commissionPct)
      : null;

    let roomTotal = ZERO;
    for (const bc of booking.cabins) {
      const price = await this.pricing.priceFor(
        houseboatId,
        bc.cabin.cabinCategoryId,
        bc.occupancy,
        newDep.startDate,
      );
      roomTotal = add(roomTotal, price);
    }
    // Reschedule does not re-apply the original coupon (fresh date, fresh bill).
    const bill = buildBill({ roomTotal, gatewayFeePct, commissionPct });

    const oldPrice = money(booking.invoice.displayTotal);
    const paid = money(booking.invoice.amountPaid);
    const surplus = paid.greaterThan(bill.displayTotal)
      ? sub(paid, bill.displayTotal)
      : ZERO;

    return this.prisma.$transaction(async (tx) => {
      await tx.bookingRescheduleHistory.create({
        data: {
          id: newId(),
          bookingId,
          prevDepartureId: booking.departureId,
          changedToDepartureId: newDepartureId,
          oldPrice,
          newPrice: bill.displayTotal,
          reason,
          changedBy: actorId,
        },
      });

      // Move the booking + reprice its invoice. amountPaid carries over.
      // In-place reschedule: the booking moves to the new departure. The full
      // chain lives in booking_reschedule_history (schema note on reschedule_of),
      // so we don't create a successor row or self-reference here.
      await tx.booking.update({
        where: { id: bookingId },
        data: { departureId: newDepartureId },
      });
      const invoice = await tx.invoice.update({
        where: { id: booking.invoice!.id },
        data: {
          roomTotal: bill.roomTotal,
          gatewayFee: bill.gatewayFee,
          priceShown: bill.priceShown,
          discountAmount: bill.discountAmount,
          displayTotal: bill.displayTotal,
          commission: bill.commission,
          // Surplus is pulled out as credit, so cap recorded paid at the new total.
          amountPaid: surplus.greaterThan(ZERO) ? bill.displayTotal : paid,
        },
      });

      if (surplus.greaterThan(ZERO)) {
        await tx.customerCredit.create({
          data: {
            id: newId(),
            accountId: booking.customerId,
            sourceInvoiceId: invoice.id,
            amount: surplus,
            status: 'open',
          },
        });
      }

      await this.audit.log(
        {
          houseboatId,
          actorAccountId: actorId,
          action: 'booking_reschedule',
          entityType: 'booking',
          entityId: bookingId,
          before: { departureId: booking.departureId, price: oldPrice.toFixed(2) },
          after: {
            departureId: newDepartureId,
            price: bill.displayTotal.toFixed(2),
            surplusCredit: surplus.toFixed(2),
          },
        },
        tx,
      );

      return { invoice, surplusCredit: surplus.toFixed(2) };
    });
  }

  /**
   * Cancel a booking (plan §4 Path B — customer cancels). Frees the cabins back
   * to the departure, moves the invoice to `cancelled`, and computes the refund
   * from the invoice's policy SNAPSHOT (blackout → 0%, % of amount_paid). The
   * platform keeps its commission. Any refund owed is recorded as a customer
   * credit; the invoice then follows settlement (cancelled → payment_verified …).
   * Finally, all waitlisted customers for that departure are notified.
   *
   * A customer cancels their own booking; a boat member with bookings:edit may
   * cancel on their behalf.
   */
  async cancel(bookingId: string, actorId: string, isPlatform: boolean) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        invoice: true,
        cabins: true,
        departure: {
          include: { package: { include: { houseboat: { select: { name: true } } } } },
        },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (!booking.invoice) throw new BadRequestException('Booking has no invoice');
    if (booking.status === 'cancelled') {
      throw new BadRequestException('Booking is already cancelled');
    }

    const houseboatId = booking.invoice.houseboatId;
    // Authorization: the booking's own customer, or a member with bookings:edit.
    if (booking.customerId !== actorId) {
      await this.rbac.assert(actorId, isPlatform, houseboatId, 'bookings', 'edit');
    }

    // Refund from the snapshot agreed at checkout, not the current policy.
    const snapshot = booking.invoice.policySnapshot as PolicySnapshot | null;
    const days = daysUntil(booking.departure.startDate);
    const pct = refundPercent(snapshot, days);
    const paid = money(booking.invoice.amountPaid);
    const refund = refundAmount(paid, pct);

    // Only legal from pre-payout states (in_payout is a lock).
    assertTransition(booking.invoice.status as InvoiceStatus, 'cancelled');

    const freedCabins = booking.cabins.length;

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'cancelled' },
      });
      await tx.invoice.update({
        where: { id: booking.invoice!.id },
        data: { status: 'cancelled' },
      });
      // Return the cabins to availability.
      const dep = await tx.tripDeparture.update({
        where: { id: booking.departureId },
        data: { availableCount: { increment: freedCabins } },
        select: { availableCount: true },
      });

      // Refund owed → customer credit (platform keeps commission regardless).
      if (refund.greaterThan(ZERO)) {
        await tx.customerCredit.create({
          data: {
            id: newId(),
            accountId: booking.customerId,
            sourceInvoiceId: booking.invoice!.id,
            amount: refund,
            status: 'open',
          },
        });
      }

      await this.audit.log(
        {
          houseboatId,
          actorAccountId: actorId,
          action: 'booking_cancel',
          entityType: 'booking',
          entityId: bookingId,
          after: {
            refundPct: pct,
            refundAmount: refund.toFixed(2),
            freedCabins,
          },
        },
        tx,
      );
      return { availableCount: dep.availableCount };
    });

    // Post-commit side effects: realtime availability + waitlist fan-out.
    this.realtime.emitAvailability(booking.departureId, result.availableCount);
    await this.notifyWaitlist(
      booking.departureId,
      booking.departure.package.houseboat.name,
    ).catch(() => undefined);

    return {
      cancelled: true,
      refundPct: pct,
      refundAmount: refund.toFixed(2),
    };
  }

  /**
   * Someone joins an open seat (plan §3). A booking_cabin left with a spare
   * place (is_open_seat) is filled by another party at their own headcount price.
   * The FIRST booker's invoice drops by the joiner's contribution; commission
   * recalculates on the new total; if they already paid more than the new total,
   * the surplus becomes a customer credit. The invoice only ever moves DOWN.
   *
   * Returns the joiner's own (new) booking + invoice for the spare place.
   */
  async joinOpenSeat(
    openSeatCabinId: string,
    joinerId: string,
    adults: number,
    children = 0,
  ) {
    const seat = await this.prisma.bookingCabin.findUnique({
      where: { id: openSeatCabinId },
      include: {
        cabin: { include: { category: true } },
        booking: {
          include: {
            invoice: true,
            departure: { include: { package: { select: { houseboatId: true } } } },
          },
        },
      },
    });
    if (!seat) throw new NotFoundException('Open seat not found');
    if (!seat.isOpenSeat) throw new BadRequestException('That cabin is not an open seat');
    const firstInvoice = seat.booking.invoice;
    if (!firstInvoice) throw new BadRequestException('Original booking has no invoice');

    const houseboatId = seat.booking.departure.package.houseboatId;
    const occupancy = adults + children;
    const cap =
      seat.cabin.category.extendedCapacity ?? seat.cabin.category.baseCapacity;
    // The joiner's headcount plus the existing occupancy must fit the room.
    if (seat.occupancy + occupancy > cap) {
      throw new BadRequestException('Not enough spare places for that headcount');
    }

    const joinerPrice = await this.pricing.priceFor(
      houseboatId,
      seat.cabin.cabinCategoryId,
      occupancy,
      seat.booking.departure.startDate,
    );

    const billing = await this.prisma.houseboatBillingConfig.findFirst({
      where: { houseboatId },
    });
    const gatewayFeePct = money(billing?.gatewayFeePct ?? 0);
    const commissionPct = billing?.commissionPct
      ? money(billing.commissionPct)
      : null;

    // First booker's new room_total = old − joiner's contribution (never below 0).
    const oldRoomTotal = money(firstInvoice.roomTotal);
    const newRoomTotal = sub(oldRoomTotal, joinerPrice);
    const firstBill = buildBill({
      roomTotal: newRoomTotal.isNegative() ? ZERO : newRoomTotal,
      gatewayFeePct,
      commissionPct,
    });

    const paid = money(firstInvoice.amountPaid);
    const surplus = paid.greaterThan(firstBill.displayTotal)
      ? sub(paid, firstBill.displayTotal)
      : ZERO;

    return this.prisma.$transaction(async (tx) => {
      // 1. Drop the first booker's invoice to the new (lower) total.
      await tx.invoice.update({
        where: { id: firstInvoice.id },
        data: {
          roomTotal: firstBill.roomTotal,
          gatewayFee: firstBill.gatewayFee,
          priceShown: firstBill.priceShown,
          discountAmount: firstBill.discountAmount,
          displayTotal: firstBill.displayTotal,
          commission: firstBill.commission,
          amountPaid: surplus.greaterThan(ZERO) ? firstBill.displayTotal : paid,
        },
      });
      if (surplus.greaterThan(ZERO)) {
        await tx.customerCredit.create({
          data: {
            id: newId(),
            accountId: seat.booking.customerId,
            sourceInvoiceId: firstInvoice.id,
            amount: surplus,
            status: 'open',
          },
        });
      }

      // 2. The seat is now filled — no longer offered to others.
      await tx.bookingCabin.update({
        where: { id: openSeatCabinId },
        data: { isOpenSeat: false, occupancy: seat.occupancy + occupancy },
      });

      // 3. Create the joiner's own booking + cabin + invoice for the spare place.
      const joinerBill = buildBill({
        roomTotal: joinerPrice,
        gatewayFeePct,
        commissionPct,
      });
      const joinerBooking = await tx.booking.create({
        data: {
          id: newId(),
          departureId: seat.booking.departureId,
          customerId: joinerId,
          bookedBy: joinerId,
          type: 'open_seat',
          headcount: occupancy,
          status: 'confirmed',
        },
      });
      await tx.bookingCabin.create({
        data: {
          id: newId(),
          bookingId: joinerBooking.id,
          cabinId: seat.cabinId,
          adults,
          children,
          occupancy,
          roomPrice: joinerPrice,
          isOpenSeat: false,
        },
      });
      const joinerInvoice = await tx.invoice.create({
        data: {
          id: newId(),
          bookingId: joinerBooking.id,
          houseboatId,
          customerId: joinerId,
          roomTotal: joinerBill.roomTotal,
          gatewayFee: joinerBill.gatewayFee,
          priceShown: joinerBill.priceShown,
          discountAmount: joinerBill.discountAmount,
          displayTotal: joinerBill.displayTotal,
          commission: joinerBill.commission,
          dueToBoat: ZERO,
          amountPaid: ZERO,
          status: 'customer_due',
          policySnapshot: await this.policySnapshot(tx, houseboatId),
        },
      });

      await this.audit.log(
        {
          houseboatId,
          actorAccountId: joinerId,
          action: 'open_seat_join',
          entityType: 'booking',
          entityId: joinerBooking.id,
          after: {
            filledSeatCabin: openSeatCabinId,
            firstInvoiceNewTotal: firstBill.displayTotal.toFixed(2),
            surplusCredit: surplus.toFixed(2),
          },
        },
        tx,
      );

      return { booking: joinerBooking, invoice: joinerInvoice };
    });
  }

  async get(bookingId: string) {
    return this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        cabins: { include: { cabin: true } },
        guests: true,
        invoice: true,
        departure: { include: { package: { include: { route: true } } } },
      },
    });
  }

  listForCustomer(customerId: string) {
    return this.prisma.booking.findMany({
      where: { customerId },
      include: { invoice: true, departure: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
