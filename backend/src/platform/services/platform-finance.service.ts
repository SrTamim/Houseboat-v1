import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { newId } from '../../common/uuid';
import { money, add, sub, ZERO } from '../../common/money';
import { dueToBoat } from '../../common/billing';
import { decryptJson } from '../../common/crypto';
import { assertTransition, type InvoiceStatus } from '../../money/invoice-state';
import { cursorArgs, toPage, type Page } from '../../common/paginate';
import type {
  ListCashoutsQueryDto,
  ListCouponsQueryDto,
  ListCreditsQueryDto,
  ListInvoicesQueryDto,
  ListPayoutBatchesQueryDto,
  ListPayoutReceiptsQueryDto,
  ListRefundsQueryDto,
  ListSubscriptionInvoicesQueryDto,
  PayableBoatsQueryDto,
  UpsertBillingConfigDto,
} from '../dto/platform.dto';

/**
 * Cross-boat finance reads for the platform console.
 *
 * The boat-scoped equivalents live in MoneyModule and stay there — these are
 * the variants that deliberately span every boat, which is why they sit behind
 * the single @PlatformOnly() gate on PlatformFinanceController.
 */
@Injectable()
export class PlatformFinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Predicate: the customer has fully paid (no outstanding due) AND the trip is
   * completed. Used by the verify + payout queues so a boat is never paid before
   * its trip happens or while a balance is owed. `amountPaid >= displayTotal`
   * uses a Prisma field-reference (column-to-column compare) so it stays in SQL
   * and paginates correctly; `booking.status` becomes 'completed' via the
   * departure-status cron.
   */
  private fullyPaidCompleted() {
    return {
      amountPaid: { gte: this.prisma.invoice.fields.displayTotal },
      booking: { is: { status: 'completed' } },
    };
  }

  /**
   * Payout batches across all boats, newest first.
   *
   * PayoutsService.listBatches covers a single boat and had no HTTP route;
   * this is the cross-boat, paginated form the console needs.
   */
  async listPayoutBatches(
    query: ListPayoutBatchesQueryDto,
  ): Promise<Page<{ id: string }>> {
    const rows = await this.prisma.houseboatPayoutBatch.findMany({
      ...cursorArgs(query),
      where: query.houseboatId ? { houseboatId: query.houseboatId } : undefined,
      include: {
        houseboat: { select: { id: true, name: true, slug: true } },
      },
      // preparedBy/approvedBy are returned deliberately: separation of duties
      // means the same account cannot both prepare and approve a batch
      // (payouts.service.ts:117), and the console needs these to disable the
      // Approve button rather than let the click fail with a 403.
    });
    return toPage(rows, query);
  }

  /**
   * Invoices across all boats, newest first, optionally narrowed by state.
   *
   * Backs the console's verify/payout queues. The gateway verify queue is
   * status=paid narrowed to gateway payments; the payout-prep queue is
   * `settleable` (paid + payment_verified, unbatched — owner cash settles
   * without a verify step). The
   * boat-scoped money endpoints can't serve those screens — they all require a
   * :houseboatId.
   */
  async listInvoices(query: ListInvoicesQueryDto): Promise<Page<{ id: string }>> {
    const q = query.q?.trim();
    const rows = await this.prisma.invoice.findMany({
      ...cursorArgs(query),
      where: {
        // An explicit `status` wins. Otherwise derived queues:
        //  - settleable: owner-recorded 'paid' + verified 'payment_verified',
        //    unbatched (payout-prep, mirrors payouts.service.ts pickup).
        //  - gatewayPending: 'paid' invoices with a gateway payment (the only
        //    thing the platform still verifies), NARROWED to fully-paid,
        //    completed-trip invoices — never verify a boat's payout before the
        //    trip happens or while the customer still owes.
        //  - payoutQueue: the payout-console queue — paid/payment_verified plus
        //    already-approved, unbatched, same fully-paid + completed gate.
        ...(query.status
          ? { status: query.status }
          : query.settleable
            ? { status: { in: ['paid', 'payment_verified'] }, payoutBatchId: null }
            : query.gatewayPending
              ? {
                  // Verify page — combined list of two things needing a human:
                  //  (a) gateway payments to verify (paid + fully-paid/completed);
                  //  (b) customer-requested refunds to verify (refund_requested,
                  //      web only). Refund invoices are fully paid but NOT
                  //      completed (the trip was cancelled), so they must NOT go
                  //      through fullyPaidCompleted() — hence a separate OR arm.
                  //  Combined under a named AND so this OR never collides with the
                  //  free-text `q` OR below (object-literal keys would dedupe).
                  AND: [
                    {
                      OR: [
                        {
                          status: 'paid',
                          payments: { some: { method: 'gateway' } },
                          ...this.fullyPaidCompleted(),
                        },
                        {
                          status: 'refund_requested',
                          booking: { is: { channel: 'web' } },
                          amountPaid: {
                            gte: this.prisma.invoice.fields.displayTotal,
                          },
                        },
                      ],
                    },
                  ],
                }
              : query.payoutQueue
                ? {
                    // Verify → Payouts are sequential: an unverified 'paid'
                    // invoice belongs on the Verify page, not here. Payouts lists
                    // only verified (ready-to-approve) and already-approved
                    // invoices — so Reject (→ 'paid') removes it from this page
                    // and it reappears on Verify.
                    status: { in: ['payment_verified', 'payout_approved'] },
                    payoutBatchId: null,
                    ...this.fullyPaidCompleted(),
                  }
                : {}),
        // Free-text search (booking-invoice console only — the verify/payout
        // pages never send `q`). ANDs with the status/branch predicate above.
        // Booking id is a UUID (no prefix search), so match customer + boat.
        ...(q
          ? {
              OR: [
                { customer: { name: { contains: q, mode: 'insensitive' } } },
                { customer: { phone: { contains: q } } },
                { houseboat: { name: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {}),
        houseboatId: query.houseboatId ?? undefined,
        // Filter to invoices whose trip the owner cancelled (badge filter).
        ...(query.departureCancelled
          ? { booking: { is: { departure: { is: { status: 'cancelled' } } } } }
          : {}),
      },
      select: {
        id: true,
        status: true,
        displayTotal: true,
        amountPaid: true,
        dueToBoat: true,
        commission: true,
        payoutBatchId: true,
        houseboat: { select: { id: true, name: true, slug: true } },
        customer: { select: { id: true, name: true, phone: true } },
        booking: {
          select: {
            id: true,
            status: true,
            type: true,
            channel: true,
            createdAt: true,
            // status + cancelReason drive the "Host-cancelled" badge — a
            // host-cancelled trip leaves the invoice 'paid', so the invoice
            // status alone can't reveal it.
            departure: {
              select: { startDate: true, status: true, cancelReason: true },
            },
            cabins: { select: { id: true } },
          },
        },
        payments: {
          select: { id: true, amount: true, method: true, gatewayToken: true },
        },
        // Latest refund (if any) so the Verify page can fire the verify-refund
        // action against the right refund id and label it by origin.
        refunds: {
          orderBy: { id: 'desc' },
          take: 1,
          select: { id: true, status: true, origin: true },
        },
      },
    });
    // Flatten the cabins array into a count — the table shows a per-booking
    // cabin count, mirroring platform-ops.service.ts listBookings. Surface the
    // latest refund's id/origin/status as flat fields for the refund-verify
    // action and the host-cancelled badge.
    const shaped = rows.map(({ booking, refunds, ...r }) => {
      const { cabins, ...bk } = booking;
      const latestRefund = refunds[0] ?? null;
      return {
        ...r,
        booking: bk,
        cabinCount: cabins.length,
        refundId: latestRefund?.id ?? null,
        refundOrigin: latestRefund?.origin ?? null,
        refundStatus: latestRefund?.status ?? null,
      };
    });
    return toPage(shaped, query);
  }

  /**
   * Full detail for one invoice — powers the admin "Open" drawer on the finance
   * queues. Read-only: the bill breakdown, the boat + customer, the booking it
   * belongs to (with its cabins and any reschedule history), and every payment.
   * 404 if the id is unknown. Mirrors getBooking in platform-ops.service.ts.
   */
  async getInvoice(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        status: true,
        roomTotal: true,
        discountAmount: true,
        priceShown: true,
        displayTotal: true,
        amountPaid: true,
        amountOverpaid: true,
        commission: true,
        dueToBoat: true,
        payoutBatchId: true,
        creditsFrom: { select: { amount: true, status: true, kind: true } }, // refund subtract
        houseboat: { select: { id: true, name: true, slug: true } },
        customer: { select: { id: true, name: true, phone: true, email: true } },
        booking: {
          select: {
            id: true,
            type: true,
            channel: true,
            status: true,
            createdAt: true,
            departure: {
              select: {
                id: true,
                startDate: true,
                endDate: true,
                // Host-cancelled badge in the drawer's Status section.
                status: true,
                cancelReason: true,
                package: {
                  select: {
                    durationLabel: true,
                    houseboat: { select: { id: true, name: true } },
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
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            method: true,
            gatewayToken: true,
            paidAt: true,
          },
          orderBy: { paidAt: 'asc' },
        },
        // Latest refund → the drawer's host-cancelled/refund badge.
        refunds: {
          orderBy: { id: 'desc' },
          take: 1,
          select: { status: true, origin: true },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    // due_to_boat is stored only from payout-approval onward (0 before that).
    // For the read model, always surface the live settlement value so the
    // Verify/Payouts drawers show the real amount. Same math as dueForInvoice.
    const live = this.dueForInvoice({
      commission: invoice.commission,
      displayTotal: invoice.displayTotal,
      status: invoice.status,
      payments: invoice.payments,
      creditsFrom: invoice.creditsFrom,
    });
    const { refunds, creditsFrom, ...rest } = invoice;
    void creditsFrom; // used only for the dueForInvoice refund adjustment above
    return {
      ...rest,
      dueToBoat: live.toFixed(2),
      refundStatus: refunds[0]?.status ?? null,
    };
  }

  // ── Payout console: approve / reject / pay + receipts ──────────────────────

  /**
   * Gateway receipts − commission for one invoice. SIGNED.
   *
   * Overpayment cap: the gateway payment path (recordGatewayPayment) does not
   * reject overpayments, so gateway receipts can exceed the invoice's
   * displayTotal. The boat is only owed on what it actually billed, so cap the
   * receipts at displayTotal before computing due — otherwise a customer's
   * accidental overpayment would inflate the boat's payout. The surplus is
   * tracked separately as amountOverpaid (refunded to the customer, not paid to
   * the boat). displayTotal is optional so legacy callers that don't select it
   * fall back to the uncapped figure.
   */
  private dueForInvoice(inv: {
    commission: unknown;
    displayTotal?: unknown;
    status?: unknown;
    payments: { method: string; amount: unknown }[];
    creditsFrom?: { amount: unknown; status: string; kind?: string | null }[];
  }) {
    let gatewayReceipts = inv.payments
      .filter((p) => p.method === 'gateway')
      .reduce((s, p) => add(s, money(p.amount as string)), ZERO);
    if (inv.displayTotal != null) {
      const total = money(inv.displayTotal as string);
      if (gatewayReceipts.greaterThan(total)) gatewayReceipts = total;
    }
    let due = dueToBoat(gatewayReceipts, money(inv.commission as string));

    // Second, separate adjustment (ordered AFTER the receipts cap so the two
    // never double-count): when a booking is cancelled, the customer's refund is
    // issued as a CustomerCredit sourced from this invoice while amountPaid is
    // left intact. If such an invoice is later re-verified and paid out, the boat
    // would receive the full receipts even though the platform already handed the
    // customer that refund. Subtract those refund credits from the boat's due.
    // Subtract refund credits sourced from this invoice. A REFUND credit
    // (kind='refund', from a cancellation) is money the platform disbursed on the
    // customer's behalf while amountPaid was left intact, so it must reduce the
    // boat's due whether the customer has since spent it ('used') or not (audit
    // M-M1): excluding 'used' let a customer spend the refund AND the boat still
    // be paid the full receipts — the refund paid twice.
    //
    // A REBATE credit (kind='rebate', open-seat first-booker surplus) is NOT
    // subtracted here: that scenario already reduced this invoice's own
    // displayTotal, so subtracting the rebate again would double-count. Legacy
    // rows (kind null) are treated as refunds but still exclude 'used', matching
    // the prior behavior so historical settlements don't shift.
    if (inv.creditsFrom?.length) {
      const refunded = inv.creditsFrom
        .filter((c) => {
          if (c.kind === 'rebate') return false;
          if (c.kind === 'refund') return true; // incl. 'used' → M-M1 fix
          return c.status !== 'used'; // legacy null kind → prior behavior
        })
        .reduce((s, c) => add(s, money(c.amount as string)), ZERO);
      due = sub(due, refunded);
    }
    return due;
  }

  /**
   * Approve one invoice for payout: paid|payment_verified → payout_approved.
   * Computes and stores dueToBoat now (the column is 0 until settlement) so the
   * Pay page shows a real amount. Locks the invoice against refund/cancel.
   */
  async approveInvoiceForPayout(invoiceId: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: {
          id: true,
          status: true,
          commission: true,
          displayTotal: true, // overpayment cap in dueForInvoice
          houseboatId: true,
          payments: { select: { method: true, amount: true } },
          creditsFrom: { select: { amount: true, status: true, kind: true } }, // refund subtract
        },
      });
      if (!inv) throw new NotFoundException('Invoice not found');
      assertTransition(inv.status as InvoiceStatus, 'payout_approved');
      const due = this.dueForInvoice(inv);
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: 'payout_approved', dueToBoat: due },
      });
      await this.audit.log(
        {
          houseboatId: inv.houseboatId,
          actorAccountId: actorId,
          action: 'invoice_payout_approved',
          entityType: 'invoice',
          entityId: invoiceId,
          before: { status: inv.status },
          after: { status: 'payout_approved', dueToBoat: due.toFixed(2) },
        },
        tx,
      );
      return { ok: true };
    });
  }

  /**
   * Reject an invoice back to the verify queue: payout_approved OR
   * payment_verified → paid (dueToBoat reset to 0). A 'paid' invoice is already
   * in the verify queue, so rejecting it is a no-op the state machine rejects.
   */
  async rejectInvoicePayout(invoiceId: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: { id: true, status: true, houseboatId: true },
      });
      if (!inv) throw new NotFoundException('Invoice not found');
      if (inv.status !== 'payout_approved' && inv.status !== 'payment_verified') {
        throw new BadRequestException(
          'Only an approved or payment-verified invoice can be rejected to the verify queue',
        );
      }
      assertTransition(inv.status as InvoiceStatus, 'paid');
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: 'paid', dueToBoat: 0 },
      });
      await this.audit.log(
        {
          houseboatId: inv.houseboatId,
          actorAccountId: actorId,
          action: 'invoice_payout_rejected',
          entityType: 'invoice',
          entityId: invoiceId,
          before: { status: inv.status },
          after: { status: 'paid' },
        },
        tx,
      );
      return { ok: true };
    });
  }

  /**
   * Distinct boats with invoices in the payout pipeline, for the dropdowns.
   * `approve` = the payout-queue predicate; `pay` = already-approved invoices.
   */
  async payableBoats(query: PayableBoatsQueryDto) {
    const where =
      query.stage === 'pay'
        ? { status: 'payout_approved', payoutBatchId: null }
        : {
            // Mirror the payoutQueue predicate (verified + approved only).
            status: { in: ['payment_verified', 'payout_approved'] },
            payoutBatchId: null,
            ...this.fullyPaidCompleted(),
          };
    const grouped = await this.prisma.invoice.groupBy({
      by: ['houseboatId'],
      where,
      _count: true,
    });
    if (grouped.length === 0) return [];
    const boats = await this.prisma.houseboat.findMany({
      where: { id: { in: grouped.map((g) => g.houseboatId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(boats.map((b) => [b.id, b.name]));
    return grouped
      .map((g) => ({
        id: g.houseboatId,
        name: nameById.get(g.houseboatId) ?? '—',
        count: g._count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Pay a selected set of one boat's approved invoices to the vendor. Creates a
   * receipt (HouseboatPayoutBatch, status 'paid') snapshotting the boat's bank
   * details, moves each invoice payout_approved → bill_cleared, and offsets a
   * negative total against platform_balance. Everything in one transaction; the
   * invoice rows are locked FOR UPDATE up front so a concurrent double-pay
   * serializes and the second attempt is rejected (payoutBatchId !== null)
   * rather than paying twice.
   */
  async payInvoices(
    houseboatId: string,
    invoiceIds: string[],
    actorId: string,
  ) {
    const boat = await this.prisma.houseboat.findUnique({
      where: { id: houseboatId },
      select: { bankAccount: true },
    });
    if (!boat) throw new NotFoundException('Houseboat not found');
    if (!boat.bankAccount) {
      throw new BadRequestException(
        'This houseboat has no bank account on file — add one before paying out',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Lock every target invoice row FOR UPDATE before the status/payoutBatchId
      // re-checks, so two concurrent payInvoices calls for the same invoice(s)
      // serialize: the loser blocks here, then reads payoutBatchId !== null below
      // and is rejected instead of creating a second payout batch (double-pay).
      // A findMany + in-app check without this lock does NOT prevent the race
      // under Read Committed — both readers see payoutBatchId === null. Lock in a
      // stable (sorted) id order so two overlapping calls can't deadlock each
      // other by grabbing the same rows in opposite orders. Prisma has no native
      // FOR UPDATE; take it with raw SQL, one row at a time (the selected set is
      // small), matching the idiom in payments.service.recordPayment.
      const orderedIds = [...new Set(invoiceIds)].sort();
      for (const id of orderedIds) {
        await tx.$queryRaw`
          SELECT id FROM invoice WHERE id = ${id}::uuid FOR UPDATE`;
      }

      const invoices = await tx.invoice.findMany({
        where: { id: { in: invoiceIds } },
        select: {
          id: true,
          status: true,
          houseboatId: true,
          payoutBatchId: true,
          commission: true,
          displayTotal: true, // overpayment cap in dueForInvoice
          payments: { select: { method: true, amount: true } },
          creditsFrom: { select: { amount: true, status: true, kind: true } }, // refund subtract
        },
      });
      if (invoices.length !== invoiceIds.length) {
        throw new BadRequestException('Some invoices were not found');
      }
      for (const inv of invoices) {
        if (
          inv.houseboatId !== houseboatId ||
          inv.status !== 'payout_approved' ||
          inv.payoutBatchId !== null
        ) {
          throw new BadRequestException(
            `Invoice ${inv.id} is not an approved, unpaid invoice for this boat`,
          );
        }
      }

      let total = ZERO;
      for (const inv of invoices) total = add(total, this.dueForInvoice(inv));

      const receipt = await tx.houseboatPayoutBatch.create({
        data: {
          id: newId(),
          houseboatId,
          totalAmount: total,
          status: 'paid',
          paidAt: new Date(),
          paidBy: actorId,
          bankSnapshot: boat.bankAccount as object,
        },
      });

      for (const inv of invoices) {
        assertTransition(inv.status as InvoiceStatus, 'bill_cleared');
        await tx.invoice.update({
          where: { id: inv.id },
          data: { status: 'bill_cleared', payoutBatchId: receipt.id },
        });
      }

      // A negative total (low deposits + cash owed + commission) offsets the
      // boat's signed platform_balance, same as the legacy markPaid.
      if (total.isNegative()) {
        const config = await tx.houseboatBillingConfig.findFirst({
          where: { houseboatId },
        });
        if (config) {
          await tx.houseboatBillingConfig.update({
            where: { id: config.id },
            data: { platformBalance: add(money(config.platformBalance), total) },
          });
        }
      }

      await this.audit.log(
        {
          houseboatId,
          actorAccountId: actorId,
          action: 'payout_paid',
          entityType: 'houseboat_payout_batch',
          entityId: receipt.id,
          after: {
            total: total.toFixed(2),
            invoiceIds,
            invoices: invoices.length,
          },
        },
        tx,
      );
      return { receiptId: receipt.id };
    });
  }

  /** Past payout receipts (paid batches), newest first, searchable by boat/id. */
  async listPayoutReceipts(
    query: ListPayoutReceiptsQueryDto,
  ): Promise<Page<{ id: string }>> {
    const q = query.q?.trim();
    const rows = await this.prisma.houseboatPayoutBatch.findMany({
      ...cursorArgs(query),
      where: {
        status: 'paid',
        ...(q
          ? { houseboat: { name: { contains: q, mode: 'insensitive' } } }
          : {}),
      },
      select: {
        id: true,
        totalAmount: true,
        paidAt: true,
        houseboat: { select: { id: true, name: true } },
        paidByAccount: { select: { id: true, name: true } },
        _count: { select: { invoices: true } },
      },
    });
    return toPage(rows, query);
  }

  /** Full payout receipt for the printable view. */
  async getPayoutReceipt(receiptId: string) {
    const receipt = await this.prisma.houseboatPayoutBatch.findUnique({
      where: { id: receiptId },
      select: {
        id: true,
        totalAmount: true,
        paidAt: true,
        status: true,
        bankSnapshot: true,
        houseboat: { select: { id: true, name: true, slug: true } },
        paidByAccount: { select: { id: true, name: true } },
        invoices: {
          select: {
            id: true,
            displayTotal: true,
            amountPaid: true,
            dueToBoat: true,
            commission: true,
            customer: { select: { id: true, name: true, phone: true } },
            booking: {
              select: {
                id: true,
                departure: { select: { startDate: true } },
              },
            },
          },
        },
      },
    });
    if (!receipt) throw new NotFoundException('Payout receipt not found');
    return receipt;
  }

  /**
   * Refunds across all boats. bank_details are encrypted PII and deliberately
   * never selected here — the console shows who/what/when, not account numbers.
   */
  async listRefunds(query: ListRefundsQueryDto): Promise<Page<{ id: string }>> {
    const rows = await this.prisma.invoiceRefund.findMany({
      ...cursorArgs(query),
      where: { status: query.status ?? undefined },
      select: {
        id: true,
        amount: true,
        reason: true,
        status: true,
        origin: true,
        claimDeadline: true,
        completedAt: true,
        requestedByAccount: { select: { id: true, name: true } },
        verifiedByAccount: { select: { id: true, name: true } },
        completedByAccount: { select: { id: true, name: true } },
        invoice: {
          select: {
            id: true,
            status: true,
            displayTotal: true,
            houseboat: { select: { id: true, name: true } },
            customer: { select: { id: true, name: true, phone: true } },
            booking: { select: { id: true, channel: true } },
          },
        },
      },
    });
    return toPage(rows, query);
  }

  /**
   * Decrypt one refund's payout destination for the admin who is sending the
   * money. bank_details are AES-encrypted at rest and kept off listRefunds
   * (PII minimization) — this reveals them only on demand in the drawer.
   */
  async bankDetailsForRefund(refundId: string) {
    const refund = await this.prisma.invoiceRefund.findUnique({
      where: { id: refundId },
      select: { bankDetails: true },
    });
    if (!refund) throw new NotFoundException('Refund not found');
    if (refund.bankDetails == null) return { bankDetails: null };
    const bankDetails = decryptJson(
      refund.bankDetails as unknown as string,
      this.config.get<string>('encryptionKey') ?? '',
    );
    return { bankDetails };
  }

  /** Invoices where the customer paid more than the final bill (buyout adjustments). */
  async listOverpayments(query: ListInvoicesQueryDto): Promise<Page<{ id: string }>> {
    const rows = await this.prisma.invoice.findMany({
      ...cursorArgs(query),
      where: {
        amountOverpaid: { gt: 0 },
        houseboatId: query.houseboatId ?? undefined,
      },
      select: {
        id: true,
        status: true,
        displayTotal: true,
        amountPaid: true,
        amountOverpaid: true,
        houseboat: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, phone: true } },
        booking: {
          select: {
            id: true,
            channel: true,
            createdAt: true,
            // Host-cancelled badge on the overpayments list.
            departure: { select: { status: true, cancelReason: true } },
          },
        },
      },
    });
    return toPage(rows, query);
  }

  async listCredits(query: ListCreditsQueryDto): Promise<Page<{ id: string }>> {
    const rows = await this.prisma.customerCredit.findMany({
      ...cursorArgs(query),
      where: { status: query.status ?? undefined },
      select: {
        id: true,
        amount: true,
        status: true,
        account: { select: { id: true, name: true, phone: true } },
        sourceInvoice: {
          select: { id: true, houseboat: { select: { name: true } } },
        },
        usedInInvoice: { select: { id: true } },
      },
    });
    return toPage(rows, query);
  }

  /** Customer cash-out requests across all accounts, newest first. */
  async listCashouts(query: ListCashoutsQueryDto): Promise<Page<{ id: string }>> {
    const rows = await this.prisma.cashoutRequest.findMany({
      ...cursorArgs(query),
      where: { status: query.status ?? undefined },
      select: {
        id: true,
        amount: true,
        method: true,
        accountRef: true,
        bankName: true,
        status: true,
        note: true,
        createdAt: true,
        resolvedAt: true,
        account: { select: { id: true, name: true, phone: true } },
        resolvedByAccount: { select: { id: true, name: true } },
      },
    });
    return toPage(rows, query);
  }

  /**
   * Approve a pending cash-out: mark it approved and burn its locked credits
   * (pending_cashout → used) so the money leaves the wallet. Idempotent guard:
   * only a `pending` request can be resolved.
   */
  async approveCashout(id: string, actorId: string) {
    return this.resolveCashout(id, actorId, 'approved');
  }

  /**
   * Reject a pending cash-out: mark it rejected and return its locked credits
   * (pending_cashout → open) so the balance is spendable again.
   */
  async rejectCashout(id: string, actorId: string) {
    return this.resolveCashout(id, actorId, 'rejected');
  }

  private async resolveCashout(
    id: string,
    actorId: string,
    outcome: 'approved' | 'rejected',
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Lock the request row so two concurrent resolves (approve racing reject,
      // or a double-click) serialize: the loser blocks, then reads status !=
      // 'pending' and is rejected instead of both moving the locked credits
      // (audit #18/F6). The scoped updateMany below is already idempotent, but the
      // lock matches the rest of the money paths and prevents the wasted work.
      await tx.$queryRaw`
        SELECT id FROM cashout_request WHERE id = ${id}::uuid FOR UPDATE`;
      const req = await tx.cashoutRequest.findUnique({
        where: { id },
        select: { id: true, accountId: true, status: true, amount: true },
      });
      if (!req) throw new NotFoundException('Cash-out request not found');
      if (req.status !== 'pending') {
        throw new NotFoundException('Cash-out request is already resolved');
      }
      // Move the credits locked BY THIS request: approved → used (spent as
      // cash-out), rejected → open + unlink (back to spendable balance). Scoped
      // by cashoutRequestId so a second concurrent request's credits are never
      // touched. (Legacy rows locked before this column existed have a null id;
      // fall back to the account-wide match only when this request locked none.)
      const scoped = await tx.customerCredit.updateMany({
        where: {
          accountId: req.accountId,
          status: 'pending_cashout',
          cashoutRequestId: req.id,
        },
        data:
          outcome === 'approved'
            ? { status: 'used' }
            : { status: 'open', cashoutRequestId: null },
      });
      if (scoped.count === 0) {
        // Legacy request (pre-cashoutRequestId): its credits weren't stamped, so
        // fall back to the old account-wide move. Safe because the one-pending-
        // per-account guard means at most this request's credits are pending.
        await tx.customerCredit.updateMany({
          where: { accountId: req.accountId, status: 'pending_cashout' },
          data: { status: outcome === 'approved' ? 'used' : 'open' },
        });
      }
      const updated = await tx.cashoutRequest.update({
        where: { id },
        data: {
          status: outcome,
          resolvedAt: new Date(),
          resolvedByAccountId: actorId,
        },
        select: { id: true, status: true, amount: true, resolvedAt: true },
      });
      await this.audit.log(
        {
          actorAccountId: actorId,
          action: `cashout_${outcome}`,
          entityType: 'cashout_request',
          entityId: id,
          after: { amount: req.amount.toString(), status: outcome },
        },
        tx,
      );
      return updated;
    });
  }

  /** Monthly platform bills to boats, across all boats. */
  async listSubscriptionInvoices(
    query: ListSubscriptionInvoicesQueryDto,
  ): Promise<Page<{ id: string }>> {
    const q = query.q?.trim();
    const rows = await this.prisma.houseboatSubscriptionInvoice.findMany({
      ...cursorArgs(query),
      where: {
        status: query.status ?? undefined,
        houseboatId: query.houseboatId ?? undefined,
        ...(q
          ? {
              OR: [
                { houseboat: { name: { contains: q, mode: 'insensitive' } } },
                { period: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        period: true,
        monthlyFee: true,
        amountDue: true,
        status: true,
        issuedAt: true,
        houseboat: { select: { id: true, name: true } },
      },
    });
    return toPage(rows, query);
  }

  /**
   * Create or replace a boat's billing terms.
   *
   * This is the only write path for HouseboatBillingConfig — without it a boat
   * can never be commissioned (issueSubscriptionInvoice 404s with no config).
   * Keyed by findFirst({houseboatId}) to match every consumer
   * (booking.service.ts, finance.service.ts); Houseboat.billingConfigId is
   * dead and stays untouched. platformBalance NEVER appears in the update —
   * it is ledger-owned (payouts.service.ts, finance.service.ts).
   */
  async upsertBillingConfig(
    houseboatId: string,
    dto: UpsertBillingConfigDto,
    actorId: string,
  ) {
    const boat = await this.prisma.houseboat.findUnique({
      where: { id: houseboatId },
      select: { id: true },
    });
    if (!boat) throw new NotFoundException('Houseboat not found');

    const data = {
      commissionPct: dto.commissionPct ?? null,
      monthlyFee: dto.monthlyFee ?? null,
      trialEnds: dto.trialEnds ? new Date(dto.trialEnds) : null,
    };

    const existing = await this.prisma.houseboatBillingConfig.findFirst({
      where: { houseboatId },
    });

    const config = existing
      ? await this.prisma.houseboatBillingConfig.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.houseboatBillingConfig.create({
          data: { id: newId(), houseboatId, ...data },
        });

    // before/after list only the editable fields — including
    // platformBalance would imply this path can change it.
    const snapshot = (c: {
      commissionPct: unknown;
      monthlyFee: unknown;
      trialEnds: Date | null;
    }) => ({
      commissionPct: c.commissionPct?.toString() ?? null,
      monthlyFee: c.monthlyFee?.toString() ?? null,
      trialEnds: c.trialEnds?.toISOString().slice(0, 10) ?? null,
    });
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'billing_config_upsert',
      entityType: 'houseboat_billing_config',
      entityId: config.id,
      before: existing ? snapshot(existing) : null,
      after: snapshot(config),
    });

    return config;
  }

  /** Billing terms per boat, including the signed platform balance. */
  listBillingConfigs() {
    return this.prisma.houseboatBillingConfig.findMany({
      orderBy: { platformBalance: 'asc' },
      select: {
        id: true,
        commissionPct: true,
        monthlyFee: true,
        platformBalance: true,
        trialEnds: true,
        houseboat: { select: { id: true, name: true, status: true } },
      },
    });
  }

  /**
   * Boats that owe the platform: negative signed balance, plus any overdue
   * subscription invoices. Balance ordering puts the deepest debt first.
   */
  async listDebtors() {
    const [configs, overdue] = await this.prisma.$transaction([
      this.prisma.houseboatBillingConfig.findMany({
        where: { platformBalance: { lt: 0 } },
        orderBy: { platformBalance: 'asc' },
        select: {
          id: true,
          platformBalance: true,
          houseboat: { select: { id: true, name: true, status: true } },
        },
      }),
      this.prisma.houseboatSubscriptionInvoice.findMany({
        where: { status: 'overdue' },
        orderBy: { issuedAt: 'asc' },
        select: {
          id: true,
          period: true,
          amountDue: true,
          issuedAt: true,
          houseboat: { select: { id: true, name: true, status: true } },
        },
      }),
    ]);
    return { negativeBalances: configs, overdueInvoices: overdue };
  }

  async listCoupons(query: ListCouponsQueryDto): Promise<Page<{ id: string }>> {
    const q = query.q?.trim();
    const rows = await this.prisma.coupon.findMany({
      ...cursorArgs(query),
      where: {
        houseboatId: query.houseboatId ?? undefined,
        kind: query.kind ?? undefined,
        ...(q
          ? {
              OR: [
                { code: { contains: q, mode: 'insensitive' } },
                { houseboat: { name: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        code: true,
        kind: true,
        value: true,
        validFrom: true,
        validTo: true,
        houseboat: { select: { id: true, name: true } },
        _count: { select: { bookings: true } },
      },
    });
    return toPage(rows, query);
  }

  /**
   * Console analytics: platform-wide money aggregates plus a per-boat revenue
   * breakdown. Decimal sums are returned as strings — same convention as every
   * other money field on the wire.
   */
  async analyticsSummary() {
    const [totals, byBoatRaw, bookingCount, liveBoats] =
      await this.prisma.$transaction([
        this.prisma.invoice.aggregate({
          _sum: {
            displayTotal: true,
            commission: true,
            amountPaid: true,
            dueToBoat: true,
          },
          _count: true,
        }),
        this.prisma.invoice.groupBy({
          by: ['houseboatId'],
          _sum: { displayTotal: true, commission: true },
          _count: true,
          orderBy: { _sum: { displayTotal: 'desc' } },
          take: 10,
        }),
        this.prisma.booking.count(),
        this.prisma.houseboat.count({ where: { status: 'live' } }),
      ]);

    // groupBy can't join, so resolve the boat names in one follow-up query.
    const boats = await this.prisma.houseboat.findMany({
      where: { id: { in: byBoatRaw.map((r) => r.houseboatId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(boats.map((b) => [b.id, b.name]));

    return {
      totals: {
        gmv: totals._sum.displayTotal ?? 0,
        commission: totals._sum.commission ?? 0,
        collected: totals._sum.amountPaid ?? 0,
        dueToBoats: totals._sum.dueToBoat ?? 0,
        invoiceCount: totals._count,
        bookingCount,
        liveBoats,
      },
      revenueByBoat: byBoatRaw.map((r) => ({
        houseboatId: r.houseboatId,
        name: nameById.get(r.houseboatId) ?? r.houseboatId,
        gmv: r._sum?.displayTotal ?? 0,
        commission: r._sum?.commission ?? 0,
        invoiceCount: r._count,
      })),
    };
  }
}
