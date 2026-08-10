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
      // Exempt the silent-refresh route. The Edge middleware refreshes the
      // access token on navigation (before any page render), and cannot always
      // present a CSRF token there — the hb_csrf cookie is minted lazily by GET
      // /auth/csrf on the first mutating XHR, so on a cold navigation it may not
      // exist yet. Without this, the proactive refresh 403s and an owner is
      // bounced to login every ~15 minutes when the access token lapses.
      //
      // Safe: refresh already requires a valid HttpOnly hb_refresh JWT that
      // cross-origin JS cannot read, sameSite blocks the cross-site form-post
      // case, and the refresh token is single-use (rotated per call). A forced
      // cross-site refresh could at most rotate the victim's own token — no
      // privilege gain, no state mutation.
      //
      // Exact match: doubleCsrfProtection runs as raw Express middleware and the
      // global 'api' prefix is preserved end-to-end (Next rewrites /api/* to
      // /api/*), so req.path here is '/api/auth/refresh'. Match it exactly (with
      // an optional trailing slash) so nothing else is widened.
      if (req.path === '/api/auth/refresh' || req.path === '/api/auth/refresh/') {
        return true;
      }
      const cookies = (req as Request & { cookies?: Record<string, string> })
        .cookies;
      const hasCookieSession = Boolean(cookies?.[SESSION_COOKIE]);
      const hasBearer = req.headers.authorization?.startsWith('Bearer ') ?? false;
      return !hasCookieSession || hasBearer;
    },
  });
}
