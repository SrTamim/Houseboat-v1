import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { newId } from '../common/uuid';
import { FULL_PERMISSIONS, PermissionMap } from './permission.types';

/**
 * Role management per boat. The "role generator" (plan §Identity) lets an owner
 * name roles (Owner, Shareholder, Manager…) and set a per-module permission map.
 */
@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Auto-created full-access Owner role for a new boat. */
  async createOwnerRole(houseboatId: string, tx?: PrismaService) {
    const client = tx ?? this.prisma;
    return client.role.create({
      data: {
        id: newId(),
        houseboatId,
        name: 'Owner',
        isTemplate: false,
        permissions: FULL_PERMISSIONS as never,
      },
    });
  }

  async create(
    houseboatId: string,
    name: string,
    permissions: PermissionMap,
    isTemplate = false,
  ) {
    return this.prisma.role.create({
      data: {
        id: newId(),
        houseboatId,
        name,
        isTemplate,
        permissions: permissions as never,
      },
    });
  }

  list(houseboatId: string) {
    return this.prisma.role.findMany({ where: { houseboatId } });
  }

  /**
   * Scoped by houseboatId: the guard authorizes the boat in the URL, so a
   * bare roleId update would let a member of boat A edit boat B's roles.
   */
  async update(
    houseboatId: string,
    roleId: string,
    name: string,
    permissions: PermissionMap,
  ) {
    const existing = await this.prisma.role.findFirst({
      where: { id: roleId, houseboatId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Role not found');
    return this.prisma.role.update({
      where: { id: roleId },
      data: { name, permissions: permissions as never },
    });
  }

  /**
   * Delete a role. The members holding it are removed from the boat (their
   * membership rows are deleted). Scoped by houseboatId (IDOR). Guards:
   *  - the auto-created "Owner" role can never be deleted — every boat must keep
   *    its full-access role, and losing it could lock everyone out;
   *  - if any member on the role has recorded owner distributions, the delete is
   *    refused (owner_distribution.membership_id is a RESTRICT FK; deleting would
   *    corrupt financial history) — the owner must exit/reassign them first.
   * houseboat_member.role_id is RESTRICT for every status, so all rows (active
   * and exited) must be removed before the role row can be dropped.
   */
  async delete(houseboatId: string, roleId: string, actorId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, houseboatId },
      select: { id: true, name: true },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (role.name === 'Owner') {
      throw new BadRequestException('The Owner role cannot be deleted');
    }

    const members = await this.prisma.houseboatMember.findMany({
      where: { roleId, houseboatId },
      select: { id: true },
    });
    const memberIds = members.map((m) => m.id);

    if (memberIds.length > 0) {
      const distributions = await this.prisma.ownerDistribution.count({
        where: { membershipId: { in: memberIds } },
      });
      if (distributions > 0) {
        throw new BadRequestException(
          'This role has members with recorded distributions — exit or reassign them before deleting the role.',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Staff carry a nullable job-title link to the role — clear it.
      await tx.houseboatStaff.updateMany({
        where: { roleId },
        data: { roleId: null },
      });
      // Remove the members on this role (all statuses) so the FK no longer
      // references the role, then drop the role.
      await tx.houseboatMember.deleteMany({ where: { roleId, houseboatId } });
      await tx.role.delete({ where: { id: roleId } });
    });

    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'role_delete',
      entityType: 'role',
      entityId: roleId,
      before: { name: role.name, removedMembers: memberIds.length },
    });

    return { deleted: true, removedMembers: memberIds.length };
  }
}
