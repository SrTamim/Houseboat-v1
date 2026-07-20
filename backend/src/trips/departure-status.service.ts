import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Time-driven departure status (plan §7). Status advances by the clock, never
 * manually: once the departure datetime passes → in_progress; once the arrival
 * datetime passes → completed. Runs every 5 minutes.
 *
 * Dates are stored as @db.Date and times as @db.Time separately; we combine them
 * (falling back to start/end of day when a time isn't set) to get the instant.
 */
@Injectable()
export class DepartureStatusService {
  private readonly logger = new Logger(DepartureStatusService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Combine a Date (day) with an optional Time into one instant. */
  private combine(day: Date, time: Date | null, endOfDay = false): Date {
    const d = new Date(day);
    if (time) {
      d.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0, 0);
    } else if (endOfDay) {
      d.setUTCHours(23, 59, 59, 999);
    } else {
      d.setUTCHours(0, 0, 0, 0);
    }
    return d;
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async advance(): Promise<void> {
    const now = new Date();

    // scheduled → in_progress once the departure instant has passed.
    const scheduled = await this.prisma.tripDeparture.findMany({
      where: { status: 'scheduled' },
      select: { id: true, startDate: true, departureTime: true },
      take: 1000,
    });
    let started = 0;
    for (const dep of scheduled) {
      const departAt = this.combine(dep.startDate, dep.departureTime);
      if (departAt <= now) {
        await this.prisma.tripDeparture.updateMany({
          where: { id: dep.id, status: 'scheduled' },
          data: { status: 'in_progress' },
        });
        started++;
      }
    }

    // in_progress → completed once the arrival instant has passed.
    const running = await this.prisma.tripDeparture.findMany({
      where: { status: 'in_progress' },
      select: { id: true, startDate: true, endDate: true, arrivalTime: true },
      take: 1000,
    });
    let completed = 0;
    for (const dep of running) {
      const arriveDay = dep.endDate ?? dep.startDate;
      const arriveAt = this.combine(arriveDay, dep.arrivalTime, true);
      if (arriveAt <= now) {
        await this.prisma.tripDeparture.updateMany({
          where: { id: dep.id, status: 'in_progress' },
          data: { status: 'completed' },
        });
        completed++;
      }
    }

    if (started || completed) {
      this.logger.debug(
        `Departure status: ${started} started, ${completed} completed`,
      );
    }
  }
}
