import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityGateway } from '../realtime/availability.gateway';
import { SettingsService } from '../platform/settings/settings.service';
import { HOLD_GRACE_MIN } from './holds.service';

/**
 * Reclaims holds that are no longer live, on two independent rules:
 *   1. expires_at has passed — the hard TTL.
 *   2. the page holding them stopped heartbeating for HOLD_GRACE_MIN — an
 *      abandoned tab, which would otherwise sit on the cabins until (1).
 *
 * Runs every minute. Idempotent: only flips rows still in state='held', and
 * increments available_count exactly once per released hold — a second run finds
 * nothing to do (plan §2).
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
    // @Optional() so the unit test can construct the sweeper with two positional
    // args; falls back to the compiled-in grace constant when absent.
    @Optional() private readonly settings?: SettingsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sweep(): Promise<void> {
    const now = new Date();
    const graceMin =
      (await this.settings?.getNumber('hold.graceMin')) ?? HOLD_GRACE_MIN;
    const staleBefore = new Date(now.getTime() - graceMin * 60_000);
    // Process in one transaction per batch so count updates stay consistent.
    const reclaimable = await this.prisma.cabinHold.findMany({
      where: {
        state: 'held',
        OR: [
          // Hard deadline: the hold ran out of time.
          { expiresAt: { lte: now } },
          // Abandoned page: it was reporting in, then went quiet. This is what
          // frees cabins when a tab is closed, since unload events cannot be
          // relied on.
          //
          // A hold that never reported (last_seen_at NULL) is NOT stale — the
          // owner POS takes holds through the same endpoint as customers and
          // never heartbeats, so cancelling those would kill counter sales
          // mid-transaction. SQL already guarantees this (NULL < ts is never
          // true, so a NULL row cannot match `lt`); `not: null` states the
          // requirement explicitly so a future edit cannot quietly lose it.
          { lastSeenAt: { not: null, lt: staleBefore } },
        ],
      },
      select: { id: true, departureId: true, cabinId: true },
      take: 500,
    });
    if (reclaimable.length === 0) return;

    const touched = new Set<string>();
    for (const hold of reclaimable) {
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
    this.logger.debug(`Swept ${reclaimable.length} stale/expired hold(s)`);
  }
}
