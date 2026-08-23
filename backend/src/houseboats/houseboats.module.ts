import { Module } from '@nestjs/common';
import { HouseboatsController } from './houseboats.controller';
import { HouseboatsService } from './houseboats.service';
import { PricingModule } from '../pricing/pricing.module';
import { StorageService } from '../storage/storage.service';

@Module({
  imports: [PricingModule],
  controllers: [HouseboatsController],
  // StorageService is provided directly rather than via a shared module — the
  // same pattern MediaModule uses. Boat detail needs it to turn media storage
  // keys into public URLs (root-relative under the local dev driver).
  providers: [HouseboatsService, StorageService],
})
export class HouseboatsModule {}
