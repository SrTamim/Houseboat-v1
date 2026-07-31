import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ThrottlerStorage } from '@nestjs/throttler';
// Not re-exported from the package root in v6.
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { RedisService } from '../redis/redis.service';

/**
 * Redis-backed throttler storage.
 *
 * The default in-memory storage is per-process and resets on deploy, so limits
 * are neither shared across instances nor durable. Rate limits are a security
 * control here (credential stuffing on /auth/login, abuse of money routes), so
 * they live in Redis alongside the refresh-token deny-list.
 *
 * Fail-CLOSED in production on Redis errors, matching RedisService's revocation
 * semantics: if we cannot count a request we report the limit as exceeded
 * rather than waving traffic through. Redis is already load-bearing in prod
 * (token refresh fails closed without it), so this costs no extra availability.
 *
 * In development it fails OPEN instead — Redis is frequently not running
 * locally, and blocking every request would make the app unusable offline.
 */
@Injectable()
export class ThrottlerRedisStorage implements ThrottlerStorage {
  private readonly logger = new Logger(ThrottlerRedisStorage.name);
  private readonly failClosed: boolean;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.failClosed = config.get<string>('env') === 'production';
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const client = this.redis.instance;
    if (!client) return this.degraded(ttl, blockDuration);

    // ttl/blockDuration arrive in milliseconds; Redis PEXPIRE wants the same.
    const hitKey = `throttle:${throttlerName}:${key}`;
    const blockKey = `${hitKey}:blocked`;

    try {
      // Serve an active block without counting the request against the window.
      const blockTtl = await client.pttl(blockKey);
      if (blockTtl > 0) {
        return {
          totalHits: limit + 1,
          timeToExpire: Math.ceil(blockTtl / 1000),
          isBlocked: true,
          timeToBlockExpire: Math.ceil(blockTtl / 1000),
        };
      }

      // INCR then set the expiry only on first hit, so the window is fixed
      // rather than sliding forward with every request.
      const [[, hits], [, pttl]] = (await client
        .multi()
        .incr(hitKey)
        .pttl(hitKey)
        .exec()) as [[Error | null, number], [Error | null, number]];

      let timeToExpire = pttl;
      if (pttl < 0) {
        await client.pexpire(hitKey, ttl);
        timeToExpire = ttl;
      }

      if (hits > limit) {
        // Past the limit: start the block window if one is configured.
        if (blockDuration > 0) {
          await client.set(blockKey, '1', 'PX', blockDuration, 'NX');
          return {
            totalHits: hits,
            timeToExpire: Math.ceil(blockDuration / 1000),
            isBlocked: true,
            timeToBlockExpire: Math.ceil(blockDuration / 1000),
          };
        }
        return {
          totalHits: hits,
          timeToExpire: Math.ceil(timeToExpire / 1000),
          isBlocked: true,
          timeToBlockExpire: Math.ceil(timeToExpire / 1000),
        };
      }

      return {
        totalHits: hits,
        timeToExpire: Math.ceil(timeToExpire / 1000),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    } catch (e) {
      this.logger.warn(
        `Throttler storage unavailable (fail-${this.failClosed ? 'closed' : 'open'}): ${(e as Error).message}`,
      );
      return this.degraded(ttl, blockDuration);
    }
  }

  /**
   * Record used when Redis is unreachable. Blocks in production (rate limiting
   * is a security control), allows in dev (Redis is often not running).
   */
  private degraded(ttl: number, blockDuration: number): ThrottlerStorageRecord {
    const seconds = Math.ceil((blockDuration || ttl) / 1000);
    if (!this.failClosed) {
      return {
        totalHits: 0,
        timeToExpire: seconds,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
    return {
      totalHits: Number.MAX_SAFE_INTEGER,
      timeToExpire: seconds,
      isBlocked: true,
      timeToBlockExpire: seconds,
    };
  }
}
