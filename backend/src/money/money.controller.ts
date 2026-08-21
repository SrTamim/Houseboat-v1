import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { RefundsService } from './refunds.service';
import { PayoutsService } from './payouts.service';
import { CouponsService } from './coupons.service';
import { FinanceService } from './finance.service';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CurrentUser, PlatformOnly } from '../auth/decorators';
import { AuthUser } from '../auth/auth.types';
import {
  RecordPaymentDto,
  RefundRequestDto,
  CreateCouponDto,
  SetCouponActiveDto,
  CreatePolicyDto,
  RecordDistributionDto,
  IssueSubscriptionDto,
  SuggestSplitQueryDto,
  OwnerInvoicesQueryDto,
} from './dto/money.dto';

/**
 * Tighter than the global 120/min. These routes move money — recording
 * payments, issuing refunds, releasing payouts — so they get a lower ceiling
 * than ordinary reads. Applied at the class level so routes added later
 * inherit it rather than being forgotten.
 *
 * AccountThrottlerGuard keys authenticated requests per account, so one
 * compromised session can't exhaust the limit for everyone.
 */
@Throttle({ default: { ttl: 60_000, limit: 40 } })
@Controller()
export class MoneyController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly refunds: RefundsService,
    private readonly payouts: PayoutsService,
    private readonly coupons: CouponsService,
    private readonly finance: FinanceService,
  ) {}

  // ── Payments ───────────────────────────────────────────────
  @Post('invoices/:invoiceId/payments')
  recordPayment(
    @Param('invoiceId') invoiceId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.payments.recordPayment(invoiceId, user.id, user.isPlatform, dto);
  }

  @Post('invoices/:invoiceId/verify')
  verifyPayment(
    @Param('invoiceId') invoiceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.verifyPayment(invoiceId, user.id, user.isPlatform);
  }

  @Get('invoices/:invoiceId/payments')
  listPayments(
    @Param('invoiceId') invoiceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.listPayments(invoiceId, user.id, user.isPlatform);
  }

  /**
   * The boat's booking invoices (owner console). Read-only. Consumed by the
   * bookings and refunds page detail drawers, so either role may read it.
   */
  @Get('houseboats/:houseboatId/invoices')
  @RequirePermission({ module: 'bookings', action: 'view', anyOf: ['refunds'] })
  listInvoices(
    @Param('houseboatId') houseboatId: string,
    @Query() query: OwnerInvoicesQueryDto,
  ) {
    return this.payments.listForBoat(houseboatId, query);
  }

  // ── Refunds (owner-cancel path; separation of duties enforced) ─

  /** Refunds raised against this boat's invoices, for the owner's queue. */
  @Get('houseboats/:houseboatId/refunds')
  @RequirePermission({ module: 'refunds', action: 'view' })
  listRefunds(@Param('houseboatId') houseboatId: string) {
    return this.refunds.listForBoat(houseboatId);
  }

  @Post('invoices/:invoiceId/refunds')
  requestRefund(
    @Param('invoiceId') invoiceId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: RefundRequestDto,
  ) {
    return this.refunds.request(invoiceId, user.id, user.isPlatform, dto);
  }

  @Post('refunds/:refundId/verify')
  verifyRefund(
    @Param('refundId') refundId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.refunds.verify(refundId, user.id, user.isPlatform);
  }

  @Post('refunds/:refundId/complete')
  completeRefund(
    @Param('refundId') refundId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.refunds.complete(refundId, user.id, user.isPlatform);
  }

  /** POS one-step settle — owner marks a counter-sale refund as refunded. */
  @Post('refunds/:refundId/settle-pos')
  settlePosRefund(
    @Param('refundId') refundId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.refunds.settlePos(refundId, user.id, user.isPlatform);
  }

  // ── Settlement / payouts (platform finance) ────────────────
  @PlatformOnly()
  @Get('houseboats/:houseboatId/due-payments')
  duePayments(@Param('houseboatId') houseboatId: string) {
    return this.payouts.duePayments(houseboatId);
  }

  /**
   * Payout history, owner-readable. Preparing/approving/paying stay
   * platform-only above — an owner sees what they were paid, they don't move it.
   */
  @Get('houseboats/:houseboatId/payout-batches')
  @RequirePermission({ module: 'payouts', action: 'view' })
  listPayoutBatches(@Param('houseboatId') houseboatId: string) {
    return this.payouts.listForBoat(houseboatId);
  }

  @PlatformOnly()
  @Post('houseboats/:houseboatId/payout-batches')
  prepareBatch(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payouts.prepareBatch(houseboatId, user.id);
  }

  @PlatformOnly()
  @Post('payout-batches/:batchId/approve')
  approveBatch(
    @Param('batchId') batchId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payouts.approveBatch(batchId, user.id);
  }

  @PlatformOnly()
  @Post('payout-batches/:batchId/pay')
  payBatch(@Param('batchId') batchId: string, @CurrentUser() user: AuthUser) {
    return this.payouts.markPaid(batchId, user.id);
  }

  // ── Coupons + policies (owner money settings) ──────────────
  @Get('houseboats/:houseboatId/coupons')
  @RequirePermission({ module: 'coupons', action: 'view' })
  listCoupons(@Param('houseboatId') houseboatId: string) {
    return this.coupons.listCoupons(houseboatId);
  }

  @Post('houseboats/:houseboatId/coupons')
  @RequirePermission({ module: 'coupons', action: 'edit' })
  createCoupon(
    @CurrentUser() user: AuthUser,
    @Param('houseboatId') houseboatId: string,
    @Body() dto: CreateCouponDto,
  ) {
    return this.coupons.createCoupon(houseboatId, dto, user.id);
  }

  @Patch('houseboats/:houseboatId/coupons/:couponId/active')
  @RequirePermission({ module: 'coupons', action: 'edit' })
  setCouponActive(
    @CurrentUser() user: AuthUser,
    @Param('houseboatId') houseboatId: string,
    @Param('couponId') couponId: string,
    @Body() dto: SetCouponActiveDto,
  ) {
    return this.coupons.setCouponActive(houseboatId, couponId, dto.active, user.id);
  }

  @Get('houseboats/:houseboatId/cancellation-policies')
  @RequirePermission({ module: 'coupons', action: 'view' })
  listPolicies(@Param('houseboatId') houseboatId: string) {
    return this.coupons.listPolicies(houseboatId);
  }

  @Post('houseboats/:houseboatId/cancellation-policies')
  @RequirePermission({ module: 'coupons', action: 'edit' })
  createPolicy(
    @Param('houseboatId') houseboatId: string,
    @Body() dto: CreatePolicyDto,
  ) {
    return this.coupons.createPolicy(houseboatId, dto);
  }

  // ── Owner distributions (shareholder payouts ledger) ───────
  @Get('houseboats/:houseboatId/distributions')
  @RequirePermission({ module: 'earnings', action: 'view' })
  listDistributions(@Param('houseboatId') houseboatId: string) {
    return this.finance.listDistributions(houseboatId);
  }

  @Get('houseboats/:houseboatId/distributions/suggest')
  @RequirePermission({ module: 'earnings', action: 'view' })
  suggestSplit(
    @Param('houseboatId') houseboatId: string,
    @Query() query: SuggestSplitQueryDto,
  ) {
    return this.finance.suggestSplit(houseboatId, query.amount);
  }

  @Post('houseboats/:houseboatId/distributions')
  @RequirePermission({ module: 'earnings', action: 'edit' })
  recordDistribution(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: RecordDistributionDto,
  ) {
    return this.finance.recordDistribution(houseboatId, user.id, dto);
  }

  // ── Platform subscription billing (platform finance) ───────
  /** Owner-visible billing status: in grace / days left / locked / amount due.
   *  Accessible even when locked — the owner must be able to see the bill. */
  @Get('houseboats/:houseboatId/billing-status')
  @RequirePermission({
    module: 'billing',
    action: 'view',
    anyOf: ['settings'],
    allowWhenLocked: true,
  })
  billingStatus(@Param('houseboatId') houseboatId: string) {
    return this.finance.billingStatus(houseboatId);
  }

  /** Owner-visible list of their subscription invoices (to see what to pay).
   *  Accessible even when locked. */
  @Get('houseboats/:houseboatId/my-subscription-invoices')
  @RequirePermission({ module: 'billing', action: 'view', allowWhenLocked: true })
  ownerSubscriptionInvoices(@Param('houseboatId') houseboatId: string) {
    return this.finance.listSubscriptionInvoices(houseboatId);
  }

  @PlatformOnly()
  @Get('houseboats/:houseboatId/subscription-invoices')
  listSubscriptionInvoices(@Param('houseboatId') houseboatId: string) {
    return this.finance.listSubscriptionInvoices(houseboatId);
  }

  @PlatformOnly()
  @Post('houseboats/:houseboatId/subscription-invoices')
  issueSubscription(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: IssueSubscriptionDto,
  ) {
    return this.finance.issueSubscriptionInvoice(houseboatId, user.id, dto.period);
  }

  @PlatformOnly()
  @Post('subscription-invoices/:invoiceId/pay')
  paySubscription(
    @Param('invoiceId') invoiceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.finance.paySubscriptionInvoice(invoiceId, user.id);
  }
}
