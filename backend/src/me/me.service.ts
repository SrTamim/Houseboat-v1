import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { money, ZERO, add } from '../common/money';
import { normalizePhone } from '../auth/auth.types';
import { UpdateProfileDto } from './dto/update-profile.dto';

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
   */
  async credits(accountId: string) {
    const credits = await this.prisma.customerCredit.findMany({
      where: { accountId },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        amount: true,
        status: true,
        sourceInvoiceId: true,
        usedInInvoiceId: true,
      },
    });
    const balance = credits
      .filter((c) => c.status === 'open')
      .reduce((sum, c) => add(sum, money(c.amount)), ZERO);
    return {
      balance: balance.toFixed(2),
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
