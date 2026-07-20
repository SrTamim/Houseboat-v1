import { Module } from '@nestjs/common';
import { HouseboatsController } from './houseboats.controller';
import { HouseboatsService } from './houseboats.service';

@Module({
  controllers: [HouseboatsController],
  providers: [HouseboatsService],
})
export class HouseboatsModule {}
