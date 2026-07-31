import { Module } from '@nestjs/common';
import { OwnerController } from './owner.controller';
import { OwnerDashboardService } from './owner-dashboard.service';
import { OwnerReportsService } from './owner-reports.service';
import { OwnerGuestsService } from './owner-guests.service';
import { AuditModule } from '../audit/audit.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [AuditModule, RbacModule],
  controllers: [OwnerController],
  providers: [OwnerDashboardService, OwnerReportsService, OwnerGuestsService],
})
export class OwnerModule {}
