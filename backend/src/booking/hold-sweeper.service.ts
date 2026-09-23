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
  /** Re-entrancy guard: skip a tick if the previous sweep is still running. */
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: AvailabilityGateway,
    // @Optional() so the unit test can construct the sweeper with two positional
    // args; falls back to the compiled-in grace constant when absent.
    @Optional() private readonly settings?: SettingsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sweep(): Promise<void> {
    // If a previous minute's sweep is still going (a large backlog under load),
    // don't start a second concurrent one — it would double the DB load and race
    // on the same holds. Just skip; the next tick picks up whatever remains.
    if (this.running) return;
    this.running = true;
    try {
      await this.runSweep();
    } finally {
      this.running = false;
    }
  }

  private async runSweep(): Promise<void> {
    const now = new Date();

    // Expire abandoned booking intents (audit M-H2): a checkout that was priced
    // but never paid. The cabins it referenced are freed by the hold sweep below
    // (the intent holds no inventory itself), so this is bookkeeping — it stops a
    // late payment from trying to build a booking on lapsed holds and keeps the
    // table from growing. Idempotent: only touches rows still 'requested'.
    await this.prisma.bookingIntent.updateMany({
      where: { status: 'requested', expiresAt: { lte: now } },
      data: { status: 'expired' },
    });

    const graceMin =
      (await this.settings?.getNumber('hold.graceMin')) ?? HOLD_GRACE_MIN;
    const staleBefore = new Date(now.getTime() - graceMin * 60_000);
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

    // Group the reclaimable holds by departure so each departure is touched once.
    const byDeparture = new Map<
      string,
      { ids: string[]; cabinIds: string[] }
    >();
    for (const h of reclaimable) {
      const g = byDeparture.get(h.departureId) ?? { ids: [], cabinIds: [] };
      g.ids.push(h.id);
      g.cabinIds.push(h.cabinId);
      byDeparture.set(h.departureId, g);
    }

    // One transaction per departure instead of one per hold: release all its
    // still-held rows in a single updateMany (the state='held' filter keeps it
    // idempotent — another worker that already released some won't be
    // double-counted), then bump availableCount by the number ACTUALLY released.
    let released = 0;
    for (const [departureId, g] of byDeparture) {
      const count = await this.prisma.$transaction(async (tx) => {
        const res = await tx.cabinHold.updateMany({
          where: { id: { in: g.ids }, state: 'held' },
          data: { state: 'released' },
        });
        if (res.count > 0) {
          await tx.tripDeparture.update({
            where: { id: departureId },
            data: { availableCount: { increment: res.count } },
          });
        }
        return res.count;
      });
      if (count === 0) continue;
      released += count;
      for (const cabinId of g.cabinIds) {
        this.realtime.emitCabinState(departureId, cabinId, 'released');
      }
      const dep = await this.prisma.tripDeparture.findUnique({
        where: { id: departureId },
        select: { availableCount: true },
      });
      if (dep) this.realtime.emitAvailability(departureId, dep.availableCount);
    }
    this.logger.debug(`Swept ${released} stale/expired hold(s)`);
  }

  /** Re-entrancy guard for the reconciliation pass. */
  private reconciling = false;

  /**
   * Nightly reconciliation of the denormalized TripDeparture.availableCount
   * against the live cabin state (audit backstop).
   *
   * availableCount is a cache maintained by increments/decrements across holds,
   * conversions, cancellations and buyouts. The per-cabin unique index is what
   * actually prevents double-booking, so a drifted counter can only mis-display
   * (a stale/negative count, a fully-booked trip advertising a cabin) — never
   * oversell. This recomputes the truth — cabins with no live booking AND no
   * unexpired hold, counting an open-seat cabin with spare places as free — and
   * corrects any departure whose stored count disagrees. Same rule the waitlist
   * recompute and the boat-page snapshot use.
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async reconcileAvailability(): Promise<void> {
    if (this.reconciling) return;
    this.reconciling = true;
    try {
      await this.runReconcile();
    } finally {
      this.reconciling = false;
    }
  }

  private async runReconcile(): Promise<void> {
    const now = new Date();
    // Only future/active trips matter for availability display.
    const departures = await this.prisma.tripDeparture.findMany({
      where: { status: 'scheduled' },
      select: {
        id: true,
        availableCount: true,
        package: {
          select: {
            houseboat: {
              select: {
                decks: {
                  select: {
                    cabins: {
                      select: {
                        id: true,
                        category: {
                          select: { baseCapacity: true, extendedCapacity: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      take: 2000,
    });
    if (departures.length === 0) return;

    const depIds = departures.map((d) => d.id);
    const [bookingCabins, holds] = await Promise.all([
      this.prisma.bookingCabin.findMany({
        where: {
          booking: { departureId: { in: depIds }, status: { not: 'cancelled' } },
        },
        select: {
          cabinId: true,
          occupancy: true,
          isOpenSeat: true,
          booking: { select: { departureId: true } },
        },
      }),
      this.prisma.cabinHold.findMany({
        where: { departureId: { in: depIds }, state: 'held', expiresAt: { gt: now } },
        select: { cabinId: true, departureId: true },
      }),
    ]);

    const heldByDep = new Map<string, Set<string>>();
    for (const h of holds) {
      const s = heldByDep.get(h.departureId) ?? new Set<string>();
      s.add(h.cabinId);
      heldByDep.set(h.departureId, s);
    }
    const bookedByDep = new Map<
      string,
      Map<string, { occupancy: number; isOpenSeat: boolean }>
    >();
    for (const bc of bookingCabins) {
      const depId = bc.booking.departureId;
      if (!depId) continue;
      const m = bookedByDep.get(depId) ?? new Map();
      m.set(bc.cabinId, { occupancy: bc.occupancy, isOpenSeat: bc.isOpenSeat });
      bookedByDep.set(depId, m);
    }

    let fixed = 0;
    for (const dep of departures) {
      const held = heldByDep.get(dep.id) ?? new Set<string>();
      const booked = bookedByDep.get(dep.id) ?? new Map();
      const cabins =
        dep.package?.houseboat?.decks.flatMap((d) => d.cabins) ?? [];
      let free = 0;
      for (const cabin of cabins) {
        if (held.has(cabin.id)) continue;
        const bc = booked.get(cabin.id);
        if (!bc) {
          free += 1;
        } else if (bc.isOpenSeat) {
          const cap =
            cabin.category.extendedCapacity ?? cabin.category.baseCapacity;
          if (cap - bc.occupancy > 0) free += 1;
        }
      }
      if (free !== dep.availableCount) {
        await this.prisma.tripDeparture.update({
          where: { id: dep.id },
          data: { availableCount: free },
        });
        this.realtime.emitAvailability(dep.id, free);
        fixed += 1;
      }
    }
    if (fixed > 0) {
      this.logger.warn(`Reconciled availableCount on ${fixed} departure(s)`);
    }
  }
}
