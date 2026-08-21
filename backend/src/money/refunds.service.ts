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
import { newId } from '../common/uuid';
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
                bookedBy: true,
                customerId: true,
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
      // POS = owner counter-sale, where bookedBy (the owner) differs from the
      // customer. Those refunds settle here; platform-booked ones by finance.
      isPos: r.invoice.booking.bookedBy !== r.invoice.booking.customerId,
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
    // Full 3-person separation: requester, verifier and completer must all be
    // distinct. The DB CHECK covers verifier != completer; enforce the other two
    // pairings here so a 2-person pair can't push a refund through end-to-end.
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

    // POS-only: a platform booking (bookedBy === customer) must not settle in
    // one step — separation of duties applies to it.
    const isPos =
      refund.invoice.booking.bookedBy !== refund.invoice.booking.customerId;
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
