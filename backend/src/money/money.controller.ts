import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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
  CreatePolicyDto,
  RecordDistributionDto,
  IssueSubscriptionDto,
} from './dto/money.dto';

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

  // ── Refunds (owner-cancel path; separation of duties enforced) ─
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

  // ── Settlement / payouts (platform finance) ────────────────
  @PlatformOnly()
  @Get('houseboats/:houseboatId/due-payments')
  duePayments(@Param('houseboatId') houseboatId: string) {
    return this.payouts.duePayments(houseboatId);
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
  @RequirePermission({ module: 'money', action: 'view' })
  listCoupons(@Param('houseboatId') houseboatId: string) {
    return this.coupons.listCoupons(houseboatId);
  }

  @Post('houseboats/:houseboatId/coupons')
  @RequirePermission({ module: 'money', action: 'edit' })
  createCoupon(
    @Param('houseboatId') houseboatId: string,
    @Body() dto: CreateCouponDto,
  ) {
    return this.coupons.createCoupon(houseboatId, dto);
  }

  @Get('houseboats/:houseboatId/cancellation-policies')
  @RequirePermission({ module: 'money', action: 'view' })
  listPolicies(@Param('houseboatId') houseboatId: string) {
    return this.coupons.listPolicies(houseboatId);
  }

  @Post('houseboats/:houseboatId/cancellation-policies')
  @RequirePermission({ module: 'money', action: 'edit' })
  createPolicy(
    @Param('houseboatId') houseboatId: string,
    @Body() dto: CreatePolicyDto,
  ) {
    return this.coupons.createPolicy(houseboatId, dto);
  }

  // ── Owner distributions (shareholder payouts ledger) ───────
  @Get('houseboats/:houseboatId/distributions')
  @RequirePermission({ module: 'money', action: 'view' })
  listDistributions(@Param('houseboatId') houseboatId: string) {
    return this.finance.listDistributions(houseboatId);
  }

  @Get('houseboats/:houseboatId/distributions/suggest')
  @RequirePermission({ module: 'money', action: 'view' })
  suggestSplit(
    @Param('houseboatId') houseboatId: string,
    @Query('amount') amount: string,
  ) {
    return this.finance.suggestSplit(houseboatId, Number(amount));
  }

  @Post('houseboats/:houseboatId/distributions')
  @RequirePermission({ module: 'money', action: 'edit' })
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
  @RequirePermission({ module: 'money', action: 'view', allowWhenLocked: true })
  billingStatus(@Param('houseboatId') houseboatId: string) {
    return this.finance.billingStatus(houseboatId);
  }

  /** Owner-visible list of their subscription invoices (to see what to pay).
   *  Accessible even when locked. */
  @Get('houseboats/:houseboatId/my-subscription-invoices')
  @RequirePermission({ module: 'money', action: 'view', allowWhenLocked: true })
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
