import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
  UpdateMemberDto,
  MySettingsDto,
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

  /**
   * The caller's own preferences on a boat (notification toggles).
   *
   * Deliberately NOT decorated with @RequirePermission: a member with no
   * `settings` permission must still be able to manage their own notifications.
   * Because PermissionGuard skips undecorated routes, this handler does its own
   * membership check — without it the route would be authenticated but
   * unscoped, and anyone could read any boat's membership row.
   */
  @Get('houseboats/:houseboatId/my-settings')
  async mySettings(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const membership = await this.requireOwnMembership(user.id, houseboatId);
    return {
      membershipId: membership.id,
      houseboatId,
      notificationPrefs: membership.notificationPrefs ?? {},
      isExited: membership.status === 'exited' || membership.endDate != null,
    };
  }

  @Patch('houseboats/:houseboatId/my-settings')
  async updateMySettings(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: MySettingsDto,
  ) {
    const membership = await this.requireOwnMembership(user.id, houseboatId);
    return this.members.updateNotificationPrefs(
      membership.id,
      dto.notificationPrefs ?? {},
    );
  }

  /** Resolve the caller's own membership row, or 403. */
  private async requireOwnMembership(accountId: string, houseboatId: string) {
    const membership = await this.members.findOwn(accountId, houseboatId);
    if (!membership) {
      throw new ForbiddenException('You have no access to this houseboat');
    }
    return membership;
  }

  // ── Roles (team:view/edit) ─────────────────────────────────
  @Get('houseboats/:houseboatId/roles')
  @RequirePermission({ module: 'team', action: 'view' })
  listRoles(@Param('houseboatId') houseboatId: string) {
    return this.roles.list(houseboatId);
  }

  @Post('houseboats/:houseboatId/roles')
  @RequirePermission({ module: 'team', action: 'edit' })
  createRole(
    @Param('houseboatId') houseboatId: string,
    @Body() dto: CreateRoleDto,
  ) {
    return this.roles.create(houseboatId, dto.name, dto.permissions, dto.isTemplate);
  }

  @Patch('houseboats/:houseboatId/roles/:roleId')
  @RequirePermission({ module: 'team', action: 'edit' })
  updateRole(
    @Param('houseboatId') houseboatId: string,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.roles.update(houseboatId, roleId, dto.name, dto.permissions);
  }

  @Delete('houseboats/:houseboatId/roles/:roleId')
  @RequirePermission({ module: 'team', action: 'edit' })
  deleteRole(
    @Param('houseboatId') houseboatId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.roles.delete(houseboatId, roleId, user.id);
  }

  // ── Members (team:view/edit) ───────────────────────────────
  @Get('houseboats/:houseboatId/members')
  @RequirePermission({ module: 'team', action: 'view' })
  listMembers(@Param('houseboatId') houseboatId: string) {
    return this.members.list(houseboatId);
  }

  @Post('houseboats/:houseboatId/members')
  @RequirePermission({ module: 'team', action: 'edit' })
  addMember(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AddMemberDto,
  ) {
    return this.members.addMember(houseboatId, user.id, dto);
  }

  @Patch('houseboats/:houseboatId/members/:membershipId')
  @RequirePermission({ module: 'team', action: 'edit' })
  updateMember(
    @Param('houseboatId') houseboatId: string,
    @Param('membershipId') membershipId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.members.updateMember(membershipId, houseboatId, dto, user.id);
  }

  @Patch('houseboats/:houseboatId/members/:membershipId/role')
  @RequirePermission({ module: 'team', action: 'edit' })
  changeRole(
    @Param('houseboatId') houseboatId: string,
    @Param('membershipId') membershipId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangeRoleDto,
  ) {
    return this.members.changeRole(membershipId, houseboatId, dto.roleId, user.id);
  }

  @Post('houseboats/:houseboatId/members/:membershipId/exit')
  @RequirePermission({ module: 'team', action: 'edit' })
  exitMember(
    @Param('houseboatId') houseboatId: string,
    @Param('membershipId') membershipId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.members.exitMember(membershipId, houseboatId, user.id);
  }

  @Delete('houseboats/:houseboatId/members/:membershipId')
  @RequirePermission({ module: 'team', action: 'edit' })
  deleteMember(
    @Param('houseboatId') houseboatId: string,
    @Param('membershipId') membershipId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.members.deleteMember(membershipId, houseboatId, user.id);
  }
}
