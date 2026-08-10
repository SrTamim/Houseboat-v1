import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TripsService } from './trips.service';
import { newId } from '../common/uuid';
import { SaveScheduleDto } from './dto/trips.dto';

/**
 * Weekly recurring schedule (§1). The owner picks a package (its route is the
 * boat's route) and up to 7 trip slots, each with its own weekdays. This
 * service generates trip_departure rows for a rolling window ahead and a daily
 * cron keeps that window populated. Generation is idempotent: a (slot, date)
 * that already has a departure is skipped.
 *
 * Only dates in houseboat.operating_dates[] produce departures — the same gate
 * the manual path enforces.
 */
@Injectable()
export class ScheduleGeneratorService {
  private readonly logger = new Logger(ScheduleGeneratorService.name);
  /** How many days ahead to keep populated. */
  private readonly WINDOW_DAYS = 62;

  constructor(
    private readonly prisma: PrismaService,
    private readonly trips: TripsService,
    private readonly audit: AuditService,
  ) {}

  /** The active weekly schedule for a boat, with its slots. */
  getSchedule(houseboatId: string) {
    return this.prisma.boatSchedule.findFirst({
      where: { houseboatId, active: true },
      include: {
        package: { include: { route: { select: { name: true } } } },
        slots: { orderBy: { slotNo: 'asc' } },
      },
    });
  }

