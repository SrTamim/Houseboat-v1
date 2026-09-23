import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RbacService } from '../rbac/rbac.service';
import { newId } from '../common/uuid';
import { money, add, sub, ZERO } from '../common/money';
import { cursorArgs, toPage } from '../common/paginate';
import {
  assertTransition,
  InvoiceStatus,
} from './invoice-state';

/**
 * Invoice states in which the amount owed to the boat is locked and no further
 * payment may be recorded. Once an invoice is approved for payout (or paid /
 * cleared), a late or duplicate gateway notification must not append money that
 * would inflate the settlement. See the freeze guard in recordGatewayPayment /
 * recordPayment.
 */
const FROZEN_FOR_PAYMENT: ReadonlySet<InvoiceStatus> = new Set<InvoiceStatus>([
  'payout_approved',
  'in_payout',
  'bill_cleared',
]);

/**
 * Payments + verification. Plan §4 Path A:
 *   paid → payment_verified is a DELIBERATE human step (finance for gateway,
 *   boat manager for cash) — it catches gateway bugs and fraud.
 *
 * gateway_token is unique-indexed so a replayed webhook is a no-op.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rbac: RbacService,
  ) {}

  /**
   * The boat's invoices, for the owner's Invoices and Payments pages.
   *
   * `cashPending` narrows to invoices carrying a cash payment nobody has
   * verified — the queue an owner works through. Verification of cash is the
   * boat manager's job (gateway money is finance's), so this is the one money
   * list an owner acts on rather than just reads.
   */
  async listForBoat(
    houseboatId: string,
    query: {
      status?: string;
      q?: string;
      cursor?: string;
      limit?: number;
    },
  ) {
    const rows = await this.prisma.invoice.findMany({
      ...cursorArgs(query),
      where: {
        houseboatId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.q
          ? {
              customer: {
                OR: [
                  { name: { contains: query.q, mode: 'insensitive' } },
                  { phone: { contains: query.q } },
                ],
              },
            }
          : {}),
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        booking: {
          select: {
            id: true,
            type: true,
            status: true,
            departure: {
              select: {
                startDate: true,
                package: { select: { durationLabel: true } },
              },
            },
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            method: true,
            paidAt: true,
            receivedBy: true,
            verifiedBy: true,
            receivedByAccount: { select: { name: true } },
            verifiedByAccount: { select: { name: true } },
          },
        },
      },
    });

    return toPage(rows, query);
  }

  /** Record a payment against an invoice (cash or gateway). Moves to 'paid'. */
  async recordPayment(
    invoiceId: string,
    actorId: string,
    isPlatform: boolean,
    input: {
      // gateway = platform card processing (legacy/customer); the rest are the
      // owner's own collection channels recorded at the counter (§6).
      amount: number;
      method: 'gateway' | 'cash' | 'bkash' | 'bank' | 'online';
      gatewayToken?: string;
      receivedBy?: string;
    },
  ) {
    return this.prisma
      .$transaction(async (tx) => {
        // Lock the invoice row for the life of the tx. amountPaid is read here,
        // the overpay check runs against it, and the new total is written back —
        // a check-then-write. Without the lock two concurrent payments both read
        // the same amountPaid, both pass the overpay guard, and the second
        // update overwrites (not accumulates) → amountPaid ends wrong and the
        // guard is defeated. Same FOR UPDATE idiom applyCredits uses for the
        // wallet; Prisma has no native FOR UPDATE so take it with raw SQL.
        await tx.$queryRaw`
          SELECT id FROM invoice WHERE id = ${invoiceId}::uuid FOR UPDATE`;
        const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice) throw new NotFoundException('Invoice not found');

        // IDOR guard: caller must have bookings:edit on THIS invoice's boat.
        await this.rbac.assert(
          actorId,
          isPlatform,
          invoice.houseboatId,
          'bookings',
          'edit',
        );

        // Freeze: no new payment once the invoice is approved for payout or
        // beyond (see FROZEN_FOR_PAYMENT). This is the manual owner/cash path, so
        // unlike the IPN we DO throw — the person recording the payment should see
        // that the invoice is locked rather than have it silently dropped.
        if (FROZEN_FOR_PAYMENT.has(invoice.status as InvoiceStatus)) {
          throw new ConflictException(
            'This invoice is locked for payout and can no longer take payments',
          );
        }

        const newPaid = add(money(invoice.amountPaid), money(input.amount));

        // Reject overpayment: amountPaid must never exceed what the invoice bills.
        // Fat-finger protection — an owner typing 50000 for a 5000 sale would
        // otherwise inflate collected revenue and payout.
        if (newPaid.greaterThan(money(invoice.displayTotal))) {
          throw new BadRequestException(
            'Payment exceeds the amount due on this invoice',
          );
        }

        await tx.invoicePayment.create({
          data: {
            id: newId(),
            invoiceId,
            amount: input.amount,
            method: input.method,
            gatewayToken: input.gatewayToken,
            receivedBy: input.receivedBy ?? actorId,
            paidAt: new Date(),
          },
        });

        // Only advance customer_due → paid once the invoice is FULLY settled. A
        // partial deposit stays customer_due (still due) so it can't be swept into
        // a payout for the full dueToBoat while money is still owed. This mirrors
        // booking.service.checkout's own paid-vs-due decision.
        const fullySettled = newPaid.greaterThanOrEqualTo(money(invoice.displayTotal));
        const nextStatus: InvoiceStatus =
          invoice.status === 'customer_due' && fullySettled
            ? 'paid'
            : (invoice.status as InvoiceStatus);
        if (invoice.status === 'customer_due' && fullySettled) {
          assertTransition('customer_due', 'paid');
        }

        const updated = await tx.invoice.update({
          where: { id: invoiceId },
          data: { amountPaid: newPaid, status: nextStatus },
        });

        await this.audit.log(
          {
            houseboatId: invoice.houseboatId,
            actorAccountId: actorId,
            action: 'mark_paid',
            entityType: 'invoice',
            entityId: invoiceId,
            after: { amountPaid: newPaid.toFixed(2), method: input.method },
          },
          tx,
        );
        return updated;
      })
      .catch((e) => {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          // Duplicate gateway_token — webhook replay. No-op.
          throw new ConflictException('Payment already recorded (replay ignored)');
        }
        throw e;
      });
  }

  /**
   * Record a payment confirmed by the payment gateway's server-to-server IPN.
   * There is no logged-in user here — authenticity is established by the gateway
   * validation (val_id verified against SSLCommerz), so this path skips the
   * per-user RBAC check that recordPayment enforces. gatewayToken (the gateway's
   * validation id) is unique-indexed → a replayed IPN is a harmless no-op.
   */
  async recordGatewayPayment(input: {
    invoiceId: string;
    amount: number;
    gatewayToken: string;
  }) {
    return this.prisma
      .$transaction(async (tx) => {
        // Lock the invoice row — the gateway path recomputes amountPaid and
        // amountOverpaid ABSOLUTELY from the current amountPaid, so a concurrent
        // IPN reading a stale value would compute both wrong. Serialize the two
        // (the unique gatewayToken already makes an exact replay a no-op; this
        // guards two DISTINCT partial payments landing at once). See recordPayment.
        await tx.$queryRaw`
          SELECT id FROM invoice WHERE id = ${input.invoiceId}::uuid FOR UPDATE`;
        const invoice = await tx.invoice.findUnique({
          where: { id: input.invoiceId },
        });
        if (!invoice) throw new NotFoundException('Invoice not found');

        // Freeze: once an invoice is approved for payout (or beyond), the amount
        // owed to the boat is locked. A late or duplicate IPN arriving now would
        // append a payment and silently inflate the payout. Refuse to record it —
        // but DO NOT throw: this runs inside the @Public SSLCommerz IPN, and a
        // non-2xx makes the gateway retry forever with the payment recorded
        // nowhere (money captured, invoice never updated). Instead log it and
        // return null, exactly like the replay path, so the IPN acks 2xx and the
        // caller skips the e-ticket. The audit row means a genuinely-late real
        // payment is visible for manual reconciliation, never silently lost.
        if (FROZEN_FOR_PAYMENT.has(invoice.status as InvoiceStatus)) {
          await this.audit.log(
            {
              houseboatId: invoice.houseboatId,
              action: 'gateway_payment_frozen',
              entityType: 'invoice',
              entityId: input.invoiceId,
              after: {
                status: invoice.status,
                rejectedAmount: money(input.amount).toFixed(2),
                gatewayToken: input.gatewayToken,
              },
            },
            tx,
          );
          return null;
        }

        await tx.invoicePayment.create({
          data: {
            id: newId(),
            invoiceId: input.invoiceId,
            amount: input.amount,
            method: 'gateway',
            gatewayToken: input.gatewayToken,
            paidAt: new Date(),
          },
        });

        const newPaid = add(money(invoice.amountPaid), money(input.amount));
        // Only advance customer_due → paid once fully settled — the gateway
        // supports deposits (partial payments), so a partial IPN must leave the
        // invoice customer_due (not payout-eligible) rather than flip it to paid
        // for the full dueToBoat. Mirrors recordPayment. No overpay reject here:
        // the gateway is authoritative and dropping a real IPN would lose money.
        const fullySettled = newPaid.greaterThanOrEqualTo(money(invoice.displayTotal));
        const nextStatus: InvoiceStatus =
          invoice.status === 'customer_due' && fullySettled
            ? 'paid'
            : (invoice.status as InvoiceStatus);
        if (invoice.status === 'customer_due' && fullySettled) {
          assertTransition('customer_due', 'paid');
        }

        // The gateway path accepts overpayments (it can't reject a real IPN), so
        // track the surplus over displayTotal. It's a platform liability to the
        // customer (surfaced in the overpayments queue and refunded), and the
        // payout math (dueForInvoice) caps receipts at displayTotal so the boat
        // is never paid on it. Recomputed absolutely from newPaid each time.
        const overpaid = sub(newPaid, money(invoice.displayTotal));
        const amountOverpaid = overpaid.greaterThan(ZERO) ? overpaid : ZERO;

        const updated = await tx.invoice.update({
          where: { id: input.invoiceId },
          data: { amountPaid: newPaid, amountOverpaid, status: nextStatus },
        });

        await this.audit.log(
          {
            houseboatId: invoice.houseboatId,
            action: 'gateway_payment',
            entityType: 'invoice',
            entityId: input.invoiceId,
            after: {
              amountPaid: newPaid.toFixed(2),
              gatewayToken: input.gatewayToken,
            },
          },
          tx,
        );
        return updated;
      })
      .catch((e) => {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          // Duplicate gateway_token — IPN replay. Idempotent no-op.
          return null;
        }
        throw e;
      });
  }

  /** Finance/manager manually verifies a payment. paid → payment_verified. */
  async verifyPayment(invoiceId: string, verifierId: string, isPlatform: boolean) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    // IDOR guard: caller must have bookings:edit on THIS invoice's boat.
    await this.rbac.assert(
      verifierId,
      isPlatform,
      invoice.houseboatId,
      'bookings',
      'edit',
    );
    // A verify must not certify an invoice that isn't fully paid — otherwise a
    // partial receipt could be marked payment_verified with a balance still owed.
    // (Owner cash never reaches here: it settles paid → in_payout with no verify.)
    if (money(invoice.amountPaid).lessThan(money(invoice.displayTotal))) {
      throw new BadRequestException(
        'Cannot verify a payment while the invoice is not fully paid',
      );
    }
    assertTransition(invoice.status as InvoiceStatus, 'payment_verified');

    // Stamp the last payment AND flip the invoice status atomically — otherwise a
    // crash between them leaves the invoice verified with no verifier stamped, or
    // the stamp with the status not advanced.
    const updated = await this.prisma.$transaction(async (tx) => {
      const lastPayment = await tx.invoicePayment.findFirst({
        where: { invoiceId },
        orderBy: { paidAt: 'desc' },
      });
      if (lastPayment) {
        await tx.invoicePayment.update({
          where: { id: lastPayment.id },
          data: { verifiedBy: verifierId },
        });
      }
      const inv = await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: 'payment_verified' },
      });
      await this.audit.log(
        {
          houseboatId: invoice.houseboatId,
          actorAccountId: verifierId,
          action: 'payment_verify',
          entityType: 'invoice',
          entityId: invoiceId,
        },
        tx,
      );
      return inv;
    });
    return updated;
  }

  async listPayments(invoiceId: string, actorId: string, isPlatform: boolean) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { houseboatId: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    // IDOR guard: caller must have bookings:view on THIS invoice's boat.
    await this.rbac.assert(
      actorId,
      isPlatform,
      invoice.houseboatId,
      'bookings',
      'view',
    );
    return this.prisma.invoicePayment.findMany({ where: { invoiceId } });
  }
}
