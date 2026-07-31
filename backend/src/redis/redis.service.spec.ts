import { RedisService } from './redis.service';
import type { ConfigService } from '@nestjs/config';

/**
 * The refresh deny-list decides whether a stolen token still works, so its
 * behaviour when Redis is missing matters as much as the happy path:
 * production must fail closed, development must stay usable.
 */
describe('RedisService refresh deny-list', () => {
  /** No REDIS_URL → no client, exercising the fallback paths. */
  const build = (env: string) => {
    const config = {
      get: (key: string) => (key === 'env' ? env : undefined),
    } as unknown as ConfigService;
    const svc = new RedisService(config);
    svc.onModuleInit();
    return svc;
  };

  describe('production', () => {
    it('treats an unknown jti as revoked (fail-closed)', async () => {
      const svc = build('production');
      await expect(svc.isRefreshJtiRevoked('never-seen')).resolves.toBe(true);
    });

    it('refuses to record a revocation it cannot persist', async () => {
      const svc = build('production');
      await expect(svc.revokeRefreshJti('jti-1', 60)).rejects.toThrow(
        'Revocation store unavailable',
      );
    });
  });

  describe('development', () => {
    it('allows refresh for a jti that was never revoked', async () => {
      const svc = build('development');
      await expect(svc.isRefreshJtiRevoked('fresh')).resolves.toBe(false);
    });

    it('blocks a jti after it is revoked', async () => {
      const svc = build('development');
      await svc.revokeRefreshJti('burned', 60);
      await expect(svc.isRefreshJtiRevoked('burned')).resolves.toBe(true);
    });

    it('stops blocking once the ttl has passed', async () => {
      const svc = build('development');
      await svc.revokeRefreshJti('short', 1);

      // Fast-forward past the ttl rather than sleeping.
      const realNow = Date.now;
      Date.now = () => realNow() + 5_000;
      try {
        await expect(svc.isRefreshJtiRevoked('short')).resolves.toBe(false);
      } finally {
        Date.now = realNow;
      }
    });

    it('keeps revocations independent per jti', async () => {
      const svc = build('development');
      await svc.revokeRefreshJti('a', 60);
      await expect(svc.isRefreshJtiRevoked('b')).resolves.toBe(false);
    });
  });
});
