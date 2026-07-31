import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { newId } from '../../common/uuid';
import { validatePlatformPermissionMap } from '../rbac/platform-permission.types';
import type {
  AssignPlatformRoleDto,
  CreatePlatformRoleDto,
  SetPlatformStaffDto,
  UpdatePlatformRoleDto,
} from '../dto/platform-rbac.dto';

/**
 * Platform-staff role management. Self-changes are blanket-blocked (both
 * grant and revoke): with the seeded maker/checker admin pair there are
 * always ≥2 superadmins, so "another admin must change your access" is
 * workable and makes last-superadmin lockout impossible via this API.
 */
@Injectable()
export class PlatformRbacService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listRoles() {
    return this.prisma.platformRole.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        permissions: true,
        createdAt: true,
        _count: { select: { accounts: true } },
      },
    });
  }

  async createRole(dto: CreatePlatformRoleDto, actorId: string) {
    const permissions = validatePlatformPermissionMap(dto.permissions);
    const existing = await this.prisma.platformRole.findUnique({
      where: { name: dto.name },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('A platform role with that name exists');
    }
    const role = await this.prisma.platformRole.create({
      data: { id: newId(), name: dto.name, permissions: permissions as never },
    });
    await this.audit.log({
      houseboatId: null,
      actorAccountId: actorId,
      action: 'platform_role_create',
      entityType: 'platform_role',
      entityId: role.id,
      after: { name: role.name, permissions },
    });
    return role;
  }

  async updateRole(roleId: string, dto: UpdatePlatformRoleDto, actorId: string) {
    const existing = await this.prisma.platformRole.findUnique({
      where: { id: roleId },
    });
    if (!existing) throw new NotFoundException('Platform role not found');

    const permissions =
      dto.permissions !== undefined
        ? validatePlatformPermissionMap(dto.permissions)
        : undefined;

    if (dto.name && dto.name !== existing.name) {
      const clash = await this.prisma.platformRole.findUnique({
        where: { name: dto.name },
        select: { id: true },
      });
      if (clash) {
        throw new ConflictException('A platform role with that name exists');
      }
    }

    const role = await this.prisma.platformRole.update({
      where: { id: roleId },
      data: {
        name: dto.name ?? undefined,
        permissions: (permissions as never) ?? undefined,
      },
    });
    await this.audit.log({
      houseboatId: null,
      actorAccountId: actorId,
      action: 'platform_role_update',
      entityType: 'platform_role',
      entityId: roleId,
      before: { name: existing.name, permissions: existing.permissions },
      after: { name: role.name, permissions: role.permissions },
    });
    return role;
  }

  async deleteRole(roleId: string, actorId: string) {
    const existing = await this.prisma.platformRole.findUnique({
      where: { id: roleId },
      include: { _count: { select: { accounts: true } } },
    });
    if (!existing) throw new NotFoundException('Platform role not found');
    if (existing._count.accounts > 0) {
      // The DB FK is ON DELETE RESTRICT as a backstop for races.
      throw new ConflictException(
        `Role is assigned to ${existing._count.accounts} account(s)`,
      );
    }
    await this.prisma.platformRole.delete({ where: { id: roleId } });
    await this.audit.log({
      houseboatId: null,
      actorAccountId: actorId,
      action: 'platform_role_delete',
      entityType: 'platform_role',
      entityId: roleId,
      before: { name: existing.name, permissions: existing.permissions },
    });
    return { deleted: true };
  }

  async assignRole(
    accountId: string,
    dto: AssignPlatformRoleDto,
    actorId: string,
  ) {
    if (accountId === actorId) {
      throw new BadRequestException('Cannot change your own platform role');
    }
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true, isPlatform: true, platformRoleId: true },
    });
    if (!account) throw new NotFoundException('Account not found');
    if (!account.isPlatform) {
      throw new BadRequestException('Grant platform staff access first');
    }
    const roleId = dto.platformRoleId ?? null;
    if (roleId) {
      const role = await this.prisma.platformRole.findUnique({
        where: { id: roleId },
        select: { id: true },
      });
      if (!role) throw new NotFoundException('Platform role not found');
    }
    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data: { platformRoleId: roleId },
      select: { id: true, isPlatform: true, platformRoleId: true },
    });
    await this.audit.log({
      houseboatId: null,
      actorAccountId: actorId,
      action: 'platform_role_assign',
      entityType: 'account',
      entityId: accountId,
      before: { platformRoleId: account.platformRoleId },
      after: { platformRoleId: roleId },
    });
    return updated;
  }

  async setStaff(accountId: string, dto: SetPlatformStaffDto, actorId: string) {
    if (accountId === actorId) {
      throw new BadRequestException('Cannot change your own staff access');
    }
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true, isPlatform: true, platformRoleId: true },
    });
    if (!account) throw new NotFoundException('Account not found');

    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data: {
        isPlatform: dto.isPlatform,
        // A non-staff account must not retain a platform role.
        platformRoleId: dto.isPlatform ? undefined : null,
      },
      select: { id: true, isPlatform: true, platformRoleId: true },
    });
    await this.audit.log({
      houseboatId: null,
      actorAccountId: actorId,
      action: 'platform_staff_change',
      entityType: 'account',
      entityId: accountId,
      before: {
        isPlatform: account.isPlatform,
        platformRoleId: account.platformRoleId,
      },
      after: {
        isPlatform: updated.isPlatform,
        platformRoleId: updated.platformRoleId,
      },
    });
    return updated;
  }
}
