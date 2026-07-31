import { validateEnv } from './validate-env';

/** P0.2: production must refuse to boot with missing/insecure secrets. */
describe('validateEnv', () => {
  const strong = 'x'.repeat(40);
  const good: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    JWT_SECRET: strong,
    JWT_REFRESH_SECRET: strong,
    CSRF_SECRET: strong,
    ENCRYPTION_KEY: strong,
    DATABASE_URL:
      'postgresql://u:p@host:5432/db?sslmode=require&connection_limit=10',
    REDIS_URL: 'redis://cache:6379',
    WEB_ORIGIN: 'https://app.example.com',
    COOKIE_SECURE: 'true',
  };

  it('passes with strong prod config', () => {
    expect(() => validateEnv(good)).not.toThrow();
  });

  /**
   * Without Redis the refresh deny-list silently falls back to an in-memory
   * map that is per-process and cleared on restart — revoked tokens would
   * become usable again after a deploy.
   */
  it('throws when REDIS_URL is missing in production', () => {
    const { REDIS_URL: _omitted, ...withoutRedis } = good;
    expect(() => validateEnv(withoutRedis)).toThrow(/REDIS_URL/);
  });

  /** Otherwise CORS silently falls back to http://localhost:3000. */
  it('throws when WEB_ORIGIN is missing in production', () => {
    const { WEB_ORIGIN: _omitted, ...withoutOrigin } = good;
    expect(() => validateEnv(withoutOrigin)).toThrow(/WEB_ORIGIN/);
  });

  /** Credentials must not cross the network in the clear. */
  it('throws when DATABASE_URL has no sslmode in production', () => {
    expect(() =>
      validateEnv({
        ...good,
        DATABASE_URL: 'postgresql://u:p@host:5432/db?connection_limit=10',
      }),
    ).toThrow(/sslmode/);
  });

  /** Prisma defaults to cpus*2+1 per instance — replicas exhaust max_connections. */
  it('throws when DATABASE_URL has no connection_limit in production', () => {
    expect(() =>
      validateEnv({
        ...good,
        DATABASE_URL: 'postgresql://u:p@host:5432/db?sslmode=require',
      }),
    ).toThrow(/connection_limit/);
  });

  it('is a no-op outside production', () => {
    expect(() => validateEnv({ NODE_ENV: 'development' })).not.toThrow();
  });

  it('throws on the insecure dev default', () => {
    expect(() =>
      validateEnv({ ...good, JWT_SECRET: 'dev-insecure-secret' }),
    ).toThrow(/insecure/);
  });

  it('throws on a missing secret', () => {
    const { CSRF_SECRET, ...rest } = good;
    expect(() => validateEnv(rest)).toThrow(/CSRF_SECRET/);
  });

  it('throws on a too-short secret', () => {
    expect(() => validateEnv({ ...good, ENCRYPTION_KEY: 'short' })).toThrow(
      /at least 32/,
    );
  });

  it('throws when secure cookies are disabled', () => {
    expect(() => validateEnv({ ...good, COOKIE_SECURE: 'false' })).toThrow(
      /COOKIE_SECURE/,
    );
  });
});
