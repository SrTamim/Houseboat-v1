import { Module } from '@nestjs/common';
import { AssetsController } from './assets.controller';
import { HouseboatAdminService } from './houseboat-admin.service';
import { RoutesService } from './routes.service';
import { PlatformBoatsService } from './platform-boats.service';

@Module({
  controllers: [AssetsController],
  providers: [HouseboatAdminService, RoutesService, PlatformBoatsService],
  exports: [HouseboatAdminService, RoutesService],
})
export class AssetsModule {}