  /**
   * Save the boat's weekly schedule and generate the rolling window immediately.
   *
   * Re-saving UPDATES the existing active schedule in place rather than creating
   * a fresh one. This is what prevents duplicate departures: the generator dedupes
   * on `scheduleSlotId|date`, so reusing the same slot ids keeps already-generated
   * future departures from being re-created. Reconciliation never hard-deletes a
   * departure or a slot (their FK children have no cascade) — it CANCELS future
   * unbooked departures that no longer match, and leaves cleared slots in place
   * with empty weekdays. Past departures and booked departures are never touched.
   */
  async saveSchedule(houseboatId: string, actorId: string, dto: SaveScheduleDto) {
    const pkg = await this.prisma.tripPackage.findFirst({
      where: { id: dto.packageId, houseboatId },
      select: { id: true, routeId: true },
    });
    if (!pkg) throw new NotFoundException('Package not found for this boat');

    // The schedule may only use packages on the boat's active route.
    const activeLink = await this.prisma.houseboatRoute.findFirst({
      where: { houseboatId },
      select: { routeId: true },
    });
    if (!activeLink || pkg.routeId !== activeLink.routeId) {
      throw new BadRequestException(
        "This package is not on the boat's active route",
      );
    }

    const existing = await this.prisma.boatSchedule.findFirst({
      where: { houseboatId, active: true },
      include: { slots: true },
    });

    // Incoming slots keyed by slotNo (weekdays already filtered by the caller;
    // a slot absent from the payload is treated as cleared → empty weekdays).
    const bySlotNo = new Map(dto.slots.map((s) => [s.slotNo, s]));

    let scheduleId: string;

    if (!existing) {
      // ── First-time path: create the schedule + its slots. ──
      const created = await this.prisma.$transaction(async (tx) => {
        const sched = await tx.boatSchedule.create({
          data: {
            id: newId(),
            houseboatId,
            packageId: dto.packageId,
            active: dto.active ?? true,
          },
        });
        await tx.tripScheduleSlot.createMany({
          data: dto.slots.map((s) => ({
            id: newId(),
            scheduleId: sched.id,
            slotNo: s.slotNo,
            weekdays: s.weekdays,
            departureTime: this.trips.timeToDate(s.departureTime),
            pricingProfileId: s.pricingProfileId,
          })),
        });
        return sched;
      });
      scheduleId = created.id;
    } else {
      // ── Re-save path: reconcile the existing schedule in place. ──
      scheduleId = existing.id;
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      await this.prisma.$transaction(async (tx) => {
        // Retire any OTHER active schedules (defensive — should be at most one).
        await tx.boatSchedule.updateMany({
          where: { houseboatId, active: true, id: { not: existing.id } },
          data: { active: false },
        });

        await tx.boatSchedule.update({
          where: { id: existing.id },
          data: { packageId: dto.packageId, active: true },
        });

        // Upsert slots 1..7 by (scheduleId, slotNo), preserving slot ids so
        // departures stay linked. Slots not in the payload are cleared to [].
        for (let slotNo = 1; slotNo <= 7; slotNo++) {
          const incoming = bySlotNo.get(slotNo);
          await tx.tripScheduleSlot.upsert({
            where: { scheduleId_slotNo: { scheduleId: existing.id, slotNo } },
            create: {
              id: newId(),
              scheduleId: existing.id,
              slotNo,
              weekdays: incoming?.weekdays ?? [],
              departureTime: this.trips.timeToDate(incoming?.departureTime),
              pricingProfileId: incoming?.pricingProfileId ?? null,
            },
            update: {
              weekdays: incoming?.weekdays ?? [],
              departureTime: this.trips.timeToDate(incoming?.departureTime),
              pricingProfileId: incoming?.pricingProfileId ?? null,
            },
          });
        }

        // Reconcile FUTURE departures against the new slot definitions.
        const slotIds = existing.slots.map((s) => s.id);
        if (slotIds.length > 0) {
          const future = await tx.tripDeparture.findMany({
            where: {
              scheduleSlotId: { in: slotIds },
              startDate: { gte: today },
              status: 'scheduled',
            },
            include: { _count: { select: { bookings: true } } },
          });

          for (const d of future) {
            if (d._count.bookings > 0) continue; // never touch a booked trip
            const slot = existing.slots.find((s) => s.id === d.scheduleSlotId);
            const incoming = slot ? bySlotNo.get(slot.slotNo) : undefined;
            const weekdays = incoming?.weekdays ?? [];
            const dow = d.startDate.getUTCDay();

            if (!weekdays.includes(dow)) {
              // Owner removed this weekday → cancel the unbooked departure.
              await tx.tripDeparture.update({
                where: { id: d.id },
                data: { status: 'cancelled' },
              });
            } else {
              // Still runs — push any time/pricing changes onto the unbooked row.
              await tx.tripDeparture.update({
                where: { id: d.id },
                data: {
                  departureTime:
                    this.trips.timeToDate(incoming?.departureTime) ?? null,
                  pricingProfileId: incoming?.pricingProfileId ?? null,
                },
              });
            }
          }
        }
      });
    }

    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'schedule_save',
      entityType: 'boat_schedule',
      entityId: scheduleId,
      after: { packageId: dto.packageId, slots: dto.slots.length },
    });

    const generated = await this.generateForSchedule(scheduleId);
    return { ...(await this.getSchedule(houseboatId)), generated };
  }

  /** Generate the rolling window for one schedule. Returns count created. */
  async generateForSchedule(scheduleId: string): Promise<number> {
    const schedule = await this.prisma.boatSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        slots: true,
        package: { select: { id: true, durationDays: true } },
      },
    });
    if (!schedule || !schedule.active) return 0;

    const boat = await this.prisma.houseboat.findUnique({
      where: { id: schedule.houseboatId },
      select: { operatingDates: true, defaultCrew: true },
    });
    if (!boat) return 0;

    const operating = new Set(
      boat.operatingDates.map((d) => d.toISOString().slice(0, 10)),
    );
    const defaultCrew = (boat.defaultCrew ?? []) as string[];
    const availableCount = await this.trips.totalCabinCount(schedule.houseboatId);

    // Candidate (slot, date) pairs across the window whose weekday matches and
    // whose date is an operating date.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const candidates: {
      slotId: string;
      slotNo: number;
      date: Date;
      iso: string;
      departureTime: Date | null;
      pricingProfileId: string | null;
    }[] = [];

    for (let i = 0; i < this.WINDOW_DAYS; i++) {
      const date = new Date(today);
      date.setUTCDate(date.getUTCDate() + i);
      const iso = date.toISOString().slice(0, 10);
      if (!operating.has(iso)) continue;
      const dow = date.getUTCDay();
      for (const slot of schedule.slots) {
        if (slot.weekdays.includes(dow)) {
          candidates.push({
            slotId: slot.id,
            slotNo: slot.slotNo,
            date,
            iso,
            departureTime: slot.departureTime,
            pricingProfileId: slot.pricingProfileId,
          });
        }
      }
    }
    if (candidates.length === 0) return 0;

    // Skip candidates already generated for this slot (idempotent refill).
    const slotIds = [...new Set(candidates.map((c) => c.slotId))];
    const existing = await this.prisma.tripDeparture.findMany({
      where: {
        scheduleSlotId: { in: slotIds },
        startDate: { gte: today },
      },
      select: { scheduleSlotId: true, startDate: true },
    });
    const existingKeys = new Set(
      existing.map((e) => `${e.scheduleSlotId}|${e.startDate.toISOString().slice(0, 10)}`),
    );

    const toCreate = candidates.filter(
      (c) => !existingKeys.has(`${c.slotId}|${c.iso}`),
    );
    if (toCreate.length === 0) return 0;

    let created = 0;
    // One transaction per departure keeps a bad row from failing the whole batch.
    for (const c of toCreate) {
      await this.prisma.$transaction((tx: Prisma.TransactionClient) =>
        this.trips.createDepartureCore(tx, {
          houseboatId: schedule.houseboatId,
          packageId: schedule.package.id,
          durationDays: schedule.package.durationDays,
          startDate: c.date,
          departureTime: c.departureTime ?? undefined,
          pricingProfileId: c.pricingProfileId,
          scheduleSlotId: c.slotId,
          availableCount,
          defaultCrew,
        }),
      );
      created++;
    }
    return created;
  }

  /** Daily refill: keep the rolling window populated for every active schedule. */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async refillAll(): Promise<void> {
    const schedules = await this.prisma.boatSchedule.findMany({
      where: { active: true },
      select: { id: true },
    });
    let total = 0;
    for (const s of schedules) {
      total += await this.generateForSchedule(s.id).catch(() => 0);
    }
    if (total) this.logger.debug(`Schedule refill: ${total} departures generated`);
  }
}
