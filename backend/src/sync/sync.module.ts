import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { OpsModule } from '../ops/ops.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { BookingModule } from '../booking/booking.module';
import { MoneyModule } from '../money/money.module';
import { TripsModule } from '../trips/trips.module';

@Module({
  // MoneyModule (no cycle — money does not import sync/booking) gives the replay
  // engine PaymentsService so an offline cash payment actually settles the
  // invoice. TripsModule gives it updateDeparture so an offline date_change runs
  // the same booked-departure guard as the online route.
  imports: [OpsModule, MaintenanceModule, BookingModule, MoneyModule, TripsModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
