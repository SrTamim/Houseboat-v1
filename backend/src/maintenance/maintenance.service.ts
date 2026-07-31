import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { newId } from '../common/uuid';
import {
  CompleteTaskDto,
  CreateDamageDto,
  CreateMaintenanceTaskDto,
  CreateServiceLogDto,
  UpdateDamageDto,
  UpdateMaintenanceTaskDto,
} from './dto/maintenance.dto';

/** A task within this many engine hours of due reads as "due soon". */
const HOURS_WARN_WINDOW = 25;
/** …or within this many days, for calendar tasks. */
const DAYS_WARN_WINDOW = 7;

const DAY_MS = 86_400_000;

type TaskRow = {
  intervalKind: string;
  dueAtHours: number | null;
  dueDate: Date | null;
};

/**
 * Boat upkeep — service schedule, damage log and the engine-hour meter.
 *
 * Due-ness is computed here rather than stored: a task's urgency depends on the
 * boat's *current* meter reading, so a stored flag would go stale the moment
 * hours are logged.
 */
@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** ok | due_soon | overdue, from the boat's current engine hours and today. */
  private dueState(task: TaskRow, engineHours: number): string {
    if (task.intervalKind === 'engine_hours' && task.dueAtHours !== null) {
      if (engineHours >= task.dueAtHours) return 'overdue';
      return engineHours >= task.dueAtHours - HOURS_WARN_WINDOW
        ? 'due_soon'
        : 'ok';
    }
    if (task.intervalKind === 'calendar' && task.dueDate) {
      const days = Math.ceil((task.dueDate.getTime() - Date.now()) / DAY_MS);
      if (days <= 0) return 'overdue';
      return days <= DAYS_WARN_WINDOW ? 'due_soon' : 'ok';
    }
    return 'ok';
  }

  /** Everything the maintenance page renders, in one round trip. */
  async summary(houseboatId: string) {
    const [boat, tasks, damage, logs] = await Promise.all([
      this.prisma.houseboat.findUniqueOrThrow({
        where: { id: houseboatId },
        select: { engineHours: true, engineHoursUpdatedAt: true },
      }),
      this.prisma.maintenanceTask.findMany({
        where: { houseboatId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.damageLog.findMany({
        where: { houseboatId },
        orderBy: { reportedAt: 'desc' },
        take: 50,
      }),
      this.prisma.maintenanceServiceLog.findMany({
        where: { houseboatId },
        orderBy: { serviceDate: 'desc' },
        take: 20,
        include: { task: { select: { title: true } } },
      }),
    ]);

    const withState = tasks.map((t) => ({
      ...t,
      dueState: this.dueState(t, boat.engineHours),
    }));

    return {
      engineHours: boat.engineHours,
      engineHoursUpdatedAt: boat.engineHoursUpdatedAt,
      tasks: withState,
      dueCount: withState.filter((t) => t.dueState !== 'ok' && t.status === 'active')
        .length,
      damage,
      openDamageCount: damage.filter((d) => d.status === 'open').length,
      serviceLogs: logs,
      lastServiceAt: logs[0]?.serviceDate ?? null,
    };
  }

  async createTask(
    houseboatId: string,
    actorId: string,
    dto: CreateMaintenanceTaskDto,
  ) {
    // An engine-hours task with no target hour would never come due; the same
    // is true of a calendar task with no date. Catch it here rather than
    // silently creating a task that never fires.
    if (dto.intervalKind === 'engine_hours' && dto.dueAtHours == null) {
      throw new BadRequestException(
        'dueAtHours is required for an engine-hours task',
      );
    }
    if (dto.intervalKind === 'calendar' && !dto.dueDate) {
      throw new BadRequestException('dueDate is required for a calendar task');
    }

    const task = await this.prisma.maintenanceTask.create({
      data: {
        id: newId(),
        houseboatId,
        title: dto.title,
        intervalKind: dto.intervalKind,
        intervalValue: dto.intervalValue,
        dueAtHours: dto.dueAtHours,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        notes: dto.notes,
      },
    });
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'maintenance_task_created',
      entityType: 'maintenance_task',
      entityId: task.id,
      after: { title: task.title, intervalKind: task.intervalKind },
    });
    return task;
  }

  private async ownedTask(houseboatId: string, taskId: string) {
    const task = await this.prisma.maintenanceTask.findFirst({
      where: { id: taskId, houseboatId },
    });
    if (!task) throw new NotFoundException('Maintenance task not found');
    return task;
  }

  async updateTask(
    houseboatId: string,
    taskId: string,
    actorId: string,
    dto: UpdateMaintenanceTaskDto,
  ) {
    const before = await this.ownedTask(houseboatId, taskId);
    const task = await this.prisma.maintenanceTask.update({
      where: { id: taskId },
      data: {
        title: dto.title,
        intervalValue: dto.intervalValue,
        dueAtHours: dto.dueAtHours,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: dto.status,
        notes: dto.notes,
      },
    });
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'maintenance_task_updated',
      entityType: 'maintenance_task',
      entityId: taskId,
      before: { title: before.title, status: before.status },
      after: { title: task.title, status: task.status },
    });
    return task;
  }

  /**
   * Mark a task serviced: write a history row and roll the next due marker
   * forward by the interval. Rolling from the *reading at service* (not the
   * old target) keeps the schedule honest when a service runs late.
   */
  async completeTask(
    houseboatId: string,
    taskId: string,
    actorId: string,
    dto: CompleteTaskDto,
  ) {
    const task = await this.ownedTask(houseboatId, taskId);
    const boat = await this.prisma.houseboat.findUniqueOrThrow({
      where: { id: houseboatId },
      select: { engineHours: true },
    });
    const atHours = dto.engineHours ?? boat.engineHours;
    const serviceDate = dto.serviceDate ? new Date(dto.serviceDate) : new Date();

    return this.prisma.$transaction(async (tx) => {
      const log = await tx.maintenanceServiceLog.create({
        data: {
          id: newId(),
          houseboatId,
          taskId,
          serviceDate,
          engineHours: atHours,
          cost: dto.cost,
          note: dto.note,
          loggedBy: actorId,
        },
      });

      const next: { dueAtHours?: number; dueDate?: Date } = {};
      if (task.intervalKind === 'engine_hours' && task.intervalValue) {
        next.dueAtHours = atHours + task.intervalValue;
      } else if (task.intervalKind === 'calendar' && task.intervalValue) {
        next.dueDate = new Date(
          serviceDate.getTime() + task.intervalValue * DAY_MS,
        );
      }

      const updated = await tx.maintenanceTask.update({
        where: { id: taskId },
        data: {
          ...next,
          lastDoneAt: serviceDate,
          lastDoneHours: atHours,
        },
      });

      await this.audit.log(
        {
          houseboatId,
          actorAccountId: actorId,
          action: 'maintenance_task_completed',
          entityType: 'maintenance_task',
          entityId: taskId,
          after: { serviceDate, engineHours: atHours },
        },
        tx,
      );

      return { task: updated, log };
    });
  }

  /** Ad-hoc service record, not tied to a scheduled task. */
  async addServiceLog(
    houseboatId: string,
    actorId: string,
    dto: CreateServiceLogDto,
  ) {
    if (dto.taskId) await this.ownedTask(houseboatId, dto.taskId);
    const log = await this.prisma.maintenanceServiceLog.create({
      data: {
        id: newId(),
        houseboatId,
        taskId: dto.taskId,
        serviceDate: dto.serviceDate ? new Date(dto.serviceDate) : new Date(),
        engineHours: dto.engineHours,
        cost: dto.cost,
        note: dto.note,
        loggedBy: actorId,
      },
    });
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'maintenance_service_logged',
      entityType: 'maintenance_service_log',
      entityId: log.id,
      after: { serviceDate: log.serviceDate, cost: dto.cost },
    });
    return log;
  }

  async listDamage(houseboatId: string) {
    return this.prisma.damageLog.findMany({
      where: { houseboatId },
      orderBy: { reportedAt: 'desc' },
    });
  }

  async reportDamage(
    houseboatId: string,
    actorId: string,
    dto: CreateDamageDto,
  ) {
    const damage = await this.prisma.damageLog.create({
      data: {
        id: newId(),
        houseboatId,
        title: dto.title,
        detail: dto.detail,
        reportedBy: actorId,
      },
    });
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'damage_reported',
      entityType: 'damage_log',
      entityId: damage.id,
      after: { title: damage.title },
    });
    return damage;
  }

  async updateDamage(
    houseboatId: string,
    damageId: string,
    actorId: string,
    dto: UpdateDamageDto,
  ) {
    const before = await this.prisma.damageLog.findFirst({
      where: { id: damageId, houseboatId },
    });
    if (!before) throw new NotFoundException('Damage entry not found');

    const damage = await this.prisma.damageLog.update({
      where: { id: damageId },
      data: {
        status: dto.status,
        repairCost: dto.repairCost,
        detail: dto.detail,
        // Stamp the fix time when it transitions to fixed; clear it if reopened.
        fixedAt:
          dto.status === 'fixed'
            ? (before.fixedAt ?? new Date())
            : dto.status === 'open'
              ? null
              : undefined,
      },
    });
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'damage_updated',
      entityType: 'damage_log',
      entityId: damageId,
      before: { status: before.status },
      after: { status: damage.status, repairCost: dto.repairCost },
    });
    return damage;
  }

  /**
   * Log a meter reading. Refuses to go backwards — an hour meter only counts
   * up, so a lower number is a typo, and accepting it would silently un-due
   * every engine-hours task.
   */
  async setEngineHours(houseboatId: string, actorId: string, hours: number) {
    const boat = await this.prisma.houseboat.findUniqueOrThrow({
      where: { id: houseboatId },
      select: { engineHours: true },
    });
    if (hours < boat.engineHours) {
      throw new BadRequestException(
        `Engine hours cannot go backwards (current reading is ${boat.engineHours})`,
      );
    }
    const updated = await this.prisma.houseboat.update({
      where: { id: houseboatId },
      data: { engineHours: hours, engineHoursUpdatedAt: new Date() },
      select: { engineHours: true, engineHoursUpdatedAt: true },
    });
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'engine_hours_set',
      entityType: 'houseboat',
      entityId: houseboatId,
      before: { engineHours: boat.engineHours },
      after: { engineHours: hours },
    });
    return updated;
  }
}
