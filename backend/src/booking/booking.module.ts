import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { HoldsService } from './holds.service';
import { HoldSweeperService } from './hold-sweeper.service';
import { BookingService } from './booking.service';
import { WaitlistService } from './waitlist.service';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [PricingModule],
  controllers: [BookingController],
  providers: [
    HoldsService,
    HoldSweeperService,
    BookingService,
    WaitlistService,
  ],
  exports: [HoldsService, BookingService],
})
export class BookingModule {}
