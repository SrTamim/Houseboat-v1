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

  list(houseboatId: string) {
    return this.prisma.houseboatMember.findMany({
      where: { houseboatId },
      include: {
        account: { select: { id: true, name: true, phone: true } },
        role: { select: { name: true } },
      },
    });
  }
}
