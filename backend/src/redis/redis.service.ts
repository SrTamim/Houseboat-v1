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

  /**
   * Dev-only stand-in for the refresh deny-list: jti → expiry epoch ms.
   *
   * Redis is commonly not running locally, and the deny-list fails closed, so
   * without this token refresh is broken in dev. Deliberately NOT used in
   * production — it is per-process and lost on restart, which would resurrect
   * revoked tokens after a deploy. validate-env.ts requires REDIS_URL in prod
   * so this path is unreachable there.
   */
  private readonly memoryRevoked = new Map<string, number>();
  private isProd = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.isProd = this.config.get<string>('env') === 'production';
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
  // Production is fail-CLOSED: if Redis is unreachable we cannot prove a token
  // is valid, so callers treat "unknown" as revoked. Losing the ability to
  // refresh during an outage is acceptable; silently honoring a stolen token
  // is not.
  //
  // Development falls back to an in-memory map so the app is usable without a
  // local Redis. That store is per-process and cleared on restart, so it is
  // never used in production — REDIS_URL is required there (validate-env.ts).

  private revokedKey(jti: string): string {
    return `revoked:refresh:${jti}`;
  }

  /** Mark a refresh jti revoked until it would have expired anyway (ttl secs). */
  async revokeRefreshJti(jti: string, ttlSeconds: number): Promise<void> {
    const ttl = Math.max(ttlSeconds, 1);
    if (!this.client) {
      if (this.isProd) throw new Error('Revocation store unavailable');
      this.sweepMemory();
      this.memoryRevoked.set(jti, Date.now() + ttl * 1000);
      return;
    }
    try {
      await this.client.set(this.revokedKey(jti), '1', 'EX', ttl);
    } catch (e) {
      if (this.isProd) throw e;
      this.sweepMemory();
      this.memoryRevoked.set(jti, Date.now() + ttl * 1000);
    }
  }

  /** True if this jti was revoked, OR if the store can't be reached (fail-closed). */
  async isRefreshJtiRevoked(jti: string): Promise<boolean> {
    if (!this.client) {
      // Prod: fail-closed. Dev: consult the in-memory stand-in.
      return this.isProd ? true : this.isRevokedInMemory(jti);
    }
    try {
      return (await this.client.exists(this.revokedKey(jti))) === 1;
    } catch {
      return this.isProd ? true : this.isRevokedInMemory(jti);
    }
  }

  private isRevokedInMemory(jti: string): boolean {
    const expiresAt = this.memoryRevoked.get(jti);
    if (expiresAt === undefined) return false;
    if (expiresAt <= Date.now()) {
      this.memoryRevoked.delete(jti);
      return false;
    }
    return true;
  }

  /** Drop expired entries so the dev map can't grow without bound. */
  private sweepMemory(): void {
    const now = Date.now();
    for (const [jti, expiresAt] of this.memoryRevoked) {
      if (expiresAt <= now) this.memoryRevoked.delete(jti);
    }
  }
}
