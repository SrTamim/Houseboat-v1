/**
 * Production secret guard. The dev-insecure fallbacks in configuration.ts keep
 * local dev frictionless, but shipping them to production means JWTs are signed
 * with a publicly-known constant → trivially forgeable auth. Fail fast at boot
 * so a misconfigured deploy never listens.
 */

/** Must match the fallbacks in configuration.ts. */
const DEV_FALLBACKS: Record<string, string> = {
  JWT_SECRET: 'dev-insecure-secret',
  JWT_REFRESH_SECRET: 'dev-insecure-refresh',
  CSRF_SECRET: 'dev-insecure-csrf-secret-32b',
  ENCRYPTION_KEY: 'dev-insecure-encryption-key',
};

const REQUIRED_IN_PROD = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'CSRF_SECRET',
  'ENCRYPTION_KEY',
  'DATABASE_URL',
] as const;

/**
 * Throws if any production-critical secret is unset or still the dev fallback,
 * or if secure cookies are disabled. No-op outside production.
 */
export function validateEnv(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;

  const problems: string[] = [];

  for (const key of REQUIRED_IN_PROD) {
    const val = env[key];
    if (!val || val.trim() === '') {
      problems.push(`${key} is not set`);
      continue;
    }
    if (DEV_FALLBACKS[key] && val === DEV_FALLBACKS[key]) {
      problems.push(`${key} is still the insecure dev default`);
    }
  }

  // Secret-strength floor: 32 chars keeps HS256/CSRF secrets out of brute range.
  for (const key of [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'CSRF_SECRET',
    'ENCRYPTION_KEY',
  ] as const) {
    const val = env[key];
    if (val && val.length < 32) {
      problems.push(`${key} must be at least 32 characters in production`);
    }
  }

  if (env.COOKIE_SECURE !== 'true') {
    problems.push('COOKIE_SECURE must be "true" in production (cookies over HTTPS)');
  }

  if (problems.length > 0) {
    throw new Error(
      `Refusing to start in production — insecure configuration:\n  - ${problems.join(
        '\n  - ',
      )}`,
    );
  }
}
