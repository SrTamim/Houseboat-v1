import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AvailabilityGateway } from '../realtime/availability.gateway';
import { SettingsService } from '../platform/settings/settings.service';
import { newId } from '../common/uuid';

/**
 * Defaults for the hold timers. These are now admin-editable via SettingsService
 * (keys hold.ttlMin / hold.checkoutExtensionMin); the constants remain the
 * fallback the settings registry mirrors, and specs still import them.
 */
export const HOLD_TTL_MIN = 10;
/** One-off grant when the guest reaches checkout, ADDED to the time remaining. */
export const HOLD_CHECKOUT_EXTENSION_MIN = 10;
/**
 * How long a hold may go without a heartbeat before the sweeper reclaims it.
 *
 * Two minutes, not thirty seconds: Chrome throttles background timers to once a
 * minute after a tab has been hidden a while, so a 30s heartbeat still lands
 * ~2 pings inside this window. A tighter grace would punish a guest who simply
 * switched apps mid-booking.
 */
export const HOLD_GRACE_MIN = 2;
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
    // @Optional() so the unit tests (booking.idor.spec, holds.extension.spec)
    // can construct HoldsService with three positional args; each read falls
    // back to the compiled-in constant when the service is absent.
    @Optional() private readonly settings?: SettingsService,
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
  async hold(
    cabinId: string,
    departureId: string,
    heldBy: string | null,
    /**
     * Guest owner, when the caller is not signed in. Exactly one of heldBy /
     * heldByToken is set — the DB enforces it (cabin_hold_one_owner). Appended
     * as an optional 4th argument so existing callers (owner POS,
     * owner-bookings.service.ts) are unaffected.
     */
    heldByToken?: string | null,
    /**
     * Cap on how many cabins this caller may hold at once on this departure.
     * Opt-in: the customer routes pass MAX_CABINS_PER_BOOKING, the owner POS
     * passes nothing — counter staff legitimately sell more cabins than a
     * self-service booking allows.
     */
    maxCabins?: number,
  ) {
    if (!heldBy === !heldByToken) {
      throw new ConflictException('A hold needs exactly one owner');
    }
    await this.assertHoldRate(cabinId);
    const ttlMin =
      (await this.settings?.getNumber('hold.ttlMin')) ?? HOLD_TTL_MIN;
    const expiresAt = new Date(Date.now() + ttlMin * 60_000);
    // Whose cart this hold joins — an account's or a browser's.
    const owner = heldBy ? { heldBy } : { heldByToken };
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

        // Per-booking cabin cap. Counted inside the transaction so two fast
        // clicks cannot both read "3 held" and both insert a 4th.
        //
        // `maxCabins` from the caller is the ceiling (the DTO's hard cap). The
        // admin-editable booking.maxCabins may only TIGHTEN it — clamp to the
        // smaller of the two so an operational setting can never raise the cap
        // above the request-validation ceiling. Owner POS passes null and stays
        // uncapped regardless of the setting.
        if (maxCabins != null) {
          const editable =
            (await this.settings?.getNumber('booking.maxCabins')) ?? maxCabins;
          const effectiveCap = Math.min(maxCabins, editable);
          const alreadyHeld = await tx.cabinHold.count({
            where: {
              departureId,
              ...owner,
              state: 'held',
              expiresAt: { gt: new Date() },
            },
          });
          if (alreadyHeld >= effectiveCap) {
            throw new ConflictException(
              `You can book up to ${effectiveCap} cabins per booking`,
            );
          }
        }

        // If this cart already runs longer than a fresh 10 minutes — it was
        // extended at checkout — the new cabin joins THAT deadline instead of
        // dragging the cart back to its own.
        const longest = await tx.cabinHold.aggregate({
          where: {
            departureId,
            ...owner,
            state: 'held',
            expiresAt: { gt: expiresAt },
          },
          _max: { expiresAt: true },
        });
        const cartExpiresAt = longest._max.expiresAt ?? expiresAt;

        const created = await tx.cabinHold.create({
          data: {
            id: newId(),
            cabinId,
            departureId,
            ...owner,
            expiresAt: cartExpiresAt,
            state: 'held',
          },
        });

        // Shared cart expiry (plan §2): all of this caller's active holds on this
        // departure share ONE countdown, extended to the newest hold. Sweep the
        // whole cart onto the new expires_at. Scoped by whichever owner applies,
        // so a guest's cabins share one countdown exactly as an account's do.
        //
        // Never sweep BACKWARDS past a granted checkout extension: an extended
        // cart sits at up to 20 minutes, so a plain 10-minute hold taken
        // afterwards would silently claw that time back — and extended_at is
        // already spent, so the guest could not win it again.
        await tx.cabinHold.updateMany({
          where: {
            departureId,
            ...owner,
            state: 'held',
            expiresAt: { lt: cartExpiresAt },
          },
          data: { expiresAt: cartExpiresAt },
        });

        // Same transaction: reflect the taken cabin in denormalized availability.
        const dep2 = await tx.tripDeparture.update({
          where: { id: departureId },
          data: { availableCount: { decrement: 1 } },
          select: { availableCount: true },
        });

        return {
          id: created.id,
          // The cart's shared deadline, which may be later than this hold's own
          // 10 minutes if the cart was already extended. The client counts down
          // to what it gets back here.
          expiresAt: cartExpiresAt,
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

  /**
   * Release a held cabin (payment failed, or user removed it). Idempotent.
   *
   * `actorId` is the caller: a live hold may only be released by the account that
   * took it (else any authenticated user could release anyone's hold and grief
   * availability). An already-resolved/absent hold stays a silent no-op so the
   * idempotent contract holds. Pass `isPlatform` for staff/POS override.
   */
  async release(
    holdId: string,
    actorId: string | null,
    isPlatform = false,
    /** Guest caller's hb_gid, when not signed in. */
    actorToken?: string | null,
  ) {
    const released = await this.prisma.$transaction(async (tx) => {
      const hold = await tx.cabinHold.findUnique({ where: { id: holdId } });
      if (!hold || hold.state !== 'held') return null; // already resolved — no-op
      // A guest may only release the holds their own browser took; the token is
      // matched exactly as an account id is, so one visitor cannot free
      // another's cabins.
      const owns = hold.heldBy
        ? actorId != null && hold.heldBy === actorId
        : actorToken != null && hold.heldByToken === actorToken;
      if (!owns && !isPlatform) {
        throw new ForbiddenException('This hold belongs to another account');
      }
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

  /**
   * Grant the one checkout extension for a caller's whole cart on a departure.
   *
   * Additive, not absolute: +10 min on top of whatever is LEFT, so a hold with
   * 8 minutes remaining goes to 18, never down to 10. Cart-scoped because
   * hold() keeps every hold of one owner on one departure on a single shared
   * expiry (see the sweep above) — extending one row would desync the
   * countdown the client displays.
   *
   * Once only, enforced by extended_at rather than by the client: reloading
   * checkout calls this again and gets the unchanged expiry back, so the worst
   * case life of a hold is 20 minutes, not unbounded.
   */
  async extendForCheckout(
    departureId: string,
    heldBy: string | null,
    heldByToken?: string | null,
  ): Promise<{ expiresAt: Date; extended: boolean }> {
    const owner = heldBy ? { heldBy } : { heldByToken };
    return this.prisma.$transaction(async (tx) => {
      const holds = await tx.cabinHold.findMany({
        where: {
          departureId,
          ...owner,
          state: 'held',
          expiresAt: { gt: new Date() },
        },
        select: { expiresAt: true, extendedAt: true },
      });
      if (holds.length === 0) {
        // Nothing live to extend — the sweeper already took them, or this
        // caller never held anything here. The client sends the guest back to
        // the boat page rather than failing later at checkout.
        throw new ConflictException('Your cabin hold has expired');
      }

      // The cart shares one expiry, but read the max defensively so a partial
      // row never shortens the others.
      const current = holds.reduce(
        (max, h) => (h.expiresAt > max ? h.expiresAt : max),
        holds[0].expiresAt,
      );
      // Any row already stamped means the grant is spent for this cart.
      if (holds.some((h) => h.extendedAt != null)) {
        return { expiresAt: current, extended: false };
      }

      const extensionMin =
        (await this.settings?.getNumber('hold.checkoutExtensionMin')) ??
        HOLD_CHECKOUT_EXTENSION_MIN;
      const expiresAt = new Date(current.getTime() + extensionMin * 60_000);
      await tx.cabinHold.updateMany({
        where: { departureId, ...owner, state: 'held' },
        data: { expiresAt, extendedAt: new Date() },
      });
      return { expiresAt, extended: true };
    });
  }

  /**
   * "I am still here" — stamp lastSeenAt on this caller's live holds.
   *
   * The page holding cabins calls this every ~30s. The sweeper reclaims holds
   * whose heartbeat has gone quiet for HOLD_GRACE_MIN, which is what lets a
   * closed tab free its cabins in ~2 minutes instead of the full TTL.
   *
   * Deliberately does NOT touch expiresAt: presence is not entitlement, and a
   * parked tab must still hit its 10-minute deadline. Returns the unchanged
   * expiry so the client can correct clock drift for free.
   *
   * Owner-scoped exactly like extendForCheckout, so one caller can never keep
   * another's holds alive.
   */
  async touchHolds(
    departureId: string,
    heldBy: string | null,
    heldByToken?: string | null,
  ): Promise<{ ok: boolean; expiresAt: Date | null }> {
    const owner = heldBy ? { heldBy } : { heldByToken };
    const now = new Date();
    const { count } = await this.prisma.cabinHold.updateMany({
      where: {
        departureId,
        ...owner,
        state: 'held',
        expiresAt: { gt: now },
      },
      data: { lastSeenAt: now },
    });
    if (count === 0) return { ok: false, expiresAt: null };
    // The cart shares one expiry; read it back so the client stays in sync.
    const live = await this.prisma.cabinHold.findFirst({
      where: { departureId, ...owner, state: 'held', expiresAt: { gt: now } },
      select: { expiresAt: true },
      orderBy: { expiresAt: 'desc' },
    });
    return { ok: true, expiresAt: live?.expiresAt ?? null };
  }

  /** Active holds for a caller on a departure (their cart), account or guest. */
  listActive(
    departureId: string,
    heldBy: string | null,
    heldByToken?: string | null,
  ) {
    const owner = heldBy ? { heldBy } : { heldByToken };
    return this.prisma.cabinHold.findMany({
      where: { departureId, ...owner, state: 'held', expiresAt: { gt: new Date() } },
    });
  }

  /**
   * Transfer a browser's live holds onto the account that just signed in.
   *
   * Load-bearing: BookingService.checkout() converts holds with
   * `heldBy: bookedBy`, so a hold still owned by a token would match nothing and
   * the customer's own checkout would fail with "a held cabin expired or was
   * taken". Called right after login, before checkout can submit.
   *
   * Only live holds move. Expired/released/converted rows are history and stay
   * attributed to the guest session that made them.
   */
  async claimForAccount(token: string, accountId: string): Promise<number> {
    const { count } = await this.prisma.cabinHold.updateMany({
      where: { heldByToken: token, state: 'held', expiresAt: { gt: new Date() } },
      data: { heldBy: accountId, heldByToken: null },
    });
    if (count > 0) {
      this.logger.log(`Claimed ${count} guest hold(s) for account ${accountId}`);
    }
    return count;
  }

  /**
   * All still-live holds on a departure, regardless of who took them. Lets the
   * counter-sale grid show cabins another operator is holding as unavailable
   * before the socket delivers the live 'held' event.
   */
  listActiveForDeparture(departureId: string) {
    return this.prisma.cabinHold.findMany({
      where: { departureId, state: 'held', expiresAt: { gt: new Date() } },
      select: { cabinId: true, heldBy: true, expiresAt: true },
    });
  }
}
