import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { OpsModule } from '../ops/ops.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { BookingModule } from '../booking/booking.module';

@Module({
  imports: [OpsModule, MaintenanceModule, BookingModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
