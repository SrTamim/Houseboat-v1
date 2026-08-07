import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OwnerBookingsService } from './owner-bookings.service';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CurrentUser } from '../auth/decorators';
import { AuthUser } from '../auth/auth.types';
import {
  CheckinDto,
  OwnerBookingsQueryDto,
  PosCheckoutDto,
  PosQuoteDto,
} from './dto/owner-bookings.dto';

/**
 * Owner-side bookings: every booking on a boat you operate, the waitlist for
 * its departures, and counter sales.
 *
 * Separate from BookingController because that one is customer-scoped ("my
 * bookings") and unguarded by boat permissions; everything here is gated on
 * the caller's membership of :houseboatId.
 */
@Controller('houseboats/:houseboatId')
export class OwnerBookingsController {
  constructor(private readonly bookings: OwnerBookingsService) {}

  @Get('bookings')
  @RequirePermission({ module: 'bookings', action: 'view' })
  list(
    @Param('houseboatId') houseboatId: string,
    @Query() query: OwnerBookingsQueryDto,
  ) {
    return this.bookings.list(houseboatId, query);
  }

  @Get('bookings/counts')
  @RequirePermission({ module: 'bookings', action: 'view' })
  counts(@Param('houseboatId') houseboatId: string) {
    return this.bookings.statusCounts(houseboatId);
  }

  /** Mark departure attendance for one booking from the manifest (§4). */
  @Patch('bookings/:bookingId/checkin')
  @RequirePermission({ module: 'bookings', action: 'edit' })
  setCheckin(
    @Param('houseboatId') houseboatId: string,
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CheckinDto,
  ) {
    return this.bookings.setCheckin(houseboatId, bookingId, user.id, dto.status);
  }

  @Get('waitlist')
  @RequirePermission({ module: 'bookings', action: 'view' })
  waitlist(@Param('houseboatId') houseboatId: string) {
    return this.bookings.waitlist(houseboatId);
  }

  @Post('waitlist/:departureId/notify')
  @RequirePermission({ module: 'bookings', action: 'edit' })
  notifyWaitlist(
    @Param('houseboatId') houseboatId: string,
    @Param('departureId') departureId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookings.notifyWaitlist(houseboatId, departureId, user.id);
  }

  /** Live holds on a departure (anyone's), so the counter grid can lock them. */
  @Get('departures/:departureId/holds')
  @RequirePermission({ module: 'bookings', action: 'edit' })
  departureHolds(
    @Param('houseboatId') houseboatId: string,
    @Param('departureId') departureId: string,
  ) {
    return this.bookings.departureHolds(houseboatId, departureId);
  }

  /** Read-only price preview for a counter-sale selection. Creates nothing. */
  @Post('pos/quote')
  @RequirePermission({ module: 'bookings', action: 'edit' })
  posQuote(
    @Param('houseboatId') houseboatId: string,
    @Body() dto: PosQuoteDto,
  ) {
    return this.bookings.posQuote(houseboatId, dto);
  }

  /**
   * Counter sale. Throttled harder than ordinary reads: it creates accounts
   * and takes holds, so a runaway client here consumes cabin inventory.
   */
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('pos/bookings')
  @RequirePermission({ module: 'bookings', action: 'edit' })
  posCheckout(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: PosCheckoutDto,
  ) {
    return this.bookings.posCheckout(houseboatId, user.id, dto);
  }
}
