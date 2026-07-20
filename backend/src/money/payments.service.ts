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
import { money, add, gte } from '../common/money';
import {
  assertTransition,
  InvoiceStatus,
} from './invoice-state';

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

  /** Record a payment against an invoice (cash or gateway). Moves to 'paid'. */
  async recordPayment(
    invoiceId: string,
    actorId: string,
    isPlatform: boolean,
    input: {
      amount: number;
      method: 'gateway' | 'cash';
      gatewayToken?: string;
      receivedBy?: string;
    },
  ) {
    return this.prisma
      .$transaction(async (tx) => {
        const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice) throw new NotFoundException('Invoice not found');

        // IDOR guard: caller must have money:edit on THIS invoice's boat.
        await this.rbac.assert(
          actorId,
          isPlatform,
          invoice.houseboatId,
          'money',
          'edit',
        );

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

        const newPaid = add(money(invoice.amountPaid), money(input.amount));
        // Only advance to 'paid' from customer_due; partial payments stay 'paid'.
        const nextStatus: InvoiceStatus =
          invoice.status === 'customer_due' ? 'paid' : (invoice.status as InvoiceStatus);
        if (invoice.status === 'customer_due') {
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
        const invoice = await tx.invoice.findUnique({
          where: { id: input.invoiceId },
        });
        if (!invoice) throw new NotFoundException('Invoice not found');

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
        const nextStatus: InvoiceStatus =
          invoice.status === 'customer_due'
            ? 'paid'
            : (invoice.status as InvoiceStatus);
        if (invoice.status === 'customer_due') {
          assertTransition('customer_due', 'paid');
        }

        const updated = await tx.invoice.update({
          where: { id: input.invoiceId },
          data: { amountPaid: newPaid, status: nextStatus },
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
    // IDOR guard: caller must have money:edit on THIS invoice's boat.
    await this.rbac.assert(
      verifierId,
      isPlatform,
      invoice.houseboatId,
      'money',
      'edit',
    );
    assertTransition(invoice.status as InvoiceStatus, 'payment_verified');

    // Stamp the verifier on the most recent payment.
    const lastPayment = await this.prisma.invoicePayment.findFirst({
      where: { invoiceId },
      orderBy: { paidAt: 'desc' },
    });
    if (lastPayment) {
      await this.prisma.invoicePayment.update({
        where: { id: lastPayment.id },
        data: { verifiedBy: verifierId },
      });
    }

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'payment_verified' },
    });
    await this.audit.log({
      houseboatId: invoice.houseboatId,
      actorAccountId: verifierId,
      action: 'payment_verify',
      entityType: 'invoice',
      entityId: invoiceId,
    });
    return updated;
  }

  async listPayments(invoiceId: string, actorId: string, isPlatform: boolean) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { houseboatId: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    // IDOR guard: caller must have money:view on THIS invoice's boat.
    await this.rbac.assert(
      actorId,
      isPlatform,
      invoice.houseboatId,
      'money',
      'view',
    );
    return this.prisma.invoicePayment.findMany({ where: { invoiceId } });
  }
}
