import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { newId } from '../common/uuid';
import {
  AddRequestCommentDto,
  CreateMaintenanceRequestDto,
  UpdateMaintenanceRequestDto,
} from './dto/maintenance.dto';

/** Statuses that count as still-open work (drives KPIs and the dashboard badge). */
const OPEN_STATUSES = ['pending', 'in_progress'];
/** Statuses that close a request, so we stamp closedAt. */
const CLOSED_STATUSES = ['complete', 'canceled'];

/**
 * Boat maintenance requests — a simple ticket tracker. Each request has a
 * topic, urgency and a status that moves pending → in_progress →
 * complete/canceled, with a running comment log that also records the status
 * changes it accompanied.
 */
@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Everything the maintenance page renders — KPI counts and the list — in one round trip. */
  async requestsSummary(
    houseboatId: string,
    opts: { q?: string; status?: string } = {},
  ) {
    const where: Prisma.MaintenanceRequestWhereInput = { houseboatId };
    if (opts.q) {
      where.topic = { contains: opts.q, mode: 'insensitive' };
    }
    if (opts.status) {
      where.status = opts.status;
    }

    const [requests, grouped] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        include: { comments: { orderBy: { createdAt: 'asc' } } },
      }),
      this.prisma.maintenanceRequest.groupBy({
        by: ['status'],
        where: { houseboatId },
        _count: { _all: true },
      }),
    ]);

    const count = (status: string) =>
      grouped.find((g) => g.status === status)?._count._all ?? 0;

    return {
      requests,
      kpis: {
        total: grouped.reduce((sum, g) => sum + g._count._all, 0),
        pending: count('pending'),
        inProgress: count('in_progress'),
        complete: count('complete'),
        canceled: count('canceled'),
      },
    };
  }

  private async ownedRequest(houseboatId: string, requestId: string) {
    const request = await this.prisma.maintenanceRequest.findFirst({
      where: { id: requestId, houseboatId },
    });
    if (!request) throw new NotFoundException('Maintenance request not found');
    return request;
  }

  async createRequest(
    houseboatId: string,
    actorId: string,
    dto: CreateMaintenanceRequestDto,
  ) {
    const request = await this.prisma.$transaction(async (tx) => {
      const created = await tx.maintenanceRequest.create({
        data: {
          id: newId(),
          houseboatId,
          topic: dto.topic,
          urgency: dto.urgency,
          requestedAt: new Date(),
          createdBy: actorId,
        },
      });
      if (dto.comment) {
        await tx.maintenanceRequestComment.create({
          data: {
            id: newId(),
            requestId: created.id,
            body: dto.comment,
            authorId: actorId,
          },
        });
      }
      return tx.maintenanceRequest.findUniqueOrThrow({
        where: { id: created.id },
        include: { comments: { orderBy: { createdAt: 'asc' } } },
      });
    });

    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'maintenance_request_created',
      entityType: 'maintenance_request',
      entityId: request.id,
      after: { topic: request.topic, urgency: request.urgency },
    });
    return request;
  }

  async updateRequest(
    houseboatId: string,
    requestId: string,
    actorId: string,
    dto: UpdateMaintenanceRequestDto,
  ) {
    const before = await this.ownedRequest(houseboatId, requestId);

    // closedAt tracks the open/closed transition, not every edit.
    let closedAt: Date | null | undefined;
    if (dto.status && CLOSED_STATUSES.includes(dto.status)) {
      closedAt = before.closedAt ?? new Date();
    } else if (dto.status && OPEN_STATUSES.includes(dto.status)) {
      closedAt = null;
    }

    const request = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          topic: dto.topic,
          urgency: dto.urgency,
          status: dto.status,
          closedAt,
        },
      });
      if (dto.comment) {
        await tx.maintenanceRequestComment.create({
          data: {
            id: newId(),
            requestId,
            body: dto.comment,
            statusChange: dto.status ?? null,
            authorId: actorId,
          },
        });
      }
      return tx.maintenanceRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: { comments: { orderBy: { createdAt: 'asc' } } },
      });
    });

    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'maintenance_request_updated',
      entityType: 'maintenance_request',
      entityId: requestId,
      before: { status: before.status, urgency: before.urgency },
      after: { status: request.status, urgency: request.urgency },
    });
    return request;
  }

  async addRequestComment(
    houseboatId: string,
    requestId: string,
    actorId: string,
    dto: AddRequestCommentDto,
  ) {
    await this.ownedRequest(houseboatId, requestId);
    const comment = await this.prisma.maintenanceRequestComment.create({
      data: {
        id: newId(),
        requestId,
        body: dto.body,
        authorId: actorId,
      },
    });
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'maintenance_request_commented',
      entityType: 'maintenance_request',
      entityId: requestId,
      after: { comment: dto.body },
    });
    return comment;
  }
}
