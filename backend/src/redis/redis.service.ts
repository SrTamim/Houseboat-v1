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

  // ── Login lockout (progressive brute-force / credential-stuffing defense) ──
  // A per-identity failure counter with a sliding TTL window. Once the count
  // crosses a threshold the caller refuses logins until the window elapses.
  // This is on TOP of the per-IP @Throttle on /auth/login, and defends a single
  // targeted account across many IPs (throttle is per-IP/per-account request
  // rate; this is per-account failure count).
  //
  // Dev without Redis: a per-process map, same rationale as the deny-list.
  private readonly memoryFails = new Map<string, { n: number; exp: number }>();

  private failKey(id: string): string {
    return `loginfail:${id}`;
  }

  /**
   * Current consecutive-failure count for an identity (e.g. a phone). Never
   * throws — a lockout store outage must not hard-fail login; it just means we
   * can't enforce lockout that moment (the @Throttle still bounds the rate).
   */
  async loginFailCount(id: string): Promise<number> {
    if (!this.client) return this.memoryFailCount(id);
    try {
      const v = await this.client.get(this.failKey(id));
      return v ? parseInt(v, 10) : 0;
    } catch {
      return this.memoryFailCount(id);
    }
  }

  /** Increment the failure counter and (re)set its window. Returns the new count. */
  async recordLoginFailure(id: string, windowSeconds: number): Promise<number> {
    const ttl = Math.max(windowSeconds, 1);
    if (!this.client) return this.memoryRecordFailure(id, ttl);
    try {
      const key = this.failKey(id);
      const n = await this.client.incr(key);
      await this.client.expire(key, ttl);
      return n;
    } catch {
      return this.memoryRecordFailure(id, ttl);
    }
  }

  /** Clear the counter after a successful login. */
  async clearLoginFailures(id: string): Promise<void> {
    if (!this.client) {
      this.memoryFails.delete(id);
      return;
    }
    try {
      await this.client.del(this.failKey(id));
    } catch {
      this.memoryFails.delete(id);
    }
  }

  private memoryFailCount(id: string): number {
    const e = this.memoryFails.get(id);
    if (!e) return 0;
    if (e.exp <= Date.now()) {
      this.memoryFails.delete(id);
      return 0;
    }
    return e.n;
  }

  private memoryRecordFailure(id: string, ttlSeconds: number): number {
    const now = Date.now();
    const e = this.memoryFails.get(id);
    const n = e && e.exp > now ? e.n + 1 : 1;
    this.memoryFails.set(id, { n, exp: now + ttlSeconds * 1000 });
    return n;
  }
}
