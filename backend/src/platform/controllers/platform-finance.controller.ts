import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser, PlatformOnly } from '../../auth/decorators';
import { AuthUser } from '../../auth/auth.types';
import { PlatformPermission } from '../rbac/platform-permission.decorator';
import { PlatformFinanceService } from '../services/platform-finance.service';
import {
  ListCashoutsQueryDto,
  ListCouponsQueryDto,
  ListCreditsQueryDto,
  ListInvoicesQueryDto,
  ListPayoutBatchesQueryDto,
  ListRefundsQueryDto,
  ListSubscriptionInvoicesQueryDto,
  UpsertBillingConfigDto,
} from '../dto/platform.dto';

/**
 * Cross-boat finance surface.
 *
 * @PlatformOnly() is applied at the CLASS level on purpose: these routes carry
 * no :houseboatId, so PermissionGuard cannot scope them and RbacService.assert
 * short-circuits for platform users. One decorator here guards every route in
 * the file — per-route decorators invite a forgotten one, which would silently
 * expose every boat's finances to any authenticated customer.
 */
@PlatformOnly()
@PlatformPermission('finance', 'view')
@Controller('platform/finance')
export class PlatformFinanceController {
  constructor(private readonly finance: PlatformFinanceService) {}

  @Get('payout-batches')
  listPayoutBatches(@Query() query: ListPayoutBatchesQueryDto) {
    return this.finance.listPayoutBatches(query);
  }

  @Get('invoices')
  listInvoices(@Query() query: ListInvoicesQueryDto) {
    return this.finance.listInvoices(query);
  }

  @Get('refunds')
  listRefunds(@Query() query: ListRefundsQueryDto) {
    return this.finance.listRefunds(query);
  }

  @Get('overpayments')
  listOverpayments(@Query() query: ListInvoicesQueryDto) {
    return this.finance.listOverpayments(query);
  }

  @Get('credits')
  listCredits(@Query() query: ListCreditsQueryDto) {
    return this.finance.listCredits(query);
  }

  @Get('cashouts')
  listCashouts(@Query() query: ListCashoutsQueryDto) {
    return this.finance.listCashouts(query);
  }

  @PlatformPermission('finance', 'edit')
  @Post('cashouts/:id/approve')
  approveCashout(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.finance.approveCashout(id, user.id);
  }

  @PlatformPermission('finance', 'edit')
  @Post('cashouts/:id/reject')
  rejectCashout(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.finance.rejectCashout(id, user.id);
  }

  @Get('subscription-invoices')
  listSubscriptionInvoices(@Query() query: ListSubscriptionInvoicesQueryDto) {
    return this.finance.listSubscriptionInvoices(query);
  }

  @Get('billing-configs')
  listBillingConfigs() {
    return this.finance.listBillingConfigs();
  }

  @PlatformPermission('finance', 'edit')
  @Put('billing-configs/:houseboatId')
  upsertBillingConfig(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertBillingConfigDto,
  ) {
    return this.finance.upsertBillingConfig(houseboatId, dto, user.id);
  }

  @Get('debtors')
  listDebtors() {
    return this.finance.listDebtors();
  }

  @Get('coupons')
  listCoupons(@Query() query: ListCouponsQueryDto) {
    return this.finance.listCoupons(query);
  }

  @Get('analytics')
  analyticsSummary() {
    return this.finance.analyticsSummary();
  }
}
