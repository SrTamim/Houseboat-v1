import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { OpsModule } from '../ops/ops.module';

@Module({
  imports: [OpsModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
