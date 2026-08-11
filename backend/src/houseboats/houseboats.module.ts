import { Module } from '@nestjs/common';
import { HouseboatsController } from './houseboats.controller';
import { HouseboatsService } from './houseboats.service';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [PricingModule],
  controllers: [HouseboatsController],
  providers: [HouseboatsService],
})
export class HouseboatsModule {}
