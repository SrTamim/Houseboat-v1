import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { OpsService } from './ops.service';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CurrentUser, Public } from '../auth/decorators';
import { AuthUser } from '../auth/auth.types';
import {
  CreateCostDto,
  CreateInventoryItemDto,
  StockMovementDto,
  CreateReviewDto,
} from './dto/ops.dto';

@Controller()
export class OpsController {
  constructor(private readonly ops: OpsService) {}

  // ── Costs ──────────────────────────────────────────────────
  @Get('houseboats/:houseboatId/costs')
  @RequirePermission({ module: 'costs', action: 'view' })
  listCosts(@Param('houseboatId') houseboatId: string) {
    return this.ops.listCosts(houseboatId);
  }

  @Post('houseboats/:houseboatId/costs')
  @RequirePermission({ module: 'costs', action: 'edit' })
  addCost(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCostDto,
  ) {
    return this.ops.addCost(houseboatId, user.id, dto);
  }

  // ── Inventory ──────────────────────────────────────────────
  @Get('houseboats/:houseboatId/inventory')
  @RequirePermission({ module: 'inventory', action: 'view' })
  listItems(@Param('houseboatId') houseboatId: string) {
    return this.ops.listItems(houseboatId);
  }

  @Post('houseboats/:houseboatId/inventory')
  @RequirePermission({ module: 'inventory', action: 'edit' })
  addItem(
    @Param('houseboatId') houseboatId: string,
    @Body() dto: CreateInventoryItemDto,
  ) {
    return this.ops.addItem(houseboatId, dto);
  }

  @Post('houseboats/:houseboatId/inventory/:itemId/movements')
  @RequirePermission({ module: 'inventory', action: 'edit' })
  recordMovement(
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: StockMovementDto,
  ) {
    return this.ops.recordMovement(itemId, user.id, dto);
  }

  // ── Reviews ────────────────────────────────────────────────
  @Public()
  @Get('houseboats/:houseboatId/reviews')
  listReviews(@Param('houseboatId') houseboatId: string) {
    return this.ops.listReviews(houseboatId);
  }

  @Post('bookings/:bookingId/review')
  addReview(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateReviewDto,
  ) {
    return this.ops.addReview(bookingId, user.id, dto);
  }

  @Post('reviews/:reviewId/reply')
  @RequirePermission({
    module: 'settings',
    action: 'edit',
    boatIdFrom: 'body',
    boatIdKey: 'houseboatId',
  })
  replyReview(
    @Param('reviewId') reviewId: string,
    @Body('reply') reply: string,
  ) {
    return this.ops.replyToReview(reviewId, reply);
  }

  // ── Notifications ──────────────────────────────────────────
  @Get('me/notifications')
  myNotifications(@CurrentUser() user: AuthUser) {
    return this.ops.listNotifications(user.id);
  }
}
