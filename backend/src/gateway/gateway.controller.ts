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
import { BookingService } from '../booking/booking.service';
import { InitiatePaymentDto, SslcommerzIpnDto } from './dto/gateway.dto';

/**
 * Payment-gateway endpoints (SSLCommerz).
 *
 * Two payment targets (audit M-H2):
 *  - a BookingIntent — the FIRST deposit on a customer checkout. No booking
 *    exists yet; confirming the payment creates it (BookingService.confirmIntent).
 *    tran_id = `intent:${intentId}:${nonce}`.
 *  - an existing Invoice — a top-up of the remaining balance on a booking that
 *    already exists. tran_id = `inv:${invoiceId}:${nonce}`.
 *
 * The IPN is server-to-server and unauthenticated by cookie — we re-validate
 * every notification against SSLCommerz before trusting it, then route by the
 * tran_id prefix.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type TranTarget =
  | { kind: 'intent'; id: string }
  | { kind: 'invoice'; id: string }
  | null;

@Controller('gateway/sslcommerz')
export class GatewayController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sslcz: SslcommerzService,
    private readonly payments: PaymentsService,
    private readonly booking: BookingService,
    private readonly audit: AuditService,
    private readonly rbac: RbacService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  private tranId(kind: 'intent' | 'invoice', id: string): string {
    const prefix = kind === 'intent' ? 'intent' : 'inv';
    return `${prefix}:${id}:${randomUUID()}`;
  }

  /**
   * Recover the payment target (intent or invoice) from a gateway transaction
   * id. tran_id round-trips through the provider and comes back as
   * attacker-influenceable input, so the extracted id is UUID-validated before
   * any lookup or reflection. Returns null when it doesn't parse.
   *
   * Back-compat: a legacy `${uuid}:${nonce}` (no prefix) is read as an invoice.
   */
  private targetFromTran(tranId: string): TranTarget {
    const parts = tranId.split(':');
    if (parts[0] === 'intent' && UUID_RE.test(parts[1] ?? '')) {
      return { kind: 'intent', id: parts[1] };
    }
    if (parts[0] === 'inv' && UUID_RE.test(parts[1] ?? '')) {
      return { kind: 'invoice', id: parts[1] };
    }
    // Legacy form: bare invoiceId first.
    if (UUID_RE.test(parts[0] ?? '')) return { kind: 'invoice', id: parts[0] };
    return null;
  }

  /** Invoice id for the return-URL redirect (best-effort; '' if not an invoice). */
  private invoiceIdFromTran(tranId: string): string {
    const t = this.targetFromTran(tranId);
    return t?.kind === 'invoice' ? t.id : '';
  }

  /**
   * Resolve + authorize the payment target and its allowed amount.
   *
   * intent: the amount must be at least the intent's minDeposit (the M-H2 floor)
   *         and no more than its full total.
   * invoice: the amount must be within the outstanding balance.
   * Ownership: the caller must be the customer, or hold bookings:edit on the boat.
   */
  private async resolvePayment(
    user: AuthUser,
    dto: InitiatePaymentDto,
  ): Promise<{
    target: { kind: 'intent' | 'invoice'; id: string };
    amount: number;
    houseboatId: string;
    guest?: { name: string | null; phone: string | null } | null;
    customer?: { name: string | null; phone: string | null; email: string | null } | null;
  }> {
    if (!dto.intentId === !dto.invoiceId) {
      throw new BadRequestException('Provide exactly one of intentId or invoiceId');
    }

    if (dto.intentId) {
      const intent = await this.prisma.bookingIntent.findUnique({
        where: { id: dto.intentId },
      });
      if (!intent) throw new NotFoundException('Booking intent not found');
      if (intent.customerId !== user.id) {
        await this.rbac.assert(
          user.id,
          user.isPlatform,
          intent.houseboatId,
          'bookings',
          'edit',
        );
      }
      if (intent.status !== 'requested') {
        throw new BadRequestException('This booking intent is no longer payable');
      }
      if (intent.expiresAt.getTime() <= Date.now()) {
        throw new BadRequestException('This checkout has expired — please re-select');
      }
      // Deposit floor: at least minDeposit, at most the full total.
      const full = money(intent.displayTotal);
      const amount = dto.amount ?? Number(full.toFixed(2));
      if (money(amount).lessThan(money(intent.minDeposit))) {
        throw new BadRequestException(
          `A minimum deposit of ${money(intent.minDeposit).toFixed(0)} is required`,
        );
      }
      if (money(amount).greaterThan(full)) {
        throw new BadRequestException('Payment exceeds the amount due');
      }
      // The intent has no relation to Account; fetch the payer's contact for the
      // hosted-page prefill (the lead guest lives inside the payload).
      const customer = await this.prisma.account.findUnique({
        where: { id: intent.customerId },
        select: { name: true, phone: true, email: true },
      });
      return {
        target: { kind: 'intent', id: intent.id },
        amount,
        houseboatId: intent.houseboatId,
        customer,
      };
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: dto.invoiceId! },
      include: {
        booking: { include: { guests: { take: 1 } } },
        customer: { select: { name: true, phone: true, email: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
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
    return {
      target: { kind: 'invoice', id: invoice.id },
      amount,
      houseboatId: invoice.houseboatId,
      guest: invoice.booking?.guests?.[0] ?? null,
      customer: invoice.customer,
    };
  }

  /**
   * Is the validator-reported amount one this target could legitimately be
   * charged? intent → within [minDeposit, displayTotal]; invoice → positive and
   * no more than the outstanding balance. Missing target → false (nothing to
   * charge). Read-only; the caller decides what to do on false.
   */
  private async reconcileAmount(
    target: { kind: 'intent' | 'invoice'; id: string },
    amount: number,
  ): Promise<boolean> {
    const a = money(amount);
    if (a.lessThanOrEqualTo(0)) return false;
    if (target.kind === 'intent') {
      const intent = await this.prisma.bookingIntent.findUnique({
        where: { id: target.id },
        select: { minDeposit: true, displayTotal: true },
      });
      if (!intent) return false;
      return (
        a.greaterThanOrEqualTo(money(intent.minDeposit)) &&
        a.lessThanOrEqualTo(money(intent.displayTotal))
      );
    }
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: target.id },
      select: { displayTotal: true, amountPaid: true },
    });
    if (!invoice) return false;
    const outstanding = sub(money(invoice.displayTotal), money(invoice.amountPaid));
    // Allow settling up to the outstanding balance. A replayed IPN (already
    // recorded) will have outstanding 0 and fail here, but recordGatewayPayment's
    // unique gatewayToken already makes the replay a no-op, so an exact-replay
    // amount that slightly exceeds a now-zero balance is harmless — still, reject
    // anything over the balance to keep the authorized-amount contract strict.
    return a.lessThanOrEqualTo(outstanding);
  }

  /** Start a hosted payment for an intent or invoice. Returns the URL to open. */
  // Payment initiation is per-account state-changing and hits the gateway API;
  // tighter than the global limit to bound abuse and gateway spend.
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('initiate')
  async initiate(
    @CurrentUser() user: AuthUser,
    @Body() dto: InitiatePaymentDto,
  ) {
    const p = await this.resolvePayment(user, dto);
    const { gatewayPageUrl } = await this.sslcz.initiate({
      invoiceId: p.target.id,
      tranId: this.tranId(p.target.kind, p.target.id),
      amount: p.amount,
      customerName: p.guest?.name ?? p.customer?.name ?? 'Guest',
      customerPhone: p.guest?.phone ?? p.customer?.phone ?? 'N/A',
      customerEmail: p.customer?.email ?? undefined,
    });
    return { gatewayPageUrl };
  }

  /**
   * Settle WITHOUT taking money, so a booking can be confirmed before the
   * gateway is configured. Gated on `gateway.bypass` (PAYMENTS_BYPASS=true), off
   * by default (validate-env fails prod boot if it is set).
   *
   * Routes exactly like the IPN: an intent target creates the booking via
   * confirmIntent (deposit floor enforced there too); an invoice target records
   * the top-up via recordGatewayPayment.
   */
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('dev/settle')
  async devSettle(@CurrentUser() user: AuthUser, @Body() dto: InitiatePaymentDto) {
    if (!this.config.get<boolean>('gateway.bypass')) {
      throw new ForbiddenException('Payment bypass is disabled');
    }
    const p = await this.resolvePayment(user, dto);
    const token = `bypass:${p.target.id}:${randomUUID()}`;

    if (p.target.kind === 'intent') {
      const { invoiceId, alreadyDone } = await this.booking.confirmIntent(
        p.target.id,
        { amount: p.amount, method: 'gateway', gatewayToken: token },
      );
      if (!alreadyDone && invoiceId) {
        await this.sendETicket(invoiceId).catch(() => undefined);
      }
      return { invoiceId };
    }

    const result = await this.payments.recordGatewayPayment({
      invoiceId: p.target.id,
      amount: p.amount,
      gatewayToken: token,
    });
    if (result) {
      await this.sendETicket(p.target.id).catch(() => undefined);
    }
    return { invoiceId: p.target.id };
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

    const target = this.targetFromTran(validated.tranId);
    if (!target) {
      // Unparseable tran_id — ack so the gateway stops retrying; nothing to book.
      return { ok: false };
    }

    // Reconcile the amount the validator reports against what THIS target could
    // legitimately be charged (intent: [minDeposit, displayTotal]; invoice: within
    // the outstanding balance). The provider's amount is otherwise trusted
    // wholesale — this refuses a settlement whose amount we never authorized for
    // this tran_id. Downstream (confirmIntent floor, recordGatewayPayment overpay
    // cap) still applies; this is the missing upper/authorized-amount gate. On
    // mismatch we log and ack (never throw — a non-2xx makes the gateway retry
    // forever) so it surfaces for manual reconciliation instead of recording.
    //
    // A REPLAY (the gateway re-posts an already-recorded payment — normal) must
    // skip this: the balance is already drawn down, so the outstanding-band check
    // would false-positive. The payment is keyed by the unique val_id; if one
    // already exists this is a replay → fall through to the idempotent record
    // path (which returns the existing booking / no-ops) instead of reconciling.
    const alreadyRecorded = await this.prisma.invoicePayment.findFirst({
      where: { gatewayToken: validated.valId },
      select: { id: true },
    });
    const ok =
      !!alreadyRecorded || (await this.reconcileAmount(target, validated.amount));
    if (!ok) {
      await this.audit
        .log({
          action: 'gateway_amount_mismatch',
          entityType: target.kind === 'intent' ? 'booking_intent' : 'invoice',
          entityId: target.id,
          after: {
            reportedAmount: money(validated.amount).toFixed(2),
            valId: validated.valId,
          },
        })
        .catch(() => undefined);
      return { ok: false };
    }

    // Intent target: this is a first deposit → create the booking. confirmIntent
    // is idempotent (a replayed IPN returns the existing booking, no double
    // create) and enforces the deposit floor itself, so a tampered low amount is
    // refused here too. gatewayToken (val_id) is unique-indexed on the payment.
    if (target.kind === 'intent') {
      const { invoiceId, alreadyDone } = await this.booking.confirmIntent(
        target.id,
        {
          amount: validated.amount,
          method: 'gateway',
          gatewayToken: validated.valId,
        },
      );
      if (!alreadyDone && invoiceId) {
        await this.sendETicket(invoiceId).catch(() => undefined);
      }
      return { ok: true };
    }

    // Invoice target: top-up of an existing booking's balance.
    const result = await this.payments.recordGatewayPayment({
      invoiceId: target.id,
      amount: validated.amount,
      gatewayToken: validated.valId,
    });
    // result is null on a replayed IPN — only send the e-ticket on the first
    // successful confirmation.
    if (result) {
      await this.sendETicket(target.id).catch(() => undefined);
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
