import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RbacService } from '../rbac/rbac.service';
import { NotificationsService } from '../notifications/notifications.service';
import { newId } from '../common/uuid';

/** Quote requests expire 24h after being sent, or when the date fills. */
const QUOTE_TTL_HOURS = 24;

/**
 * Group quote requests (schema-ahead flow). A customer asks for a price on a
 * date/group size; the owner prices it (status → sent, 24h expiry); the customer
 * accepts (status → accepted) or it expires. No money moves here — accepting
 * hands off to the normal group-booking/checkout path with the quoted price.
 */
@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rbac: RbacService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Customer requests a quote for a boat on a date. */
  async request(
    houseboatId: string,
    customerId: string,
    input: { date?: string; groupSize?: number; specialNeeds?: string },
  ) {
    const boat = await this.prisma.houseboat.findUnique({
      where: { id: houseboatId },
      select: { id: true },
    });
    if (!boat) throw new NotFoundException('Houseboat not found');

    const quote = await this.prisma.quoteRequest.create({
      data: {
        id: newId(),
        houseboatId,
        customerId,
        date: input.date ? new Date(input.date) : undefined,
        groupSize: input.groupSize,
        specialNeeds: input.specialNeeds,
        status: 'requested',
      },
    });
    await this.audit.log({
      houseboatId,
      actorAccountId: customerId,
      action: 'quote_request',
      entityType: 'quote_request',
      entityId: quote.id,
    });
    return quote;
  }

  /** Owner prices a request → sends it to the customer with a 24h expiry. */
  async price(
    quoteId: string,
    actorId: string,
    isPlatform: boolean,
    quotedPrice: number,
  ) {
    const quote = await this.prisma.quoteRequest.findUnique({
      where: { id: quoteId },
      include: { customer: { select: { id: true, phone: true, email: true } } },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    await this.rbac.assert(actorId, isPlatform, quote.houseboatId, 'pricing', 'edit');
    if (quote.status !== 'requested') {
      throw new BadRequestException(`Cannot price a ${quote.status} quote`);
    }

    const expiresAt = new Date(Date.now() + QUOTE_TTL_HOURS * 60 * 60 * 1000);
    const updated = await this.prisma.quoteRequest.update({
      where: { id: quoteId },
      data: { quotedPrice, status: 'sent', expiresAt },
    });

    await this.notifications.notify({
      accountId: quote.customer.id,
      event: 'quote_sent',
      to: {
        phone: quote.customer.phone ?? undefined,
        email: quote.customer.email ?? undefined,
      },
      subject: 'Your houseboat quote is ready',
      message: `Your group quote is BDT ${quotedPrice.toFixed(2)}. It expires in ${QUOTE_TTL_HOURS}h.`,
    });
    await this.audit.log({
      houseboatId: quote.houseboatId,
      actorAccountId: actorId,
      action: 'quote_price',
      entityType: 'quote_request',
      entityId: quoteId,
      after: { quotedPrice: quotedPrice.toFixed(2) },
    });
    return updated;
  }

  /** Customer accepts a sent quote (must be their own, not expired). */
  async accept(quoteId: string, customerId: string) {
    const quote = await this.prisma.quoteRequest.findUnique({
      where: { id: quoteId },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.customerId !== customerId) {
      throw new BadRequestException('Not your quote');
    }
    if (quote.status !== 'sent') {
      throw new BadRequestException(`Quote is ${quote.status}`);
    }
    if (quote.expiresAt && quote.expiresAt.getTime() < Date.now()) {
      await this.prisma.quoteRequest.update({
        where: { id: quoteId },
        data: { status: 'expired' },
      });
      throw new BadRequestException('Quote has expired');
    }
    const updated = await this.prisma.quoteRequest.update({
      where: { id: quoteId },
      data: { status: 'accepted' },
    });
    await this.audit.log({
      houseboatId: quote.houseboatId,
      actorAccountId: customerId,
      action: 'quote_accept',
      entityType: 'quote_request',
      entityId: quoteId,
    });
    return updated;
  }

  /** Owner-side list of quote requests for a boat. */
  async listForBoat(houseboatId: string, actorId: string, isPlatform: boolean) {
    await this.rbac.assert(actorId, isPlatform, houseboatId, 'pricing', 'view');
    return this.prisma.quoteRequest.findMany({
      where: { houseboatId },
      orderBy: { status: 'asc' },
    });
  }

  /** Customer's own quote requests. */
  listForCustomer(customerId: string) {
    return this.prisma.quoteRequest.findMany({
      where: { customerId },
      orderBy: { id: 'desc' },
    });
  }
}
