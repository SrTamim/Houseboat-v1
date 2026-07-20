import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { HoldsService } from './holds.service';
import { BookingService } from './booking.service';
import { WaitlistService } from './waitlist.service';
import { CurrentUser } from '../auth/decorators';
import { AuthUser } from '../auth/auth.types';
import {
  HoldCabinDto,
  CheckoutDto,
  WaitlistDto,
  RescheduleDto,
  JoinOpenSeatDto,
  GroupCheckoutDto,
} from './dto/booking.dto';

/**
 * Customer-facing booking flow. All routes require auth (a logged-in customer);
 * holds are taken under the caller's account so first-to-hold is enforced.
 */
@Controller('booking')
export class BookingController {
  constructor(
    private readonly holds: HoldsService,
    private readonly booking: BookingService,
    private readonly waitlist: WaitlistService,
  ) {}

  /** Take a hold on one cabin. Returns server-authoritative expires_at. */
  @Post('hold')
  hold(@CurrentUser() user: AuthUser, @Body() dto: HoldCabinDto) {
    return this.holds.hold(dto.cabinId, dto.departureId, user.id);
  }

  @Post('hold/:holdId/release')
  release(@Param('holdId') holdId: string) {
    return this.holds.release(holdId).then(() => ({ ok: true }));
  }

  @Get('departures/:departureId/my-holds')
  myHolds(
    @Param('departureId') departureId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.holds.listActive(departureId, user.id);
  }

  /** Convert holds → confirmed booking + invoice. Instant confirmation. */
  @Post('checkout')
  checkout(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    // Customer books for themselves here; POS mode would pass a different customerId.
    return this.booking.checkout(user.id, user.id, dto);
  }

  /** Full-boat group buyout: pick a band + headcount, one total, one payer. */
  @Post('group-checkout')
  groupCheckout(@CurrentUser() user: AuthUser, @Body() dto: GroupCheckoutDto) {
    return this.booking.groupCheckout(user.id, user.id, dto);
  }

  @Get(':bookingId')
  get(@Param('bookingId') bookingId: string) {
    return this.booking.get(bookingId);
  }

  @Get()
  myBookings(@CurrentUser() user: AuthUser) {
    return this.booking.listForCustomer(user.id);
  }

  @Post('waitlist')
  joinWaitlist(@CurrentUser() user: AuthUser, @Body() dto: WaitlistDto) {
    return this.waitlist.join(dto.departureId, user.id, dto.partySize);
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
