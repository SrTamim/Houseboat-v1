import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RbacService } from '../rbac/rbac.service';
import { NotificationsService } from '../notifications/notifications.service';
import { newId } from '../common/uuid';
import { money, ZERO } from '../common/money';
import { encryptJson } from '../common/crypto';
import { assertTransition, InvoiceStatus } from './invoice-state';

export const REFUND_CLAIM_DAYS = 6;

/**
 * Refunds — plan §4 Path C. Only reachable when the OWNER cancelled the trip,
 * and only within 6 days of that cancellation. Separation of duties:
 * requested_by, verified_by, completed_by must not all be the same person; the
 * DB also enforces verified_by != completed_by.
 *
 * Customer-cancel refunds do NOT come here — they follow the boat's policy
 * template inside the cancellation flow.
 */
@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rbac: RbacService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Customer requests a refund after an owner cancellation. */
  /**
   * Refunds against this boat's invoices, newest first, for the owner console.
   *
   * bankDetails is deliberately omitted: it is encrypted at rest and only the
   * finance step that actually sends the money needs it.
   */
  async listForBoat(houseboatId: string) {
    const rows = await this.prisma.invoiceRefund.findMany({
      where: { invoice: { houseboatId } },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        amount: true,
        reason: true,
        status: true,
        origin: true,
        claimDeadline: true,
        completedAt: true,
        requestedByAccount: { select: { name: true } },
        verifiedByAccount: { select: { name: true } },
        completedByAccount: { select: { name: true } },
        invoice: {
          select: {
            id: true,
            displayTotal: true,
            amountPaid: true,
            customer: { select: { name: true, phone: true } },
            booking: {
              select: {
                id: true,
                status: true,
                channel: true,
                departure: { select: { startDate: true } },
              },
            },
          },
        },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      amount: r.amount.toFixed(2),
      reason: r.reason,
      status: r.status,
      origin: r.origin,
      claimDeadline: r.claimDeadline,
      completedAt: r.completedAt,
      requestedBy: r.requestedByAccount?.name ?? null,
      verifiedBy: r.verifiedByAccount?.name ?? null,
      completedBy: r.completedByAccount?.name ?? null,
      invoiceId: r.invoice.id,
      customer: r.invoice.customer,
      paid: r.invoice.amountPaid.toFixed(2),
      bookingStatus: r.invoice.booking.status,
      departureDate: r.invoice.booking.departure.startDate,
      // POS = owner counter-sale (booking.channel). Those refunds settle here;
      // platform-booked ones by finance.
      isPos: r.invoice.booking.channel === 'pos',
    }));
  }

  async request(
    invoiceId: string,
    requesterId: string,
    isPlatform: boolean,
    input: { amount: number; reason?: string; bankDetails?: unknown },
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    // IDOR guard: caller must have refunds:edit on THIS invoice's boat.
    await this.rbac.assert(
      requesterId,
      isPlatform,
      invoice.houseboatId,
      'refunds',
      'edit',
    );

    // Guard: if already in_payout, it must be pulled from the batch first.
    if (invoice.status === 'in_payout') {
      throw new BadRequestException(
        'Invoice is locked in a payout batch — pull it before refunding',
      );
    }
    assertTransition(invoice.status as InvoiceStatus, 'refund_requested');

    const claimDeadline = new Date(
      Date.now() + REFUND_CLAIM_DAYS * 24 * 60 * 60 * 1000,
    );

    // Encrypt bank details at rest — the DB only ever sees ciphertext.
    const encryptedBankDetails =
      input.bankDetails == null
        ? null
        : encryptJson(
            input.bankDetails,
            this.config.get<string>('encryptionKey') ?? '',
          );

    return this.prisma.$transaction(async (tx) => {
      const refund = await tx.invoiceRefund.create({
        data: {
          id: newId(),
          invoiceId,
          amount: input.amount,
          reason: input.reason,
          bankDetails: encryptedBankDetails as never,
          requestedBy: requesterId,
          status: 'requested',
          claimDeadline,
        },
      });
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: 'refund_requested' },
      });
      await this.audit.log(
        {
          houseboatId: invoice.houseboatId,
          actorAccountId: requesterId,
          action: 'refund_request',
          entityType: 'invoice_refund',
          entityId: refund.id,
        },
        tx,
      );
      return refund;
    });
  }

  /**
   * A CUSTOMER requests a refund after the OWNER cancelled their trip
   * (web bookings only). Full refund of what they paid, sent later to their
   * bkash/bank by an admin. Unlike request() this is NOT RBAC-gated — the caller
   * is the booking's own customer (ownership-checked) — and it is reachable from
   * the customer's `customer_due` (deposit only) or `paid` invoice, not
   * `payment_verified`.
   *
   * The 6-day window here is the CUSTOMER's window to REQUEST, measured from the
   * departure cancellation. It is enforced at this point only; the resulting
   * refund carries `claimDeadline = null` so the admin verify/complete steps are
   * never time-boxed. origin='customer' relaxes separation of duties downstream.
   */
  async requestRefundAsCustomer(
    bookingId: string,
    actorId: string,
    input: { bankDetails: unknown },
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        invoice: true,
        departure: true,
        customer: { select: { id: true, phone: true, email: true } },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (!booking.invoice) throw new BadRequestException('Booking has no invoice');
    // Ownership (IDOR-safe): only the booking's own customer may request.
    if (booking.customerId !== actorId) {
      throw new ForbiddenException('Not your booking');
    }
    // Web-only: POS counter-sale refunds are settled by the owner (settlePos).
    if (booking.channel !== 'web') {
      throw new BadRequestException(
        'POS bookings are refunded by the boat operator, not here',
      );
    }
    // Only when the OWNER cancelled the whole departure.
    if (booking.departure.status !== 'cancelled') {
      throw new BadRequestException(
        'A refund can only be requested for a trip cancelled by the host',
      );
    }
    // 6-day REQUEST window from the cancellation. cancelledAt is stamped by
    // trips.service.cancelDeparture; guard against legacy rows with no timestamp.
    const cancelledAt = booking.departure.cancelledAt;
    if (!cancelledAt) {
      throw new BadRequestException('Refund window is not available for this trip');
    }
    const deadline =
      cancelledAt.getTime() + REFUND_CLAIM_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() > deadline) {
      throw new BadRequestException(
        'The 6-day refund request window has passed',
      );
    }
    // One active refund per invoice (also enforced by a DB unique index).
    const existing = await this.prisma.invoiceRefund.findFirst({
      where: { invoiceId: booking.invoice.id },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('A refund has already been requested');
    }
    // Nothing paid yet (a customer_due invoice with a 0 deposit) → nothing to
    // refund. Guard before the transition so we never create a ৳0 refund row.
    const amount = booking.invoice.amountPaid; // full refund of what they paid
    if (money(amount).lessThanOrEqualTo(ZERO)) {
      throw new BadRequestException('No payment to refund yet');
    }
    // The invoice must be in a refundable state (customer path: customer_due or paid).
    assertTransition(booking.invoice.status as InvoiceStatus, 'refund_requested');

    const encryptedBankDetails = encryptJson(
      input.bankDetails,
      this.config.get<string>('encryptionKey') ?? '',
    );
    const houseboatId = booking.invoice.houseboatId;

    const result = await this.prisma.$transaction(async (tx) => {
      const refund = await tx.invoiceRefund.create({
        data: {
          id: newId(),
          invoiceId: booking.invoice!.id,
          amount,
          origin: 'customer',
          bankDetails: encryptedBankDetails as never,
          requestedBy: actorId,
          status: 'requested',
          claimDeadline: null, // admin steps are not time-boxed
        },
      });
      await tx.invoice.update({
        where: { id: booking.invoice!.id },
        data: { status: 'refund_requested' },
      });
      await this.audit.log(
        {
          houseboatId,
          actorAccountId: actorId,
          action: 'refund_request',
          entityType: 'invoice_refund',
          entityId: refund.id,
        },
        tx,
      );
      return { id: refund.id, status: refund.status };
    });

    // Best-effort acknowledgement SMS/email — sent AFTER commit so a delivery
    // failure can never roll back the refund. notify() never throws.
    await this.notifications.notify({
      accountId: booking.customer.id,
      event: 'refund_requested',
      to: {
        phone: booking.customer.phone ?? undefined,
        email: booking.customer.email ?? undefined,
      },
      subject: 'Your refund request was received',
      message:
        `Your Refund Request to bookkoro.xyz is received.\n` +
        `Booking ID: ${bookingId.slice(0, 8)}\n` +
        `Paid: ${money(amount).toFixed(0)} BDT\n` +
        `You will Receive your refund by 14 working days.`,
    });

    return result;
  }

  async verify(refundId: string, verifierId: string, isPlatform: boolean) {
    const refund = await this.prisma.invoiceRefund.findUnique({
      where: { id: refundId },
      include: { invoice: true },
    });
    if (!refund) throw new NotFoundException('Refund not found');
    // IDOR guard: caller must have money:edit on THIS refund's boat.
    await this.rbac.assert(
      verifierId,
      isPlatform,
      refund.invoice.houseboatId,
      'refunds',
      'edit',
    );
    if (refund.requestedBy === verifierId) {
      throw new ForbiddenException(
        'Separation of duties: requester cannot verify their own refund',
      );
    }
    this.assertWithinWindow(refund.claimDeadline);
    assertTransition(refund.invoice.status as InvoiceStatus, 'refund_verified');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoiceRefund.update({
        where: { id: refundId },
        data: { status: 'verified', verifiedBy: verifierId },
      });
      await tx.invoice.update({
        where: { id: refund.invoiceId },
        data: { status: 'refund_verified' },
      });
      await this.audit.log(
        {
          houseboatId: refund.invoice.houseboatId,
          actorAccountId: verifierId,
          action: 'refund_verify',
          entityType: 'invoice_refund',
          entityId: refundId,
        },
        tx,
      );
      return updated;
    });
  }

  async complete(refundId: string, completerId: string, isPlatform: boolean) {
    const refund = await this.prisma.invoiceRefund.findUnique({
      where: { id: refundId },
      include: { invoice: true },
    });
    if (!refund) throw new NotFoundException('Refund not found');
    // IDOR guard: caller must have money:edit on THIS refund's boat.
    await this.rbac.assert(
      completerId,
      isPlatform,
      refund.invoice.houseboatId,
      'refunds',
      'edit',
    );
    // Separation of duties applies to OWNER-origin refunds (raised by staff):
    // requester, verifier and completer must all be distinct. Customer-origin
    // web refunds are requested by the customer (not staff), so one admin may
    // verify then complete — the DB CHECK is relaxed to match (see migration).
    if (refund.origin === 'owner') {
      if (refund.verifiedBy === completerId) {
        throw new ForbiddenException(
          'Separation of duties: verifier cannot complete the same refund',
        );
      }
      if (refund.requestedBy === completerId) {
        throw new ForbiddenException(
          'Separation of duties: requester cannot complete the same refund',
        );
      }
    }
    this.assertWithinWindow(refund.claimDeadline);
    assertTransition(refund.invoice.status as InvoiceStatus, 'refund_completed');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoiceRefund.update({
        where: { id: refundId },
        data: {
          status: 'completed',
          completedBy: completerId,
          completedAt: new Date(),
        },
      });
      await tx.invoice.update({
        where: { id: refund.invoiceId },
        data: { status: 'refund_completed' },
      });
      await this.audit.log(
        {
          houseboatId: refund.invoice.houseboatId,
          actorAccountId: completerId,
          action: 'refund_complete',
          entityType: 'invoice_refund',
          entityId: refundId,
        },
        tx,
      );
      return updated;
    });
  }

  /**
   * POS one-step settle. A counter-sale refund (bookedBy != customer) has no
   * separate finance to verify it, so the owner both raises and settles it:
   * refund_requested → refund_completed in a single action. verified_by is left
   * null, so the DB CHECK (verified_by != completed_by) is not tripped.
   *
   * Platform-booked refunds are refused here — they must go through the
   * 3-person request → verify → complete flow.
   */
  async settlePos(refundId: string, actorId: string, isPlatform: boolean) {
    const refund = await this.prisma.invoiceRefund.findUnique({
      where: { id: refundId },
      include: { invoice: { include: { booking: true } } },
    });
    if (!refund) throw new NotFoundException('Refund not found');
    // IDOR guard: caller must have money:edit on THIS refund's boat.
    await this.rbac.assert(
      actorId,
      isPlatform,
      refund.invoice.houseboatId,
      'refunds',
      'edit',
    );

    // POS-only: a platform (web) booking must not settle in one step —
    // separation of duties applies to it. Source is booking.channel.
    const isPos = refund.invoice.booking.channel === 'pos';
    if (!isPos) {
      throw new ForbiddenException(
        'Platform refunds must go through verify then complete, not one-step settle',
      );
    }

    this.assertWithinWindow(refund.claimDeadline);
    assertTransition(refund.invoice.status as InvoiceStatus, 'refund_completed');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoiceRefund.update({
        where: { id: refundId },
        data: {
          status: 'completed',
          completedBy: actorId,
          completedAt: new Date(),
        },
      });
      await tx.invoice.update({
        where: { id: refund.invoiceId },
        data: { status: 'refund_completed' },
      });
      await this.audit.log(
        {
          houseboatId: refund.invoice.houseboatId,
          actorAccountId: actorId,
          action: 'refund_settle_pos',
          entityType: 'invoice_refund',
          entityId: refundId,
        },
        tx,
      );
      return updated;
    });
  }

  private assertWithinWindow(deadline: Date | null): void {
    if (deadline && deadline.getTime() < Date.now()) {
      throw new BadRequestException(
        'Refund claim window (6 days) has passed',
      );
    }
  }
}
