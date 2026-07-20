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
    DATABASE_URL: 'postgresql://u:p@host:5432/db',
    COOKIE_SECURE: 'true',
  };

  it('passes with strong prod config', () => {
    expect(() => validateEnv(good)).not.toThrow();
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
