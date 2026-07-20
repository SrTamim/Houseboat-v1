import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityGateway } from '../realtime/availability.gateway';

/**
 * Releases holds whose expires_at has passed. Runs every minute. Idempotent:
 * only flips rows still in state='held', and increments available_count exactly
 * once per released hold — a second run finds nothing to do (plan §2).
 *
 * Server time is authoritative; a manipulated device clock cannot keep a hold
 * alive past its server-computed expiry.
 */
@Injectable()
export class HoldSweeperService {
  private readonly logger = new Logger(HoldSweeperService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: AvailabilityGateway,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sweep(): Promise<void> {
    const now = new Date();
    // Process in one transaction per batch so count updates stay consistent.
    const expired = await this.prisma.cabinHold.findMany({
      where: { state: 'held', expiresAt: { lte: now } },
      select: { id: true, departureId: true, cabinId: true },
      take: 500,
    });
    if (expired.length === 0) return;

    const touched = new Set<string>();
    for (const hold of expired) {
      const didRelease = await this.prisma.$transaction(async (tx) => {
        // Re-check state inside the tx — another worker may have got here first.
        const fresh = await tx.cabinHold.findUnique({
          where: { id: hold.id },
          select: { state: true },
        });
        if (!fresh || fresh.state !== 'held') return false;
        await tx.cabinHold.update({
          where: { id: hold.id },
          data: { state: 'released' },
        });
        await tx.tripDeparture.update({
          where: { id: hold.departureId },
          data: { availableCount: { increment: 1 } },
        });
        return true;
      });
      if (didRelease) {
        touched.add(hold.departureId);
        this.realtime.emitCabinState(hold.departureId, hold.cabinId, 'released');
      }
    }

    // Emit fresh counts once per affected departure.
    for (const departureId of touched) {
      const dep = await this.prisma.tripDeparture.findUnique({
        where: { id: departureId },
        select: { availableCount: true },
      });
      if (dep) this.realtime.emitAvailability(departureId, dep.availableCount);
    }
    this.logger.debug(`Swept ${expired.length} expired hold(s)`);
  }
}
