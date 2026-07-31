import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser, PlatformOnly } from '../../auth/decorators';
import { AuthUser } from '../../auth/auth.types';
import { PlatformRbacService } from '../services/platform-rbac.service';
import { PlatformPermission } from '../rbac/platform-permission.decorator';
import {
  AssignPlatformRoleDto,
  CreatePlatformRoleDto,
  SetPlatformStaffDto,
  UpdatePlatformRoleDto,
} from '../dto/platform-rbac.dto';

/**
 * Platform RBAC management. Class default requires roles/edit — only the
 * role list is readable with roles/view. See PlatformFinanceController for
 * why @PlatformOnly() is class-level.
 */
@PlatformOnly()
@PlatformPermission('roles', 'edit')
@Controller('platform/rbac')
export class PlatformRbacController {
  constructor(private readonly rbac: PlatformRbacService) {}

  @PlatformPermission('roles', 'view')
  @Get('roles')
  listRoles() {
    return this.rbac.listRoles();
  }

  @Post('roles')
  createRole(@CurrentUser() user: AuthUser, @Body() dto: CreatePlatformRoleDto) {
    return this.rbac.createRole(dto, user.id);
  }

  @Patch('roles/:roleId')
  updateRole(
    @Param('roleId') roleId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePlatformRoleDto,
  ) {
    return this.rbac.updateRole(roleId, dto, user.id);
  }

  @Delete('roles/:roleId')
  deleteRole(@Param('roleId') roleId: string, @CurrentUser() user: AuthUser) {
    return this.rbac.deleteRole(roleId, user.id);
  }

  @Patch('accounts/:accountId/platform-role')
  assignRole(
    @Param('accountId') accountId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AssignPlatformRoleDto,
  ) {
    return this.rbac.assignRole(accountId, dto, user.id);
  }

  @Patch('accounts/:accountId/platform-staff')
  setStaff(
    @Param('accountId') accountId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SetPlatformStaffDto,
  ) {
    return this.rbac.setStaff(accountId, dto, user.id);
  }
}
