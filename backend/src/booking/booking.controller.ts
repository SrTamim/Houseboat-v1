import {
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { HoldsService } from './holds.service';
import { MAX_CABINS_PER_BOOKING } from './booking.limits';
import { ensureGuestToken, readGuestToken } from './guest-token';
import { BookingService } from './booking.service';
import { WaitlistService } from './waitlist.service';
import { CurrentUser, Public } from '../auth/decorators';
import { AuthUser } from '../auth/auth.types';
import {
  HoldCabinDto,
  CheckoutDto,
  WaitlistDto,
  RescheduleDto,
  JoinOpenSeatDto,
  GroupCheckoutDto,
  QuoteDto,
} from './dto/booking.dto';

/**
 * Customer-facing booking flow.
 *
 * Most routes require auth. The exceptions are the price preview and the hold
 * routes: the boat page lets a signed-out visitor lock a cabin before the
 * login-at-checkout wall, so those holds are owned by a per-browser token
 * (hb_gid) and claimed onto the account at login. First-to-hold is still
 * enforced by the DB, which does not care who the owner is.
 */
@Controller('booking')
export class BookingController {
  constructor(
    private readonly holds: HoldsService,
    private readonly booking: BookingService,
    private readonly waitlist: WaitlistService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Public, hold-free price preview. The boat page calls this on the current
   * cabin selection to show a server-authoritative total (client never computes
   * prices). Anonymous users can price before the login-at-checkout wall.
   */
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Post('quote')
  quote(@Body() dto: QuoteDto) {
    return this.booking.quote({
      departureId: dto.departureId,
      cabins: dto.cabins.map((c) => ({
        cabinId: c.cabinId,
        adults: c.adults,
        children: c.children,
        childAges: c.childAges,
        openSeat: c.openSeat,
      })),
      couponCode: dto.couponCode,
    });
  }

  /** Take a hold on one cabin. Returns server-authoritative expires_at. */
  // Tighter than the global 120/min: holds lock availability, so a flood is a
  // denial-of-availability vector. Per-cabin Redis cap (5/10s) also applies.
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post('hold')
  hold(
    @CurrentUser() user: AuthUser | undefined,
    @Body() dto: HoldCabinDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Signed in → the hold belongs to the account, exactly as before. Signed out
    // → it belongs to this browser, and is claimed onto the account at login.
    // Either way this is a self-service booking, so the per-booking cabin cap
    // applies (owner POS calls HoldsService directly and stays uncapped).
    if (user) {
      return this.holds.hold(
        dto.cabinId,
        dto.departureId,
        user.id,
        null,
        MAX_CABINS_PER_BOOKING,
      );
    }
    const secure = this.config.get<boolean>('auth.cookieSecure') ?? false;
    const token = ensureGuestToken(req, res, secure);
    return this.holds.hold(
      dto.cabinId,
      dto.departureId,
      null,
      token,
      MAX_CABINS_PER_BOOKING,
    );
  }

  @Public()
  @Post('hold/:holdId/release')
  release(
    @Param('holdId') holdId: string,
    @CurrentUser() user: AuthUser | undefined,
    @Req() req: Request,
  ) {
    return this.holds
      .release(
        holdId,
        user?.id ?? null,
        user?.isPlatform ?? false,
        readGuestToken(req),
      )
      .then(() => ({ ok: true }));
  }

  /**
   * Grant the one checkout extension (+10 min on the time REMAINING) for this
   * caller's cart. Called when the checkout page opens so a guest filling in
   * the form does not lose their cabins mid-typing.
   *
   * Public for the same reason the hold routes are: the guest holds cabins
   * before the login-at-checkout wall. Ownership is not checked separately —
   * the service scopes by account or hb_gid, so a caller can only ever extend
   * their own holds. Idempotent: a reload gets the unchanged expiry back.
   */
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post('departures/:departureId/extend-holds')
  extendHolds(
    @Param('departureId') departureId: string,
    @CurrentUser() user: AuthUser | undefined,
    @Req() req: Request,
  ) {
    if (user) return this.holds.extendForCheckout(departureId, user.id);
    const token = readGuestToken(req);
    // No cookie yet → this browser cannot own any hold to extend.
    if (!token) throw new ConflictException('Your cabin hold has expired');
    return this.holds.extendForCheckout(departureId, null, token);
  }

  /**
   * "This page is still open" — keeps the caller's holds from being reclaimed.
   *
   * Sent every ~30s by whichever page holds cabins. When it stops (tab closed,
   * browser quit, laptop shut), the sweeper frees those cabins after
   * HOLD_GRACE_MIN instead of leaving them locked for the whole TTL. Unload
   * events could not do this job: mobile browsers skip pagehide, and sendBeacon
   * cannot send the CSRF header.
   *
   * Public like the other hold routes (a signed-out visitor holds via hb_gid),
   * and never extends the deadline — see HoldsService.touchHolds.
   */
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post('departures/:departureId/heartbeat')
  heartbeat(
    @Param('departureId') departureId: string,
    @CurrentUser() user: AuthUser | undefined,
    @Req() req: Request,
  ) {
    if (user) return this.holds.touchHolds(departureId, user.id);
    const token = readGuestToken(req);
    // No cookie → this browser owns no hold, so there is nothing to keep alive.
    if (!token) return { ok: false, expiresAt: null };
    return this.holds.touchHolds(departureId, null, token);
  }

  @Public()
  @Get('departures/:departureId/my-holds')
  myHolds(
    @Param('departureId') departureId: string,
    @CurrentUser() user: AuthUser | undefined,
    @Req() req: Request,
  ) {
    if (user) return this.holds.listActive(departureId, user.id);
    const token = readGuestToken(req);
    // No cookie yet → this browser cannot own any hold.
    if (!token) return [];
    return this.holds.listActive(departureId, null, token);
  }

  /** Convert holds → confirmed booking + invoice. Instant confirmation. */
  @Throttle({ default: { ttl: 60_000, limit: 15 } })
  @Post('checkout')
  checkout(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    // Customer books for themselves here; POS mode would pass a different customerId.
    // 'web' channel → platform earns commission (owner POS passes 'pos').
    return this.booking.checkout(user.id, user.id, dto, { channel: 'web' });
  }

  /** Full-boat group buyout: pick a band + headcount, one total, one payer. */
  @Throttle({ default: { ttl: 60_000, limit: 15 } })
  @Post('group-checkout')
  groupCheckout(@CurrentUser() user: AuthUser, @Body() dto: GroupCheckoutDto) {
    return this.booking.groupCheckout(user.id, user.id, dto);
  }

  // Static GET paths MUST be declared before the ':bookingId' catch-all, or
  // "/booking/waitlist" would be read as a bookingId.
  @Get('waitlist')
  myWaitlist(@CurrentUser() user: AuthUser) {
    return this.waitlist.listForCustomer(user.id);
  }

  @Get(':bookingId')
  get(@Param('bookingId') bookingId: string, @CurrentUser() user: AuthUser) {
    return this.booking.get(bookingId, user.id, user.isPlatform);
  }

  @Get()
  myBookings(@CurrentUser() user: AuthUser) {
    return this.booking.listForCustomer(user.id);
  }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('waitlist')
  joinWaitlist(@CurrentUser() user: AuthUser, @Body() dto: WaitlistDto) {
    return this.waitlist.join(
      dto.departureId,
      user.id,
      dto.partySize,
      dto.cabinId,
    );
  }

  @Post('waitlist/:id/leave')
  leaveWaitlist(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.waitlist.leave(id, user.id);
  }

  /** Book a spare place on an open-seat cabin (Path §3). Drops the first booker's bill. */
  @Post('open-seat/join')
  joinOpenSeat(@CurrentUser() user: AuthUser, @Body() dto: JoinOpenSeatDto) {
    return this.booking.joinOpenSeat(
      dto.openSeatCabinId,
      user.id,
      dto.adults,
      dto.children ?? 0,
    );
  }

  /** Cancel a booking (Path B). Frees cabins, computes policy refund, notifies waitlist. */
  @Post(':bookingId/cancel')
  cancel(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.booking.cancel(bookingId, user.id, user.isPlatform);
  }

  /** Reschedule a booking to another departure (owner-side; reprices). */
  @Post(':bookingId/reschedule')
  reschedule(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: RescheduleDto,
  ) {
    return this.booking.reschedule(
      bookingId,
      user.id,
      user.isPlatform,
      dto.newDepartureId,
      dto.reason,
    );
  }
}
