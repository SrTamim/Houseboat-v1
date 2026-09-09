import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Weekly settlement + payout — plan §5. Finance batches all settleable
 * invoices for a boat (owner-recorded 'paid' plus platform-verified
 * 'payment_verified' — owner cash no longer needs a separate verify step),
 * computes a SIGNED total (can be negative if the boat owes the platform), and
 * locks each invoice to in_payout so no refund can double-spend. Separation of
 * duties: prepared_by != approved_by (DB CHECK too).
 *
 * Cash never entered the platform account → it never enters due_to_boat.
 */
@Injectable()
export class PayoutsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Invoices ready to settle for a boat. */
  async duePayments(houseboatId: string) {
    return this.prisma.invoice.findMany({
      where: {
        houseboatId,
        status: { in: ['paid', 'payment_verified'] },
        payoutBatchId: null,
      },
      include: { payments: true },
    });
  }

  /**
   * Payout history for the boat's own console (owner-readable).
   *
   * Preparing, approving and paying stay platform-only — this is the read side,
   * so an owner can see what they were paid and when without being able to move
   * money. Includes the invoice ids in each batch so the owner can reconcile.
   */
  async listForBoat(houseboatId: string) {
    const batches = await this.prisma.houseboatPayoutBatch.findMany({
      where: { houseboatId },
      orderBy: { id: 'desc' },
      include: {
        preparedByAccount: { select: { name: true } },
        approvedByAccount: { select: { name: true } },
        invoices: {
          select: { id: true, dueToBoat: true, bookingId: true },
        },
      },
    });

    return batches.map((b) => ({
      id: b.id,
      totalAmount: b.totalAmount.toFixed(2),
      status: b.status,
      paidAt: b.paidAt,
      preparedBy: b.preparedByAccount?.name ?? null,
      approvedBy: b.approvedByAccount?.name ?? null,
      invoiceCount: b.invoices.length,
      invoices: b.invoices.map((i) => ({
        id: i.id,
        bookingId: i.bookingId,
        dueToBoat: i.dueToBoat.toFixed(2),
      })),
    }));
  }

  /**
   * Invoices approved for payout but not yet paid (owner-readable).
   *
   * Read side only — admin approves via the platform finance flow; the owner
   * sees what has been approved and will be paid soon, without moving money.
   * Mirrors the `pay`-stage predicate in PlatformFinanceService.payableBoats
   * ({ status: 'payout_approved', payoutBatchId: null }). dueToBoat is stored
   * at approve time, so no recompute here.
   */
  async listApprovedForBoat(houseboatId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { houseboatId, status: 'payout_approved', payoutBatchId: null },
      orderBy: { id: 'desc' },
      select: { id: true, bookingId: true, dueToBoat: true },
    });
    return invoices.map((i) => ({
      id: i.id,
      bookingId: i.bookingId,
      dueToBoat: i.dueToBoat.toFixed(2), // signed, matches listForBoat
    }));
  }

  /**
   * Prepare a batch: pull all settleable invoices (paid + payment_verified),
   * compute due_to_boat per invoice (gateway receipts − commission; cash
   * excluded), lock them in_payout.
   */
  // ── RETIRED: batch payout WRITE path ────────────────────────────────────
  // prepareBatch/approveBatch/markPaid are disabled. They computed dueToBoat with
  // their own UNCAPPED gateway-receipts math (no overpayment cap) and bypassed the
  // human gateway-verify gate the live per-invoice console path enforces
  // (platform-finance.service.payBoat). Two writers of the dueToBoat column let an
  // overpaid invoice be paid out uncapped and let the stored figure diverge between
  // paths. The live admin payout UI uses /platform/finance/* per-invoice endpoints;
  // these routes have no frontend caller. The READ methods (listForBoat,
  // listApprovedForBoat) and the HouseboatPayoutBatch model are intentionally kept —
  // owner payout history + the per-invoice flow's receipt rows depend on them.
  private retired(): never {
    throw new BadRequestException(
      'The batch payout flow is retired. Use the per-invoice payout (approve → pay) instead.',
    );
  }

  async prepareBatch(_houseboatId: string, _preparedBy: string): Promise<never> {
    return this.retired();
  }

  async approveBatch(_batchId: string, _approvedBy: string): Promise<never> {
    return this.retired();
  }

  async markPaid(_batchId: string, _actorId: string): Promise<never> {
    return this.retired();
  }

  listBatches(houseboatId: string) {
    return this.prisma.houseboatPayoutBatch.findMany({
      where: { houseboatId },
      orderBy: { id: 'desc' },
    });
  }
}
