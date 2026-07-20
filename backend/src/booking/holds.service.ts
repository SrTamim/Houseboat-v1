import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AvailabilityGateway } from '../realtime/availability.gateway';
import { newId } from '../common/uuid';

export const HOLD_TTL_MIN = 10;
export const HOLD_PAYMENT_EXTENSION_MIN = 5;
/** Per-cabin hold-attempt rate limit — absorbs the waitlist click spike (§2). */
const HOLD_RATE_WINDOW_SEC = 10;
const HOLD_RATE_MAX = 5;

/**
 * Cabin holds — the mechanism that makes double-booking impossible (plan §2).
 *
 * The partial unique index `uq_cabin_hold_active (cabin_id, departure_id) WHERE
 * state='held'` means a second simultaneous INSERT for the same cabin+departure
 * fails at the DB with a unique violation. We catch P2002 and surface "just
 * taken" — we DO NOT retry. available_count is decremented in the SAME
 * transaction so search stays a single lookup.
 *
 * The server clock is authoritative: expires_at is computed here, never trusted
 * from the device.
 */
@Injectable()
export class HoldsService {
  private readonly logger = new Logger(HoldsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly realtime: AvailabilityGateway,
  ) {}

  /** Sliding-window rate limit per cabin. Skips silently if Redis is down. */
  private async assertHoldRate(cabinId: string): Promise<void> {
    const client = this.redis.instance;
    if (!client) return;
    const key = `holdrate:${cabinId}`;
    try {
      const n = await client.incr(key);
      if (n === 1) await client.expire(key, HOLD_RATE_WINDOW_SEC);
      if (n > HOLD_RATE_MAX) {
        throw new ConflictException('Too many attempts — please wait a moment');
      }
    } catch (e) {
      if (e instanceof ConflictException) throw e;
      // Redis error → don't block booking.
    }
  }

  /**
   * Take a hold on one cabin for a departure. Throws ConflictException("just
   * taken") if another party holds/booked it. Extends a shared cart expiry by
   * returning the new expires_at so the client counts down from the server.
   */
  async hold(cabinId: string, departureId: string, heldBy: string) {
    await this.assertHoldRate(cabinId);
    const expiresAt = new Date(Date.now() + HOLD_TTL_MIN * 60_000);
    try {
      const held = await this.prisma.$transaction(async (tx) => {
        const dep = await tx.tripDeparture.findUnique({
          where: { id: departureId },
          select: { status: true, availableCount: true },
        });
        if (!dep) throw new NotFoundException('Departure not found');
        if (dep.status !== 'scheduled') {
          throw new ConflictException('This departure is no longer bookable');
        }
        if (dep.availableCount <= 0) {
          throw new ConflictException('No cabins available on this departure');
        }

        const created = await tx.cabinHold.create({
          data: {
            id: newId(),
            cabinId,
            departureId,
            heldBy,
            expiresAt,
            state: 'held',
          },
        });

        // Shared cart expiry (plan §2): all of this caller's active holds on this
        // departure share ONE countdown, extended to the newest hold. Sweep the
        // whole cart onto the new expires_at.
        await tx.cabinHold.updateMany({
          where: { departureId, heldBy, state: 'held' },
          data: { expiresAt },
        });

        // Same transaction: reflect the taken cabin in denormalized availability.
        const dep2 = await tx.tripDeparture.update({
          where: { id: departureId },
          data: { availableCount: { decrement: 1 } },
          select: { availableCount: true },
        });

        return {
          id: created.id,
          expiresAt,
          availableCount: dep2.availableCount,
        };
      });

      // Fan out the availability change to everyone watching this departure.
      this.realtime.emitCabinState(departureId, cabinId, 'held');
      this.realtime.emitAvailability(departureId, held.availableCount);
      return { id: held.id, expiresAt: held.expiresAt };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        // Partial unique index tripped — someone else holds this cabin. Do NOT retry.
        throw new ConflictException('That cabin was just taken');
      }
      throw e;
    }
  }

  /** Release a held cabin (payment failed, or user removed it). Idempotent. */
  async release(holdId: string) {
    const released = await this.prisma.$transaction(async (tx) => {
      const hold = await tx.cabinHold.findUnique({ where: { id: holdId } });
      if (!hold || hold.state !== 'held') return null; // already resolved — no-op
      await tx.cabinHold.update({
        where: { id: holdId },
        data: { state: 'released' },
      });
      const dep = await tx.tripDeparture.update({
        where: { id: hold.departureId },
        data: { availableCount: { increment: 1 } },
        select: { availableCount: true },
      });
      return {
        departureId: hold.departureId,
        cabinId: hold.cabinId,
        availableCount: dep.availableCount,
      };
    });

    if (released) {
      this.realtime.emitCabinState(released.departureId, released.cabinId, 'released');
      this.realtime.emitAvailability(released.departureId, released.availableCount);
    }
  }

  /** Extend a hold once on payment initiation (+5 min) to cover the gateway round-trip. */
  async extendForPayment(holdId: string) {
    const newExpiry = new Date(
      Date.now() + HOLD_PAYMENT_EXTENSION_MIN * 60_000,
    );
    await this.prisma.cabinHold.updateMany({
      where: { id: holdId, state: 'held' },
      data: { expiresAt: newExpiry },
    });
    return newExpiry;
  }

  /** Active holds for a user on a departure (their cart). */
  listActive(departureId: string, heldBy: string) {
    return this.prisma.cabinHold.findMany({
      where: { departureId, heldBy, state: 'held', expiresAt: { gt: new Date() } },
    });
  }
}
