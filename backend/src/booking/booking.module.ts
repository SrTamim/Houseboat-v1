import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { OwnerBookingsController } from './owner-bookings.controller';
import { HoldsService } from './holds.service';
import { HoldSweeperService } from './hold-sweeper.service';
import { BookingService } from './booking.service';
import { WaitlistService } from './waitlist.service';
import { OwnerBookingsService } from './owner-bookings.service';
import { PricingModule } from '../pricing/pricing.module';
import { MoneyModule } from '../money/money.module';

@Module({
  imports: [PricingModule, MoneyModule],
  controllers: [BookingController, OwnerBookingsController],
  providers: [
    HoldsService,
    HoldSweeperService,
    BookingService,
    WaitlistService,
    OwnerBookingsService,
  ],
  exports: [HoldsService, BookingService, OwnerBookingsService],
})
export class BookingModule {}
