import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { newId } from '../common/uuid';
import { normalizePhone } from '../auth/auth.types';

/**
 * Per-boat membership. A single account can be a member of many boats with a
 * different role on each. Exiting sets end_date + status='exited' but keeps the
 * row so historical read access survives (plan §Identity, §10).
 */
@Injectable()
export class MembershipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * The caller's own membership row on a boat, exited ones included — an exited
   * shareholder keeps read access, so they must still be able to load (and
   * silence) their notifications.
   */
  findOwn(accountId: string, houseboatId: string) {
    return this.prisma.houseboatMember.findFirst({
      where: { accountId, houseboatId },
      orderBy: { startDate: 'desc' },
    });
  }

  /** Replace a member's notification preferences with the supplied map. */
  async updateNotificationPrefs(
    membershipId: string,
    prefs: Record<string, boolean>,
  ) {
    const updated = await this.prisma.houseboatMember.update({
      where: { id: membershipId },
      data: { notificationPrefs: prefs },
      select: { id: true, notificationPrefs: true },
    });
    return {
      membershipId: updated.id,
      notificationPrefs: updated.notificationPrefs ?? {},
    };
  }

  /**
   * Resolve a membership row and assert it belongs to the boat the caller was
   * authorized against. The controller guard only checks permission on the
   * :houseboatId in the URL — without this, a bare membershipId would let a
   * member of boat A edit/exit a member of boat B (IDOR). Mirrors the scoping
   * roles.service.update already does for roles.
   */
  private async ownedMembership(membershipId: string, houseboatId: string) {
    const membership = await this.prisma.houseboatMember.findFirst({
      where: { id: membershipId, houseboatId },
    });
    if (!membership) throw new NotFoundException('Membership not found');
    return membership;
  }

  /** Assert a role belongs to this boat before it can be assigned to a member. */
  private async assertRoleOnBoat(roleId: string, houseboatId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, houseboatId },
      select: { id: true },
    });
    if (!role) throw new NotFoundException('Role not found on this houseboat');
  }

  /** Add an existing account (by phone) to a boat with a role + share %. */
  async addMember(
    houseboatId: string,
    actorId: string,
    input: {
      phone: string;
      roleId: string;
      shareholderPct?: number;
    },
  ) {
    const phone = normalizePhone(input.phone);
    const account = await this.prisma.account.findUnique({ where: { phone } });
    if (!account) {
      throw new NotFoundException('No account with that phone — ask them to register first');
    }

    // The role must belong to this boat — an id from another boat would grant a
    // foreign permission map.
    await this.assertRoleOnBoat(input.roleId, houseboatId);

    const membership = await this.prisma.houseboatMember.create({
      data: {
        id: newId(),
        accountId: account.id,
        houseboatId,
        roleId: input.roleId,
        shareholderPct: input.shareholderPct,
        startDate: new Date(),
        status: 'active',
      },
    });

    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'member_add',
      entityType: 'houseboat_member',
      entityId: membership.id,
      after: { accountId: account.id, roleId: input.roleId },
    });
    return membership;
  }

  async exitMember(membershipId: string, houseboatId: string, actorId: string) {
    await this.ownedMembership(membershipId, houseboatId);
    const membership = await this.prisma.houseboatMember.update({
      where: { id: membershipId },
      data: { status: 'exited', endDate: new Date() },
    });
    await this.audit.log({
      houseboatId: membership.houseboatId,
      actorAccountId: actorId,
      action: 'member_exit',
      entityType: 'houseboat_member',
      entityId: membershipId,
    });
    return membership;
  }

  async changeRole(
    membershipId: string,
    houseboatId: string,
    roleId: string,
    actorId: string,
  ) {
    const before = await this.ownedMembership(membershipId, houseboatId);
    await this.assertRoleOnBoat(roleId, houseboatId);
    const membership = await this.prisma.houseboatMember.update({
      where: { id: membershipId },
      data: { roleId },
    });
    await this.audit.log({
      houseboatId: membership.houseboatId,
      actorAccountId: actorId,
      action: 'role_change',
      entityType: 'houseboat_member',
      entityId: membershipId,
      before: { roleId: before?.roleId },
      after: { roleId },
    });
    return membership;
  }

  /**
   * Edit an existing membership: role, share %, start date, and status. A
   * unified alternative to the narrow changeRole/exitMember paths — setting
   * status to 'exited' stamps endDate, 'active' clears it (the re-activate
   * path). Only the supplied fields are written.
   */
  async updateMember(
    membershipId: string,
    houseboatId: string,
    dto: {
      roleId?: string;
      shareholderPct?: number;
      startDate?: string;
      status?: 'active' | 'exited';
    },
    actorId: string,
  ) {
    const before = await this.ownedMembership(membershipId, houseboatId);
    if (dto.roleId !== undefined) {
      await this.assertRoleOnBoat(dto.roleId, houseboatId);
    }

    const data: {
      roleId?: string;
      shareholderPct?: number;
      startDate?: Date;
      status?: string;
      endDate?: Date | null;
    } = {};
    if (dto.roleId !== undefined) data.roleId = dto.roleId;
    if (dto.shareholderPct !== undefined) data.shareholderPct = dto.shareholderPct;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.status !== undefined) {
      data.status = dto.status;
      data.endDate = dto.status === 'exited' ? new Date() : null;
    }

    const membership = await this.prisma.houseboatMember.update({
      where: { id: membershipId },
      data,
    });

    await this.audit.log({
      houseboatId: membership.houseboatId,
      actorAccountId: actorId,
      action: 'member_update',
      entityType: 'houseboat_member',
      entityId: membershipId,
      before: {
        roleId: before.roleId,
        shareholderPct: before.shareholderPct,
        startDate: before.startDate,
        status: before.status,
      },
      after: data,
    });
    return membership;
  }

  list(houseboatId: string) {
    return this.prisma.houseboatMember.findMany({
      where: { houseboatId },
      include: {
        account: { select: { id: true, name: true, phone: true } },
        role: { select: { id: true, name: true } },
      },
    });
  }
}
