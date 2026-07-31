import { NextResponse, type NextRequest } from 'next/server';
import { THEME_SCRIPT_HASH } from '@/lib/theme-script';
import { LOGIN_PATH, loginUrl } from '@/lib/admin/login-url';
import {
  OWNER_LOGIN_PATH,
  OWNER_SIGNUP_PATH,
  ownerLoginUrl,
} from '@/lib/owner/login-url';

/**
 * Two jobs, both per-request:
 *
 *  1. Content-Security-Policy with a fresh nonce. This can't live in
 *     next.config.mjs — headers there are static, and a nonce reused across
 *     responses provides no protection at all.
 *  2. Redirect signed-out visitors away from /admin/* and /owner/*.
 *
 * The auth redirect is UX, NOT security. Edge runtime has no access to the JWT
 * secret, so it can only check that the cookie EXISTS — a forged or expired
 * value passes. The real gates are the server-side checks in
 * app/admin/(console)/layout.tsx (/auth/me + isPlatform) and
 * app/owner/(console)/layout.tsx (/auth/me + /me/boats), backed by
 * @PlatformOnly() and @RequirePermission() on the API routes themselves.
 * Do not add authorization logic here.
 */

/**
 * Both session cookies matter here.
 *
 * hb_access lives 15 minutes; hb_refresh lives 30 days. Checking only hb_access
 * bounced anyone returning after 15 minutes to the login page even though their
 * session was fully recoverable via POST /auth/refresh — which the axios
 * interceptor does automatically once the request is allowed through.
 */
const ACCESS_COOKIE = 'hb_access';
const REFRESH_COOKIE = 'hb_refresh';

/** Routes that require a session. Keeps the CSP path and the auth path separate. */
function needsSession(pathname: string): boolean {
  if (pathname.startsWith('/admin')) return !pathname.startsWith(LOGIN_PATH);
  // The owner console has its own login AND a public signup — someone creating
  // an account necessarily has no session yet.
  if (pathname.startsWith('/owner')) {
    return (
      !pathname.startsWith(OWNER_LOGIN_PATH) &&
      !pathname.startsWith(OWNER_SIGNUP_PATH)
    );
  }
  return false;
}

/**
 * The login URL for whichever console the visitor was headed to.
 *
 * The two builders are not interchangeable: each clamps ?next= to its own path
 * prefix, so using the admin one for an /owner destination would silently drop
 * it and land the owner on the dashboard instead of where they were going.
 */
function loginUrlFor(pathname: string, next: string): string {
  return pathname.startsWith('/owner')
    ? ownerLoginUrl({ next })
    : loginUrl({ next });
}

/**
 * Existence-only probe. Still NOT authorization — the Edge runtime has no JWT
 * secret, so a forged or expired value passes. The real gate is the
 * /auth/me + isPlatform check in app/admin/(console)/layout.tsx.
 */
function hasSessionCookie(req: NextRequest): boolean {
  return req.cookies.has(ACCESS_COOKIE) || req.cookies.has(REFRESH_COOKIE);
}

function buildCsp(nonce: string, isDev: boolean): string {
  const directives = [
    "default-src 'self'",
    // The nonce covers Next's own bundle tags (it reads it back off this
    // header). THEME_SCRIPT_HASH covers the pre-paint theme script, which is
    // hashed rather than nonced so it can't desync during hydration.
    // 'strict-dynamic' lets Next's bootstrap load its chunks; dev additionally
    // needs 'unsafe-eval' for React Refresh.
    `script-src 'self' 'nonce-${nonce}' ${THEME_SCRIPT_HASH} 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // Next injects styles at runtime; there is no nonce-able hook for them.
    // Style injection is a far weaker vector than script execution.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // Same-origin only: the browser talks to /api/*, which is rewritten
    // server-side to the backend.
    `connect-src 'self'${isDev ? ' ws: http://localhost:*' : ''}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ];
  return directives.join('; ');
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (needsSession(pathname) && !hasSessionCookie(req)) {
    // Preserve where they were headed so login can return them there.
    //
    // Deliberately NO reason code: "no cookie at all" includes people who never
    // had a session, and greeting a first-time visitor with "Your session
    // expired" is wrong. The console layout — which knows a cookie existed and
    // was rejected — is the hop that says session_expired / backend_down.
    const target = loginUrlFor(pathname, pathname + search);
    const [targetPath, targetQuery = ''] = target.split('?');

    const url = req.nextUrl.clone();
    url.pathname = targetPath;
    url.search = targetQuery ? `?${targetQuery}` : '';
    return NextResponse.redirect(url);
  }

  const isDev = process.env.NODE_ENV !== 'production';
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const csp = buildCsp(nonce, isDev);

  // Set CSP on the RESPONSE only.
  //
  // Do NOT also set it on the request headers via NextResponse.next({request}).
  // Next reads a request-side CSP back when deciding how to emit assets, and in
  // dev that stopped it emitting any CSS at all — stylesheets 404'd and every
  // page rendered unstyled. The nonce doesn't need to reach the render tree
  // either: Next parses it off this response header for its own bundle tags,
  // and the inline theme script is allowed by hash (see lib/theme-script.ts).
  const res = NextResponse.next();
  res.headers.set('content-security-policy', csp);
  return res;
}

export const config = {
  // All app routes: CSP should cover the public site too, not just /admin.
  // Static assets and image optimization are excluded — they're not documents.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff|woff2)$).*)',
  ],
};
