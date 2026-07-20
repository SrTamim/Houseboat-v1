import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/**
 * Platform-staff moderation of boats: review the queue, approve a fully-complete
 * boat to `live`, or suspend. A boat can only go live at 100% completeness AND
 * with a bank account set (mandatory before payouts run).
 */
@Injectable()
export class PlatformBoatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listByStatus(status?: string) {
    return this.prisma.houseboat.findMany({
      where: status ? { status } : undefined,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        profileCompletePct: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(houseboatId: string, actorId: string) {
    const boat = await this.prisma.houseboat.findUnique({
      where: { id: houseboatId },
    });
    if (!boat) throw new NotFoundException('Houseboat not found');
    if (boat.profileCompletePct < 100) {
      throw new BadRequestException(
        `Profile only ${boat.profileCompletePct}% complete — cannot go live`,
      );
    }
    if (!boat.bankAccount) {
      throw new BadRequestException('Bank account required before going live');
    }
    const updated = await this.prisma.houseboat.update({
      where: { id: houseboatId },
      data: { status: 'live' },
    });
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'houseboat_approve',
      entityType: 'houseboat',
      entityId: houseboatId,
      before: { status: boat.status },
      after: { status: 'live' },
    });
    return updated;
  }

  async setStatus(houseboatId: string, status: string, actorId: string) {
    const updated = await this.prisma.houseboat.update({
      where: { id: houseboatId },
      data: { status },
    });
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'houseboat_status_change',
      entityType: 'houseboat',
      entityId: houseboatId,
      after: { status },
    });
    return updated;
  }
}
