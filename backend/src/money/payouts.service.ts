import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { newId } from '../common/uuid';
import { Money, money, ZERO, add, sub } from '../common/money';
import { dueToBoat } from '../common/billing';

/**
 * Weekly settlement + payout — plan §5. Finance batches all payment_verified
 * invoices for a boat, computes a SIGNED total (can be negative if the boat
 * owes the platform), and locks each invoice to in_payout so no refund can
 * double-spend. Separation of duties: prepared_by != approved_by (DB CHECK too).
 *
 * Cash never entered the platform account → it never enters due_to_boat.
 */
@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Invoices ready to settle for a boat. */
  async duePayments(houseboatId: string) {
    return this.prisma.invoice.findMany({
      where: { houseboatId, status: 'payment_verified', payoutBatchId: null },
      include: { payments: true },
    });
  }

  /**
   * Prepare a batch: pull all payment_verified invoices, compute due_to_boat per
   * invoice (gateway receipts − commission; cash excluded), lock them in_payout.
   */
  async prepareBatch(houseboatId: string, preparedBy: string) {
    // A payout cannot run without the boat's bank account on file (schema:
    // bank_account is MANDATORY before any payout).
    const boat = await this.prisma.houseboat.findUnique({
      where: { id: houseboatId },
      select: { bankAccount: true },
    });
    if (!boat?.bankAccount) {
      throw new BadRequestException(
        'This houseboat has no bank account on file — add one before running a payout',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const invoices = await tx.invoice.findMany({
        where: { houseboatId, status: 'payment_verified', payoutBatchId: null },
        include: { payments: true },
      });
      if (invoices.length === 0) {
        throw new BadRequestException('No verified invoices to settle');
      }

      const batch = await tx.houseboatPayoutBatch.create({
        data: {
          id: newId(),
          houseboatId,
          totalAmount: ZERO,
          preparedBy,
          status: 'prepared',
        },
      });

      let batchTotal: Money = ZERO;
      for (const inv of invoices) {
        // Only gateway money reached the platform account.
        const gatewayReceipts = inv.payments
          .filter((p) => p.method === 'gateway')
          .reduce((s, p) => add(s, money(p.amount)), ZERO);
        const due = dueToBoat(gatewayReceipts, money(inv.commission)); // SIGNED
        batchTotal = add(batchTotal, due);

        await tx.invoice.update({
          where: { id: inv.id },
          data: {
            dueToBoat: due,
            status: 'in_payout', // LOCK
            payoutBatchId: batch.id,
          },
        });
      }

      const updated = await tx.houseboatPayoutBatch.update({
        where: { id: batch.id },
        data: { totalAmount: batchTotal },
      });

      await this.audit.log(
        {
          houseboatId,
          actorAccountId: preparedBy,
          action: 'payout_prepare',
          entityType: 'houseboat_payout_batch',
          entityId: batch.id,
          after: { total: batchTotal.toFixed(2), invoices: invoices.length },
        },
        tx,
      );
      return updated;
    });
  }

  /** Approve a prepared batch. Must be a DIFFERENT person than the preparer. */
  async approveBatch(batchId: string, approvedBy: string) {
    const batch = await this.prisma.houseboatPayoutBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch) throw new NotFoundException('Batch not found');
    if (batch.status !== 'prepared') {
      throw new BadRequestException('Batch is not in prepared state');
    }
    if (batch.preparedBy === approvedBy) {
      throw new ForbiddenException(
        'Separation of duties: approver must differ from preparer',
      );
    }
    const updated = await this.prisma.houseboatPayoutBatch.update({
      where: { id: batchId },
      data: { status: 'approved', approvedBy },
    });
    await this.audit.log({
      houseboatId: batch.houseboatId,
      actorAccountId: approvedBy,
      action: 'payout_approve',
      entityType: 'houseboat_payout_batch',
      entityId: batchId,
    });
    return updated;
  }

  /** Mark the transfer done: batch paid, invoices bill_cleared. */
  async markPaid(batchId: string, actorId: string) {
    const batch = await this.prisma.houseboatPayoutBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch) throw new NotFoundException('Batch not found');
    if (batch.status !== 'approved') {
      throw new BadRequestException('Batch must be approved before paying');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.houseboatPayoutBatch.update({
        where: { id: batchId },
        data: { status: 'paid', paidAt: new Date() },
      });
      await tx.invoice.updateMany({
        where: { payoutBatchId: batchId, status: 'in_payout' },
        data: { status: 'bill_cleared' },
      });

      // Plan §5.4: a NEGATIVE batch (low deposits + cash owed + commission)
      // offsets against the boat's signed platform_balance. Positive batches are
      // the boat's own money being paid out and don't touch the balance.
      const total = money(batch.totalAmount);
      if (total.isNegative()) {
        const config = await tx.houseboatBillingConfig.findFirst({
          where: { houseboatId: batch.houseboatId },
        });
        if (config) {
          await tx.houseboatBillingConfig.update({
            where: { id: config.id },
            data: {
              platformBalance: add(money(config.platformBalance), total),
            },
          });
        }
      }

      await this.audit.log(
        {
          houseboatId: batch.houseboatId,
          actorAccountId: actorId,
          action: 'payout_paid',
          entityType: 'houseboat_payout_batch',
          entityId: batchId,
          after: { batchTotal: total.toFixed(2) },
        },
        tx,
      );
      return { ok: true };
    });
  }

  listBatches(houseboatId: string) {
    return this.prisma.houseboatPayoutBatch.findMany({
      where: { houseboatId },
      orderBy: { id: 'desc' },
    });
  }
}
