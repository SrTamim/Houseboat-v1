import type { Request } from 'express';
import { doubleCsrf } from 'csrf-csrf';
import { SESSION_COOKIE } from '../auth/jwt-auth.guard';

/**
 * Double-submit CSRF for cookie-based auth. sameSite:'lax' already blocks most
 * cross-site POSTs, but not all (top-level form posts) — this closes the gap on
 * the state-changing money/booking routes.
 *
 * Only cookie-authenticated requests are protected: a request with no session
 * cookie has no session to forge, and Bearer-header API clients aren't subject
 * to CSRF (the browser never auto-attaches an Authorization header).
 */
export function buildCsrf(secret: string, cookieSecure: boolean) {
  return doubleCsrf({
    getSecret: () => secret,
    // Session identity = the stable per-login session cookie (not the access
    // token, which rotates on refresh and would otherwise void the CSRF token).
    getSessionIdentifier: (req: Request) => {
      const cookies = (req as Request & { cookies?: Record<string, string> })
        .cookies;
      return cookies?.[SESSION_COOKIE] ?? '';
    },
    // __Host- prefix requires Secure + path=/ + no Domain. It also forbids
    // SameSite=None cross-site reads in some browsers, so use a plain name in
    // prod where the CSRF cookie must be read cross-site by the SPA.
    cookieName: 'hb_csrf',
    cookieOptions: {
      httpOnly: false, // the SPA must read it to echo it back in the header
      // Match the auth cookies: cross-site (Vercel↔Railway) in prod needs None.
      sameSite: cookieSecure ? 'none' : 'lax',
      secure: cookieSecure,
      path: '/',
    },
    getTokenFromRequest: (req: Request) => {
      const header = req.headers['x-csrf-token'];
      return Array.isArray(header) ? header[0] : header;
    },
    // Skip protection when there is no cookie session to forge, or when the
    // caller authenticates via Bearer header (non-browser client).
    skipCsrfProtection: (req: Request) => {
      const cookies = (req as Request & { cookies?: Record<string, string> })
        .cookies;
      const hasCookieSession = Boolean(cookies?.[SESSION_COOKIE]);
      const hasBearer = req.headers.authorization?.startsWith('Bearer ') ?? false;
      return !hasCookieSession || hasBearer;
    },
  });
}
