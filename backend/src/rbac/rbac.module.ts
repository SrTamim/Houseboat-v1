import { Global, Module } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { RolesService } from './roles.service';
import { MembershipService } from './membership.service';
import { RbacController } from './rbac.controller';
import { PermissionGuard } from './permission.guard';

/**
 * Global so RbacService + PermissionGuard are usable everywhere. PermissionGuard
 * is registered app-wide as an APP_GUARD in AppModule.
 */
@Global()
@Module({
  controllers: [RbacController],
  providers: [RbacService, RolesService, MembershipService, PermissionGuard],
  exports: [RbacService, RolesService, MembershipService, PermissionGuard],
})
export class RbacModule {}
