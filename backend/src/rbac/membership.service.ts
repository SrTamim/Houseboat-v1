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

  async exitMember(membershipId: string, actorId: string) {
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

  async changeRole(membershipId: string, roleId: string, actorId: string) {
    const before = await this.prisma.houseboatMember.findUnique({
      where: { id: membershipId },
    });
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
    dto: {
      roleId?: string;
      shareholderPct?: number;
      startDate?: string;
      status?: 'active' | 'exited';
    },
    actorId: string,
  ) {
    const before = await this.prisma.houseboatMember.findUnique({
      where: { id: membershipId },
    });
    if (!before) throw new NotFoundException('Membership not found');

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
