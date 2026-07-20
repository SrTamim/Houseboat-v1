import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { RbacService } from './rbac.service';
import { RolesService } from './roles.service';
import { MembershipService } from './membership.service';
import { RequirePermission } from './require-permission.decorator';
import { CurrentUser } from '../auth/decorators';
import { AuthUser } from '../auth/auth.types';
import {
  CreateRoleDto,
  UpdateRoleDto,
  AddMemberDto,
  ChangeRoleDto,
} from './dto/rbac.dto';

@Controller()
export class RbacController {
  constructor(
    private readonly rbac: RbacService,
    private readonly roles: RolesService,
    private readonly members: MembershipService,
  ) {}

  /** Boat switcher — which boats can this account operate. */
  @Get('me/boats')
  myBoats(@CurrentUser() user: AuthUser) {
    return this.rbac.listBoats(user.id);
  }

  // ── Roles (settings:edit) ──────────────────────────────────
  @Get('houseboats/:houseboatId/roles')
  @RequirePermission({ module: 'settings', action: 'view' })
  listRoles(@Param('houseboatId') houseboatId: string) {
    return this.roles.list(houseboatId);
  }

  @Post('houseboats/:houseboatId/roles')
  @RequirePermission({ module: 'settings', action: 'edit' })
  createRole(
    @Param('houseboatId') houseboatId: string,
    @Body() dto: CreateRoleDto,
  ) {
    return this.roles.create(houseboatId, dto.name, dto.permissions, dto.isTemplate);
  }

  @Patch('houseboats/:houseboatId/roles/:roleId')
  @RequirePermission({ module: 'settings', action: 'edit' })
  updateRole(@Param('roleId') roleId: string, @Body() dto: UpdateRoleDto) {
    return this.roles.update(roleId, dto.name, dto.permissions);
  }

  // ── Members (settings:edit) ────────────────────────────────
  @Get('houseboats/:houseboatId/members')
  @RequirePermission({ module: 'settings', action: 'view' })
  listMembers(@Param('houseboatId') houseboatId: string) {
    return this.members.list(houseboatId);
  }

  @Post('houseboats/:houseboatId/members')
  @RequirePermission({ module: 'settings', action: 'edit' })
  addMember(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AddMemberDto,
  ) {
    return this.members.addMember(houseboatId, user.id, dto);
  }

  @Patch('houseboats/:houseboatId/members/:membershipId/role')
  @RequirePermission({ module: 'settings', action: 'edit' })
  changeRole(
    @Param('membershipId') membershipId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangeRoleDto,
  ) {
    return this.members.changeRole(membershipId, dto.roleId, user.id);
  }

  @Post('houseboats/:houseboatId/members/:membershipId/exit')
  @RequirePermission({ module: 'settings', action: 'edit' })
  exitMember(
    @Param('membershipId') membershipId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.members.exitMember(membershipId, user.id);
  }
}
