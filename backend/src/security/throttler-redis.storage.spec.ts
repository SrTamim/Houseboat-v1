import { ThrottlerRedisStorage } from './throttler-redis.storage';
import type { RedisService } from '../redis/redis.service';
import type { ConfigService } from '@nestjs/config';

/**
 * Rate limiting is a security control (credential stuffing on /auth/login,
 * abuse of money routes), so the failure modes matter as much as the happy
 * path: it must fail CLOSED in production and OPEN in dev.
 */
describe('ThrottlerRedisStorage', () => {
  const cfg = (env: string): ConfigService =>
    ({ get: () => env }) as unknown as ConfigService;

  const redisWith = (client: unknown): RedisService =>
    ({ instance: client }) as unknown as RedisService;

  /** Minimal ioredis stand-in backed by a Map. */
  function fakeRedis() {
    const hits = new Map<string, number>();
    const ttls = new Map<string, number>();
    return {
      hits,
      async pttl(key: string) {
        return ttls.get(key) ?? -1;
      },
      multi() {
        return {
          incr(key: string) {
            hits.set(key, (hits.get(key) ?? 0) + 1);
            this._key = key;
            return this;
          },
          pttl() {
            return this;
          },
          async exec() {
            const key = this._key as string;
            return [
              [null, hits.get(key)],
              [null, ttls.get(key) ?? -1],
            ];
          },
          _key: '',
        };
      },
      async pexpire(key: string, ms: number) {
        ttls.set(key, ms);
      },
      async set() {
        return 'OK';
      },
    };
  }

  it('counts hits and reports under-limit requests as allowed', async () => {
    const storage = new ThrottlerRedisStorage(
      redisWith(fakeRedis()),
      cfg('production'),
    );

    const first = await storage.increment('ip:1.2.3.4', 60_000, 10, 0, 'default');
    expect(first.totalHits).toBe(1);
    expect(first.isBlocked).toBe(false);

    const second = await storage.increment('ip:1.2.3.4', 60_000, 10, 0, 'default');
    expect(second.totalHits).toBe(2);
    expect(second.isBlocked).toBe(false);
  });

  it('blocks once the limit is exceeded', async () => {
    const storage = new ThrottlerRedisStorage(
      redisWith(fakeRedis()),
      cfg('production'),
    );

    let last;
    for (let i = 0; i < 4; i++) {
      last = await storage.increment('ip:1.2.3.4', 60_000, 3, 0, 'default');
    }
    expect(last!.totalHits).toBe(4);
    expect(last!.isBlocked).toBe(true);
  });

  it('keys separate trackers independently', async () => {
    const storage = new ThrottlerRedisStorage(
      redisWith(fakeRedis()),
      cfg('production'),
    );

    await storage.increment('account:a', 60_000, 10, 0, 'default');
    await storage.increment('account:a', 60_000, 10, 0, 'default');
    const other = await storage.increment('account:b', 60_000, 10, 0, 'default');

    // Exhausting one account must not consume another's allowance.
    expect(other.totalHits).toBe(1);
  });

  it('fails CLOSED in production when Redis is unavailable', async () => {
    const storage = new ThrottlerRedisStorage(redisWith(null), cfg('production'));
    const res = await storage.increment('ip:1.2.3.4', 60_000, 10, 0, 'default');
    expect(res.isBlocked).toBe(true);
  });

  it('fails OPEN in development when Redis is unavailable', async () => {
    const storage = new ThrottlerRedisStorage(redisWith(null), cfg('development'));
    const res = await storage.increment('ip:1.2.3.4', 60_000, 10, 0, 'default');
    expect(res.isBlocked).toBe(false);
  });

  it('fails CLOSED in production when Redis throws', async () => {
    const broken = {
      async pttl() {
        throw new Error('connection reset');
      },
    };
    const storage = new ThrottlerRedisStorage(
      redisWith(broken),
      cfg('production'),
    );
    const res = await storage.increment('ip:1.2.3.4', 60_000, 10, 0, 'default');
    expect(res.isBlocked).toBe(true);
  });
});
