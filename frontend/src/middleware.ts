import { NextResponse, type NextRequest } from 'next/server';
import { THEME_SCRIPT_HASH } from '@/lib/theme-script';
import { LOGIN_PATH, loginUrl } from '@/lib/admin/login-url';
import {
  OWNER_LOGIN_PATH,
  OWNER_SIGNUP_PATH,
  ownerLoginUrl,
} from '@/lib/owner/login-url';
import {
  CUSTOMER_LOGIN_PATH,
  CUSTOMER_REGISTER_PATH,
  customerLoginUrl,
} from '@/lib/customer/login-url';

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
/**
 * Readable (httpOnly:false) double-submit CSRF cookie. Its value is
 * "<token>|<hash>"; the backend validates the x-csrf-token header against the
 * token half only. Present only after GET /auth/csrf has run (lazily, on the
 * first mutating XHR), so it may be absent on a cold navigation.
 */
const CSRF_COOKIE = 'hb_csrf';

/**
 * Server-side API origin. A relative '/api/...' fetch has no origin in the Edge
 * middleware, so this must be absolute — same target the RSC session check uses.
 */
const API_ORIGIN = process.env.API_PROXY_TARGET ?? 'http://localhost:4000';

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
  // The customer account area is gated; its own login/register are not. The rest
  // of the customer app (/, /search, /boat/*, /checkout, /booking/*) is public
  // browse — checkout enforces auth server-side (holds require a session), and
  // the client shows a login-to-continue gate there rather than a hard redirect.
  if (pathname.startsWith('/account')) {
    return (
      !pathname.startsWith(CUSTOMER_LOGIN_PATH) &&
      !pathname.startsWith(CUSTOMER_REGISTER_PATH)
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
  if (pathname.startsWith('/owner')) return ownerLoginUrl({ next });
  if (pathname.startsWith('/account')) return customerLoginUrl({ next });
  return loginUrl({ next });
}

/**
 * Existence-only probe. Still NOT authorization — the Edge runtime has no JWT
 * secret, so a forged or expired value passes. The real gate is the
 * /auth/me + isPlatform check in app/admin/(console)/layout.tsx.
 */
function hasSessionCookie(req: NextRequest): boolean {
  return req.cookies.has(ACCESS_COOKIE) || req.cookies.has(REFRESH_COOKIE);
}

/**
 * Access token lives 15 minutes; refresh lives 30 days. If the access cookie has
 * lapsed but the refresh cookie is still present, the session is fully
 * recoverable — but the server-side layout check (getOwnerSession → /auth/me)
 * does NOT refresh, so it would bounce an actively-working owner to login the
 * moment they navigate after 15 minutes.
 *
 * Refresh here, before the layout runs: call the backend with the caller's
 * cookies and, on success, replay its Set-Cookie headers onto our response so
 * the fresh hb_access reaches both the browser and the downstream RSC fetch.
 * This is the only place in the request lifecycle that can both mint the new
 * token (it has no JWT secret, so it delegates to the backend) and write the
 * cookie back. On any failure it returns null and the normal existence redirect
 * takes over — a failed refresh must never hard-fail the navigation.
 */
interface RefreshResult {
  /** Raw Set-Cookie header lines to replay onto the browser response. */
  setCookies: string[];
  /** Parsed name→value for the rotated cookies, to patch the same-request cookie header. */
  pairs: Record<string, string>;
}

async function tryRefresh(req: NextRequest): Promise<RefreshResult | null> {
  const cookieHeader = req.cookies.toString();
  const headers: Record<string, string> = { cookie: cookieHeader };
  // Send a correct CSRF header when we can, so the refresh is correct by
  // construction regardless of the backend's refresh-route exemption. The
  // hb_csrf cookie is "<token>|<hash>"; validation compares the header to the
  // token half only. When the cookie is absent (cold navigation), send no
  // header — never fabricate one; the backend exemption covers that case.
  const csrf = req.cookies.get(CSRF_COOKIE)?.value;
  if (csrf) headers['x-csrf-token'] = csrf.split('|', 1)[0];
  try {
    const r = await fetch(`${API_ORIGIN}/api/auth/refresh`, {
      method: 'POST',
      headers,
      cache: 'no-store',
    });
    if (!r.ok) return null;
    // getSetCookie() returns each Set-Cookie header separately (access + refresh),
    // which a plain .get('set-cookie') would fold into one comma-joined string.
    const setCookies = r.headers.getSetCookie();
    if (!setCookies.length) return null;
    const pairs: Record<string, string> = {};
    for (const line of setCookies) {
      const [nameValue] = line.split(';');
      const eq = nameValue.indexOf('=');
      if (eq > 0) pairs[nameValue.slice(0, eq).trim()] = nameValue.slice(eq + 1).trim();
    }
    return { setCookies, pairs };
  } catch {
    return null;
  }
}

/**
 * Video-embed hosts, allowlisted for frame-src. Only providers we inline-embed
 * (see media/video-providers.ts): YouTube, Vimeo, Google Drive. Facebook and
 * Instagram are link-out only, so they are deliberately NOT frameable here.
 */
const EMBED_FRAME_HOSTS =
  'https://www.youtube-nocookie.com https://player.vimeo.com https://drive.google.com';

/** Provider image hosts: YouTube thumbnails + Unsplash stock photos (boat/hero imagery). */
const EMBED_IMG_HOSTS = 'https://img.youtube.com https://images.unsplash.com';

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
    `img-src 'self' data: blob: ${EMBED_IMG_HOSTS}`,
    "font-src 'self' data:",
    // Same-origin only: the browser talks to /api/*, which is rewritten
    // server-side to the backend.
    `connect-src 'self'${isDev ? ' ws: http://localhost:*' : ''}`,
    "frame-ancestors 'none'",
    // Only the allowlisted video-embed hosts may be framed; nothing else.
    `frame-src ${EMBED_FRAME_HOSTS}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ];
  return directives.join('; ');
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Proactive refresh: session needed, access cookie gone, but refresh still
  // valid → mint a fresh access token before the layout's /auth/me runs, so an
  // active owner isn't logged out at the 15-minute mark. Only attempt when the
  // access cookie is actually absent, never on every request (refresh rotates a
  // single-use token). refreshedCookies is replayed onto the final response.
  let refreshed: RefreshResult | null = null;
  if (
    needsSession(pathname) &&
    !req.cookies.has(ACCESS_COOKIE) &&
    req.cookies.has(REFRESH_COOKIE)
  ) {
    refreshed = await tryRefresh(req);
  }

  // Patch this request's cookie header so the downstream RSC layout check
  // (getOwnerSession → /auth/me) sees the fresh token on THIS navigation, not
  // only the next one. Built explicitly rather than relying on cookies.set()
  // reflecting into req.headers, which it does not in Next 15.
  let forwardHeaders: Headers | null = null;
  if (refreshed) {
    for (const [name, value] of Object.entries(refreshed.pairs)) {
      req.cookies.set(name, value);
    }
    forwardHeaders = new Headers(req.headers);
    forwardHeaders.set('cookie', req.cookies.toString());
  }

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

  // CSP goes on the RESPONSE only.
  //
  // Do NOT set CSP on the request headers via NextResponse.next({request}).
  // Next reads a request-side CSP back when deciding how to emit assets, and in
  // dev that stopped it emitting any CSS at all — stylesheets 404'd and every
  // page rendered unstyled. The nonce doesn't need to reach the render tree
  // either: Next parses it off this response header for its own bundle tags,
  // and the inline theme script is allowed by hash (see lib/theme-script.ts).
  //
  // Forwarding the refreshed COOKIE header on the request is a separate, safe
  // pattern — it carries the rotated hb_access to the RSC render this request,
  // and does NOT put CSP on the request, so the asset-emission bug above stays
  // avoided. When nothing was refreshed we pass a plain next() unchanged.
  const res = forwardHeaders
    ? NextResponse.next({ request: { headers: forwardHeaders } })
    : NextResponse.next();
  res.headers.set('content-security-policy', csp);
  // Replay the rotated auth cookies to the browser (append, not set — there are
  // two of them, and one Set-Cookie per header line is required to store both).
  if (refreshed) {
    for (const c of refreshed.setCookies) res.headers.append('set-cookie', c);
  }
  return res;
}

export const config = {
  // All app routes: CSP should cover the public site too, not just /admin.
  // Static assets and image optimization are excluded — they're not documents.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff|woff2)$).*)',
  ],
};
