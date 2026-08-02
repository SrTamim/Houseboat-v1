import { Module } from '@nestjs/common';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { DepartureStatusService } from './departure-status.service';
import { ScheduleGeneratorService } from './schedule-generator.service';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [PricingModule],
  controllers: [TripsController],
  providers: [TripsService, DepartureStatusService, ScheduleGeneratorService],
  exports: [TripsService],
})
export class TripsModule {}
