import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis wrapper. Used for caching, distributed rate-limiting, and coordinating
 * the hold sweeper across instances. Degrades gracefully: if Redis is down in
 * dev the app still boots; callers must tolerate a null client.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>('redis.url');
    if (!url) {
      this.logger.warn('No REDIS_URL — Redis features disabled');
      return;
    }
    this.client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
    });
    this.client.on('error', (e) => this.logger.warn(`Redis: ${e.message}`));
    this.client.connect().catch(() => {
      this.logger.warn('Redis connect failed — features disabled until it is up');
    });
  }

  onModuleDestroy(): void {
    this.client?.disconnect();
  }

  /** May be null if Redis is unavailable. Callers must handle that. */
  get instance(): Redis | null {
    return this.client;
  }

  // ── Refresh-token revocation (jti deny-list) ──────────────────────────
  // Fail-CLOSED: if Redis is unreachable we cannot prove a token is valid, so
  // callers treat "unknown" as revoked. Losing the ability to refresh during an
  // outage is acceptable; silently honoring a stolen token is not.

  private revokedKey(jti: string): string {
    return `revoked:refresh:${jti}`;
  }

  /** Mark a refresh jti revoked until it would have expired anyway (ttl secs). */
  async revokeRefreshJti(jti: string, ttlSeconds: number): Promise<void> {
    if (!this.client) {
      throw new Error('Revocation store unavailable');
    }
    await this.client.set(this.revokedKey(jti), '1', 'EX', Math.max(ttlSeconds, 1));
  }

  /** True if this jti was revoked, OR if the store can't be reached (fail-closed). */
  async isRefreshJtiRevoked(jti: string): Promise<boolean> {
    if (!this.client) return true; // fail-closed
    try {
      return (await this.client.exists(this.revokedKey(jti))) === 1;
    } catch {
      return true; // fail-closed on error
    }
  }
}
