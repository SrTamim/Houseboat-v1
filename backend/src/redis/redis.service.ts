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
      // Reject commands immediately when not connected instead of queueing them.
      // With the default (queue on), a command issued while the client is down
      // neither resolves via Redis nor runs our catch → writes silently vanish
      // (an OTP set on send is then unreadable on verify). Fast-rejecting lets
      // every method's try/catch fall through to its memory / fail-closed branch.
      enableOfflineQueue: false,
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

  /**
   * The client ONLY when it is actually connected and can serve a command.
   * `'ready'` is the sole ioredis status where a command reaches a live server
   * (`'wait'` is the lazyConnect pre-connect state; `'connecting'`/`'reconnecting'`
   * mean commands would queue or reject). Every method below gates on this so a
   * present-but-disconnected client (REDIS_URL set, server down) deterministically
   * uses the same memory / fail-closed branch on BOTH writes and reads.
   */
  private get ready(): Redis | null {
    return this.client && this.client.status === 'ready' ? this.client : null;
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
    const client = this.ready;
    if (!client) {
      if (this.isProd) throw new Error('Revocation store unavailable');
      this.sweepMemory();
      this.memoryRevoked.set(jti, Date.now() + ttl * 1000);
      return;
    }
    try {
      await client.set(this.revokedKey(jti), '1', 'EX', ttl);
    } catch (e) {
      if (this.isProd) throw e;
      this.sweepMemory();
      this.memoryRevoked.set(jti, Date.now() + ttl * 1000);
    }
  }

  /** True if this jti was revoked, OR if the store can't be reached (fail-closed). */
  async isRefreshJtiRevoked(jti: string): Promise<boolean> {
    const client = this.ready;
    if (!client) {
      // Prod: fail-closed. Dev: consult the in-memory stand-in.
      return this.isProd ? true : this.isRevokedInMemory(jti);
    }
    try {
      return (await client.exists(this.revokedKey(jti))) === 1;
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
    const client = this.ready;
    if (!client) return this.memoryFailCount(id);
    try {
      const v = await client.get(this.failKey(id));
      return v ? parseInt(v, 10) : 0;
    } catch {
      return this.memoryFailCount(id);
    }
  }

  /** Increment the failure counter and (re)set its window. Returns the new count. */
  async recordLoginFailure(id: string, windowSeconds: number): Promise<number> {
    const ttl = Math.max(windowSeconds, 1);
    const client = this.ready;
    if (!client) return this.memoryRecordFailure(id, ttl);
    try {
      const key = this.failKey(id);
      const n = await client.incr(key);
      await client.expire(key, ttl);
      return n;
    } catch {
      return this.memoryRecordFailure(id, ttl);
    }
  }

  /** Clear the counter after a successful login. */
  async clearLoginFailures(id: string): Promise<void> {
    const client = this.ready;
    if (!client) {
      this.memoryFails.delete(id);
      return;
    }
    try {
      await client.del(this.failKey(id));
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

  // ── Password-reset OTP (forgot-password via SMS) ──────────────────────────
  // Short-lived state for the reset flow, following the same graceful-degrade
  // contract as the login lockout above: real Redis when available, a
  // per-process in-memory Map otherwise (dev / Redis-down). None of it is
  // security-critical to persist — an OTP or send-counter lost on restart just
  // means the user requests a fresh code.

  private readonly memoryOtp = new Map<
    string,
    { hash: string; attempts: number; exp: number }
  >();
  private readonly memoryCounter = new Map<string, { n: number; exp: number }>();
  private readonly memoryTicket = new Map<string, number>(); // jti → exp ms
  private readonly memoryPwChanged = new Map<string, number>(); // acct → exp ms
  private readonly memoryPwChangedValue = new Map<string, number>(); // acct → epoch s

  private otpKey(phone: string): string {
    return `otp:reset:${phone}`;
  }
  private sendKey(bucket: string): string {
    return `otp:sends:${bucket}`;
  }
  private ticketKey(jti: string): string {
    return `pwreset:jti:${jti}`;
  }
  private pwChangedKey(accountId: string): string {
    return `pwchanged:${accountId}`;
  }

  /** Store (or overwrite) the OTP hash for a phone, resetting attempts. */
  async setOtp(phone: string, hash: string, ttlSeconds: number): Promise<void> {
    const ttl = Math.max(ttlSeconds, 1);
    const value = JSON.stringify({ hash, attempts: 0 });
    const client = this.ready;
    if (!client) {
      this.memorySetOtp(phone, hash, ttl);
      return;
    }
    try {
      await client.set(this.otpKey(phone), value, 'EX', ttl);
    } catch {
      this.memorySetOtp(phone, hash, ttl);
    }
  }

  private memorySetOtp(phone: string, hash: string, ttlSeconds: number): void {
    this.memoryOtp.set(this.otpKey(phone), {
      hash,
      attempts: 0,
      exp: Date.now() + ttlSeconds * 1000,
    });
  }

  /** Current OTP record (hash + attempt count), or null if none/expired. */
  async getOtp(
    phone: string,
  ): Promise<{ hash: string; attempts: number } | null> {
    const client = this.ready;
    if (!client) return this.memoryGetOtp(phone);
    try {
      const v = await client.get(this.otpKey(phone));
      if (!v) return null;
      return JSON.parse(v) as { hash: string; attempts: number };
    } catch {
      // A mid-request disconnect: fall back to memory rather than reporting the
      // code missing (which would surface as a false "expired").
      return this.memoryGetOtp(phone);
    }
  }

  private memoryGetOtp(
    phone: string,
  ): { hash: string; attempts: number } | null {
    const e = this.memoryOtp.get(this.otpKey(phone));
    if (!e) return null;
    if (e.exp <= Date.now()) {
      this.memoryOtp.delete(this.otpKey(phone));
      return null;
    }
    return { hash: e.hash, attempts: e.attempts };
  }

  /** Increment the wrong-guess counter for a phone's OTP; returns new count. */
  async recordOtpAttempt(phone: string): Promise<number> {
    const client = this.ready;
    if (!client) return this.memoryRecordOtpAttempt(phone);
    try {
      const v = await client.get(this.otpKey(phone));
      if (!v) return 0;
      const rec = JSON.parse(v) as { hash: string; attempts: number };
      rec.attempts += 1;
      // Preserve remaining TTL so the attempt window matches the code's life.
      const ttl = await client.ttl(this.otpKey(phone));
      await client.set(
        this.otpKey(phone),
        JSON.stringify(rec),
        'EX',
        ttl > 0 ? ttl : 1,
      );
      return rec.attempts;
    } catch {
      return this.memoryRecordOtpAttempt(phone);
    }
  }

  private memoryRecordOtpAttempt(phone: string): number {
    const e = this.memoryOtp.get(this.otpKey(phone));
    if (!e || e.exp <= Date.now()) return 0;
    e.attempts += 1;
    return e.attempts;
  }

  /** Delete a phone's OTP (on success or after too many attempts). */
  async delOtp(phone: string): Promise<void> {
    if (!this.client) {
      this.memoryOtp.delete(this.otpKey(phone));
      return;
    }
    const client = this.ready;
    if (!client) {
      this.memoryOtp.delete(this.otpKey(phone));
      return;
    }
    try {
      await client.del(this.otpKey(phone));
    } catch {
      this.memoryOtp.delete(this.otpKey(phone));
    }
  }

  /** Count of OTP sends recorded for a bucket (an ip or `phone:${phone}`). */
  async otpSendCount(bucket: string): Promise<number> {
    const client = this.ready;
    if (!client) {
      const e = this.memoryCounter.get(this.sendKey(bucket));
      if (!e || e.exp <= Date.now()) return 0;
      return e.n;
    }
    try {
      const v = await client.get(this.sendKey(bucket));
      return v ? parseInt(v, 10) : 0;
    } catch {
      const e = this.memoryCounter.get(this.sendKey(bucket));
      return e && e.exp > Date.now() ? e.n : 0;
    }
  }

  /** Record one OTP send against a bucket within a rolling window. */
  async recordOtpSend(bucket: string, windowSeconds: number): Promise<number> {
    const ttl = Math.max(windowSeconds, 1);
    const client = this.ready;
    if (!client) return this.memoryRecordSend(bucket, ttl);
    try {
      const key = this.sendKey(bucket);
      const n = await client.incr(key);
      await client.expire(key, ttl);
      return n;
    } catch {
      return this.memoryRecordSend(bucket, ttl);
    }
  }

  private memoryRecordSend(bucket: string, ttlSeconds: number): number {
    const now = Date.now();
    const e = this.memoryCounter.get(this.sendKey(bucket));
    const n = e && e.exp > now ? e.n + 1 : 1;
    this.memoryCounter.set(this.sendKey(bucket), {
      n,
      exp: now + ttlSeconds * 1000,
    });
    return n;
  }

  /** Record a reset ticket jti as unused (single-use tracking). */
  async markResetTicket(jti: string, ttlSeconds: number): Promise<void> {
    const ttl = Math.max(ttlSeconds, 1);
    const client = this.ready;
    if (!client) {
      this.memoryTicket.set(this.ticketKey(jti), Date.now() + ttl * 1000);
      return;
    }
    try {
      await client.set(this.ticketKey(jti), '1', 'EX', ttl);
    } catch {
      this.memoryTicket.set(this.ticketKey(jti), Date.now() + ttl * 1000);
    }
  }

  /**
   * Consume a reset ticket jti: returns true only if it existed and was unused,
   * atomically burning it so a replayed ticket is rejected.
   */
  async consumeResetTicket(jti: string): Promise<boolean> {
    const client = this.ready;
    if (!client) return this.memoryConsumeTicket(jti);
    try {
      // GETDEL is atomic check-and-remove (Redis ≥ 6.2).
      const v = await client.getdel(this.ticketKey(jti));
      return v !== null;
    } catch {
      return this.memoryConsumeTicket(jti);
    }
  }

  private memoryConsumeTicket(jti: string): boolean {
    const exp = this.memoryTicket.get(this.ticketKey(jti));
    this.memoryTicket.delete(this.ticketKey(jti));
    return exp !== undefined && exp > Date.now();
  }

  /** Stamp the moment an account's password changed (session-cutoff). */
  async setPwChanged(
    accountId: string,
    epochSeconds: number,
    ttlSeconds: number,
  ): Promise<void> {
    const ttl = Math.max(ttlSeconds, 1);
    const client = this.ready;
    if (!client) {
      this.memorySetPwChanged(accountId, epochSeconds, ttl);
      return;
    }
    try {
      await client.set(
        this.pwChangedKey(accountId),
        String(epochSeconds),
        'EX',
        ttl,
      );
    } catch {
      this.memorySetPwChanged(accountId, epochSeconds, ttl);
    }
  }

  private memorySetPwChanged(
    accountId: string,
    epochSeconds: number,
    ttlSeconds: number,
  ): void {
    this.memoryPwChanged.set(
      this.pwChangedKey(accountId),
      Date.now() + ttlSeconds * 1000,
    );
    this.memoryPwChangedValue.set(accountId, epochSeconds);
  }

  /**
   * The epoch-seconds at which this account last changed its password, or 0 if
   * unknown. Fail-open (returns 0) when the store is unreachable, matching the
   * lockout's best-effort contract — a refresh is never hard-failed by an
   * outage of this defence-in-depth check.
   */
  async getPwChanged(accountId: string): Promise<number> {
    const client = this.ready;
    if (!client) return this.memoryGetPwChanged(accountId);
    try {
      const v = await client.get(this.pwChangedKey(accountId));
      return v ? parseInt(v, 10) : 0;
    } catch {
      return this.memoryGetPwChanged(accountId);
    }
  }

  private memoryGetPwChanged(accountId: string): number {
    const exp = this.memoryPwChanged.get(this.pwChangedKey(accountId));
    if (exp === undefined || exp <= Date.now()) {
      this.memoryPwChanged.delete(this.pwChangedKey(accountId));
      this.memoryPwChangedValue.delete(accountId);
      return 0;
    }
    return this.memoryPwChangedValue.get(accountId) ?? 0;
  }
}
