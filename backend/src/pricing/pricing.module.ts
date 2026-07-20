import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';

/** Pricing is a shared service used by trips, booking, and money. */
@Module({
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
