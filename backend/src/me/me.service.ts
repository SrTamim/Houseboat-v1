import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { money, ZERO, add } from '../common/money';
import { newId } from '../common/uuid';
import { normalizePhone } from '../auth/auth.types';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateCashoutDto } from './dto/cashout.dto';

/**
 * Customer self-service account reads/writes. Every method is scoped to the
 * caller's own account id — there is no id param a caller could point at another
 * account's rows (IDOR-safe by construction).
 */
@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Wallet: open (unspent) credits and their sum, newest first. Credits are the
   * platform's "wallet" — refund overpayments land here and are spent FIFO at
   * the next checkout.
   *
   * `pending_cashout` credits are locked against an open cash-out request: they
   * do NOT count toward the spendable balance and are reported separately as
   * `pendingCashout` so the UI can show a "being reviewed" banner.
   */
  async credits(accountId: string) {
    const [credits, pendingRequest] = await Promise.all([
      this.prisma.customerCredit.findMany({
        where: { accountId },
        orderBy: { id: 'desc' },
        select: {
          id: true,
          amount: true,
          status: true,
          sourceInvoiceId: true,
          usedInInvoiceId: true,
        },
      }),
      this.prisma.cashoutRequest.findFirst({
        where: { accountId, status: 'pending' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, amount: true, method: true, createdAt: true },
      }),
    ]);
    const balance = credits
      .filter((c) => c.status === 'open')
      .reduce((sum, c) => add(sum, money(c.amount)), ZERO);
    const pendingCashout = credits
      .filter((c) => c.status === 'pending_cashout')
      .reduce((sum, c) => add(sum, money(c.amount)), ZERO);
    return {
      balance: balance.toFixed(2),
      pendingCashout: pendingCashout.toFixed(2),
      pendingRequest: pendingRequest
        ? {
            id: pendingRequest.id,
            amount: money(pendingRequest.amount).toFixed(2),
            method: pendingRequest.method,
            createdAt: pendingRequest.createdAt.toISOString(),
          }
        : null,
      credits: credits.map((c) => ({
        id: c.id,
        amount: money(c.amount).toFixed(2),
        status: c.status,
        sourceInvoiceId: c.sourceInvoiceId,
        usedInInvoiceId: c.usedInInvoiceId,
      })),
    };
  }

  /**
   * Request a cash-out of the caller's entire open wallet balance to
   * bKash/Nagad/bank. In one transaction: sum the open credits, reject if zero or
   * if a request is already pending, create the request, and flip every open
   * credit to `pending_cashout` so it can't be spent on a booking meanwhile.
   */
  async createCashout(accountId: string, dto: CreateCashoutDto) {
    if (dto.method === 'bank' && !dto.bankName?.trim()) {
      throw new BadRequestException('Bank name is required for a bank cash-out');
    }
    return this.prisma.$transaction(async (tx) => {
      const already = await tx.cashoutRequest.findFirst({
        where: { accountId, status: 'pending' },
        select: { id: true },
      });
      if (already) {
        throw new ConflictException('You already have a cash-out being reviewed');
      }
      const open = await tx.customerCredit.findMany({
        where: { accountId, status: 'open' },
        select: { id: true, amount: true },
      });
      const total = open.reduce((sum, c) => add(sum, money(c.amount)), ZERO);
      if (!total.greaterThan(ZERO)) {
        throw new BadRequestException('No wallet balance to cash out');
      }
      // Create the request first so its id can stamp the locked credits. Scoping
      // the lock to THIS request means resolving it later only touches its own
      // credits, never every pending_cashout credit on the account.
      const request = await tx.cashoutRequest.create({
        data: {
          id: newId(),
          accountId,
          amount: total,
          method: dto.method,
          accountRef: dto.accountRef.trim(),
          bankName: dto.bankName?.trim() || null,
          status: 'pending',
        },
        select: {
          id: true,
          amount: true,
          method: true,
          status: true,
          createdAt: true,
        },
      });
      await tx.customerCredit.updateMany({
        where: { accountId, status: 'open' },
        data: { status: 'pending_cashout', cashoutRequestId: request.id },
      });
      return request;
    });
  }

  /**
   * One of the caller's own invoices (for the payment-return poll). Scoped by
   * customerId so a caller can never read another account's invoice by id.
   */
  async invoice(accountId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, customerId: accountId },
      select: {
        id: true,
        bookingId: true,
        status: true,
        displayTotal: true,
        amountPaid: true,
        discountAmount: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return {
      id: invoice.id,
      bookingId: invoice.bookingId,
      status: invoice.status,
      displayTotal: invoice.displayTotal.toFixed(2),
      amountPaid: invoice.amountPaid.toFixed(2),
      discountAmount: invoice.discountAmount.toFixed(2),
    };
  }

  /** The caller's notification inbox, newest first. */
  listNotifications(accountId: string) {
    return this.prisma.notification.findMany({
      where: { accountId },
      orderBy: { at: 'desc' },
      take: 100,
    });
  }

  /**
   * Mark one notification read. Scoped by accountId in the WHERE so a caller can
   * only ever touch their own row; a foreign/absent id updates nothing → 404,
   * with no signal about whether the id exists for someone else.
   */
  async markNotificationRead(accountId: string, notificationId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { id: notificationId, accountId, readAt: null },
      data: { readAt: new Date() },
    });
    if (res.count === 0) {
      // Either already read, not the caller's, or gone. Confirm ownership before
      // reporting success so we don't leak existence of another account's row.
      const own = await this.prisma.notification.findFirst({
        where: { id: notificationId, accountId },
        select: { id: true },
      });
      if (!own) throw new NotFoundException('Notification not found');
    }
    return { ok: true };
  }

  /** Update the caller's own profile. Phone stays unique across accounts. */
  async updateProfile(accountId: string, dto: UpdateProfileDto) {
    const data: Prisma.AccountUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = normalizePhone(dto.phone);
    // NID is plaintext (not a secret) — blank clears it.
    if (dto.nid !== undefined) data.nid = dto.nid.trim() || null;

    try {
      const account = await this.prisma.account.update({
        where: { id: accountId },
        data,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          phoneVerified: true,
          isPlatform: true,
          nid: true,
        },
      });
      return account;
    } catch (e) {
      // Unique violation on phone — another account already uses it.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('That phone number is already in use');
      }
      throw e;
    }
  }
}
