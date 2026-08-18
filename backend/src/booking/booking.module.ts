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
import { StorageService } from '../storage/storage.service';

@Module({
  imports: [PricingModule, MoneyModule],
  controllers: [BookingController, OwnerBookingsController],
  // StorageService is provided directly rather than via a shared module — the
  // same pattern HouseboatsModule and MediaModule use. Booking detail needs it
  // to turn the boat's logo storage key into a public URL for the invoice.
  providers: [
    HoldsService,
    HoldSweeperService,
    BookingService,
    WaitlistService,
    OwnerBookingsService,
    StorageService,
  ],
  exports: [HoldsService, BookingService, OwnerBookingsService],
})
export class BookingModule {}
