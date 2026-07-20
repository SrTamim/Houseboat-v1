import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Query,
  Res,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { randomUUID } from 'crypto';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../money/payments.service';
import { AuditService } from '../audit/audit.service';
import { RbacService } from '../rbac/rbac.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SslcommerzService } from './sslcommerz.service';
import { CurrentUser, Public } from '../auth/decorators';
import { AuthUser } from '../auth/auth.types';
import { money, sub } from '../common/money';
import { InitiatePaymentDto, SslcommerzIpnDto } from './dto/gateway.dto';

/**
 * Payment-gateway endpoints (SSLCommerz). Checkout already created the invoice
 * at customer_due; this drives the online payment against it.
 *
 * tran_id carries the invoiceId so the IPN maps back: `${invoiceId}:${nonce}`.
 * The IPN is server-to-server and unauthenticated by cookie — we re-validate
 * every notification against SSLCommerz before trusting it.
 */
@Controller('gateway/sslcommerz')
export class GatewayController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sslcz: SslcommerzService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
    private readonly rbac: RbacService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  private tranId(invoiceId: string): string {
    return `${invoiceId}:${randomUUID()}`;
  }

  private invoiceIdFromTran(tranId: string): string {
    return tranId.split(':')[0];
  }

  /** Start a hosted payment for an invoice. Returns the URL to redirect to. */
  @Post('initiate')
  async initiate(
    @CurrentUser() user: AuthUser,
    @Body() dto: InitiatePaymentDto,
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: dto.invoiceId },
      include: {
        booking: { include: { guests: { take: 1 } } },
        customer: { select: { name: true, phone: true, email: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    // The paying customer must own the invoice (or be authorized on the boat).
    if (invoice.customerId !== user.id) {
      await this.rbac.assert(
        user.id,
        user.isPlatform,
        invoice.houseboatId,
        'money',
        'edit',
      );
    }
    if (invoice.status !== 'customer_due') {
      throw new BadRequestException('Invoice is not awaiting payment');
    }

    // Amount owed = displayTotal − amountPaid (supports deposit or full).
    const outstanding = sub(money(invoice.displayTotal), money(invoice.amountPaid));
    const amount = dto.amount ?? Number(outstanding.toFixed(2));
    if (amount <= 0 || money(amount).greaterThan(outstanding)) {
      throw new BadRequestException('Invalid payment amount');
    }

    const guest = invoice.booking?.guests?.[0];
    const { gatewayPageUrl } = await this.sslcz.initiate({
      invoiceId: invoice.id,
      tranId: this.tranId(invoice.id),
      amount,
      customerName: guest?.name ?? invoice.customer?.name ?? 'Guest',
      customerPhone: guest?.phone ?? invoice.customer?.phone ?? 'N/A',
      customerEmail: invoice.customer?.email ?? undefined,
    });
    return { gatewayPageUrl };
  }

  /**
   * SSLCommerz IPN (server-to-server). We NEVER trust the posted status — we
   * re-validate by val_id, then record the payment idempotently.
   */
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 300 } })
  // SSLCommerz posts ~30 fields; strip extras instead of rejecting (the global
  // pipe's forbidNonWhitelisted would 400 the whole IPN).
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @Post('ipn')
  async ipn(@Body() body: SslcommerzIpnDto) {
    if (!body.val_id) throw new BadRequestException('Missing val_id');

    const validated = await this.sslcz.validate(body.val_id);
    if (!validated) {
      // Not a real completed payment — acknowledge without recording.
      return { ok: false };
    }

    const invoiceId = this.invoiceIdFromTran(validated.tranId);
    const result = await this.payments.recordGatewayPayment({
      invoiceId,
      amount: validated.amount,
      gatewayToken: validated.valId,
    });

    // result is null on a replayed IPN — only send the e-ticket on the first
    // successful confirmation.
    if (result) {
      await this.sendETicket(invoiceId).catch(() => undefined);
    }
    return { ok: true };
  }

  /** Fire the confirmation e-ticket (SMS + email). Best-effort; never blocks. */
  private async sendETicket(invoiceId: string): Promise<void> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        booking: {
          include: {
            guests: { take: 1 },
            departure: {
              include: { package: { include: { houseboat: { select: { name: true } } } } },
            },
          },
        },
      },
    });
    if (!invoice?.booking || !invoice.customer) return;
    const guest = invoice.booking.guests[0];
    await this.notifications.sendETicket({
      accountId: invoice.customer.id,
      bookingId: invoice.booking.id,
      to: {
        phone: guest?.phone ?? invoice.customer.phone ?? undefined,
        email: invoice.customer.email ?? undefined,
        name: guest?.name ?? invoice.customer.name ?? 'Guest',
      },
      boatName: invoice.booking.departure.package.houseboat.name,
      departureDate: invoice.booking.departure.startDate,
      displayTotal: invoice.displayTotal.toFixed(2),
    });
  }

  /**
   * Browser landing after the hosted page. Purely UX — the IPN is the source of
   * truth. Bounce the user back to the SPA; it polls the invoice for status.
   */
  @Public()
  @Get('return')
  return(@Query('tran_id') tranId: string | undefined, @Res() res: Response) {
    const web = this.config.get<string>('webOriginUrl');
    const invoiceId = tranId ? this.invoiceIdFromTran(tranId) : '';
    return res.redirect(`${web}/booking/payment-return?invoice=${invoiceId}`);
  }
}
