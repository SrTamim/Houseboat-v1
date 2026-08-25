import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AssetsModule } from '../assets/assets.module';
import { PlatformFinanceController } from './controllers/platform-finance.controller';
import { PlatformOpsController } from './controllers/platform-ops.controller';
import { PlatformRbacController } from './controllers/platform-rbac.controller';
import { PlatformSystemController } from './controllers/platform-system.controller';
import { PlatformFinanceService } from './services/platform-finance.service';
import { PlatformOpsService } from './services/platform-ops.service';
import { PlatformRbacService } from './services/platform-rbac.service';

/**
 * Cross-boat surface for the platform admin console (/api/platform/*).
 *
 * Everything that spans boats lives here, in one directory, so
 * `ls src/platform/controllers` is the complete and auditable inventory of
 * routes that bypass per-boat RBAC. Each controller carries a single
 * class-level @PlatformOnly().
 *
 * EXCEPTION: boat moderation (`platform/houseboats/*`) predates this module
 * and remains in AssetsController — it is already @PlatformOnly()-guarded, and
 * moving it would churn openapi.json and the generated frontend types for no
 * functional gain. All NEW cross-boat surface belongs here.
 *
 * These services deliberately reuse the feature modules' services where one
 * already does the work (e.g. RoutesService.setActive) rather than
 * reimplementing the query.
 */
@Module({
  imports: [PrismaModule, AssetsModule],
  controllers: [
    PlatformFinanceController,
    PlatformOpsController,
    PlatformRbacController,
    PlatformSystemController,
  ],
  providers: [PlatformFinanceService, PlatformOpsService, PlatformRbacService],
})
export class PlatformModule {}
