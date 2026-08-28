import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
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
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  /**
   * Recover the invoice id from a gateway transaction id.
   *
   * tran_id round-trips through the payment provider and comes back as
   * attacker-influenceable input, so the extracted value is validated as a
   * UUID before it is used in a lookup or reflected into a redirect URL.
   * Returns '' when it doesn't look like one.
   */
  private invoiceIdFromTran(tranId: string): string {
    const candidate = tranId.split(':')[0] ?? '';
    return UUID_RE.test(candidate) ? candidate : '';
  }

  /** Start a hosted payment for an invoice. Returns the URL to redirect to. */
  // Payment initiation is per-account state-changing and hits the gateway API;
  // tighter than the global limit to bound abuse and gateway spend.
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
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
        'bookings',
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
   * Settle an invoice WITHOUT taking money, so a booking can be confirmed
   * before the payment gateway is configured.
   *
   * Gated on `gateway.bypass` (PAYMENTS_BYPASS=true). Off by default, so an
   * unset production environment refuses every call even if this route ships.
   * Delete the route — or just clear the flag — once SSLCommerz is live; the
   * whole `initiate` → hosted page → IPN path is untouched and still works.
   *
   * Ownership, status and amount checks are the same ones `initiate` applies,
   * and the payment itself goes through the identical `recordGatewayPayment`
   * used by the IPN — so a 50% advance records as a partial and correctly
   * leaves the invoice `customer_due`, exactly as a real deposit would.
   */
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('dev/settle')
  async devSettle(@CurrentUser() user: AuthUser, @Body() dto: InitiatePaymentDto) {
    if (!this.config.get<boolean>('gateway.bypass')) {
      throw new ForbiddenException('Payment bypass is disabled');
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: dto.invoiceId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    // Same guard as initiate: own the invoice, or hold money:edit on the boat.
    if (invoice.customerId !== user.id) {
      await this.rbac.assert(
        user.id,
        user.isPlatform,
        invoice.houseboatId,
        'bookings',
        'edit',
      );
    }
    if (invoice.status !== 'customer_due') {
      throw new BadRequestException('Invoice is not awaiting payment');
    }

    const outstanding = sub(money(invoice.displayTotal), money(invoice.amountPaid));
    const amount = dto.amount ?? Number(outstanding.toFixed(2));
    if (amount <= 0 || money(amount).greaterThan(outstanding)) {
      throw new BadRequestException('Invalid payment amount');
    }

    const result = await this.payments.recordGatewayPayment({
      invoiceId: invoice.id,
      amount,
      gatewayToken: `bypass:${invoice.id}:${randomUUID()}`,
    });

    // Mirrors the IPN: recordGatewayPayment returns null on a replayed token,
    // and the e-ticket must only fire on a real first settlement.
    if (result) {
      await this.sendETicket(invoice.id).catch(() => undefined);
    }
    return { invoiceId: invoice.id };
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
            cabins: { include: { cabin: { select: { name: true } } } },
            departure: {
              include: {
                package: {
                  include: {
                    houseboat: { select: { name: true } },
                    route: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!invoice?.booking || !invoice.customer) return;
    const guest = invoice.booking.guests[0];
    const dep = invoice.booking.departure;
    const pkg = dep.package;
    // @db.Time is stored on the 1970-01-01 epoch date; the time part is UTC, so
    // slice HH:mm off the ISO string (matches trips.service.timeToDate's storage).
    const departureTimeStr = dep.departureTime
      ? dep.departureTime.toISOString().slice(11, 16)
      : undefined;
    const cabin =
      invoice.booking.cabins.map((c) => c.cabin.name).join(', ') || undefined;
    // Whole-taka display (no decimals), half-up.
    const taka = (v: Parameters<typeof money>[0]) => money(v).toFixed(0);
    const displayDue = sub(invoice.displayTotal, invoice.amountPaid);
    await this.notifications.sendETicket({
      accountId: invoice.customer.id,
      bookingId: invoice.booking.id,
      to: {
        phone: guest?.phone ?? invoice.customer.phone ?? undefined,
        email: invoice.customer.email ?? undefined,
        name: guest?.name ?? invoice.customer.name ?? 'Guest',
      },
      boatName: pkg.houseboat.name,
      operator: pkg.houseboat.name,
      route: pkg.route?.name ?? undefined,
      boarding: pkg.departureGhat ?? undefined,
      cabin,
      departureTimeStr,
      departureDate: dep.startDate,
      displayTotal: taka(invoice.displayTotal),
      displayPaid: taka(invoice.amountPaid),
      displayDue: taka(displayDue),
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
