import axios, { type InternalAxiosRequestConfig } from 'axios';
import type { paths, components } from './api-types';
import { LOGIN_PATH, loginUrl } from './admin/login-url';
import { OWNER_LOGIN_PATH, ownerLoginUrl } from './owner/login-url';
import { customerAuthUrl } from './customer/login-url';

/**
 * Shared axios instance. Talks to /api (proxied to the NestJS backend in
 * dev via next.config rewrites; set NEXT_PUBLIC_API_URL in prod).
 * withCredentials so the HttpOnly auth cookie rides along.
 */
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? '/api',
  withCredentials: true,
});

/**
 * Customer-surface path prefixes. A 401 here re-opens the auth modal in place
 * instead of navigating to a console login the visitor has no account for.
 */
const CUSTOMER_PREFIXES = ['/account', '/checkout', '/booking', '/boat', '/search'];

/** SWR fetcher. */
export const fetcher = <T>(url: string): Promise<T> =>
  api.get<T>(url).then((r) => r.data);

// ── CSRF ────────────────────────────────────────────────────────────────────
// The backend requires an x-csrf-token header on cookie-authenticated,
// state-changing requests. We fetch the token once (GET /auth/csrf) and attach
// it to every mutating request; a 403 clears it so the next call re-fetches.

let csrfToken: string | null = null;

async function getCsrfToken(): Promise<string | null> {
  if (csrfToken) return csrfToken;
  try {
    const { data } = await api.get<{ csrfToken: string }>('/auth/csrf');
    csrfToken = data.csrfToken;
    return csrfToken;
  } catch {
    return null;
  }
}

/**
 * Drop the cached CSRF token.
 *
 * The token is bound to the hb_sid session cookie, so it must be cleared
 * whenever that cookie changes — on logout AND after a fresh login. Keeping a
 * token minted against a previous session produces a confusing 403 on the
 * first mutation of the new one.
 */
export function clearCsrfToken(): void {
  csrfToken = null;
}

/**
 * Drop the cached token AND await a fresh one bound to the current session.
 *
 * Call this right after a login/register response lands. Those endpoints mint a
 * new hb_sid, and the CSRF hash is bound to it (see getSessionIdentifier in
 * backend security/csrf.ts), so every token minted earlier is now invalid.
 *
 * clearCsrfToken() alone is not enough: it only empties the cache, leaving the
 * request interceptor to refill it lazily on the next mutating call. That is a
 * race — the first mutation after signing in can go out carrying a token minted
 * against the OLD session and come back 403. Awaiting the fetch here makes the
 * cache correct before the caller continues.
 */
export async function refreshCsrfToken(): Promise<void> {
  csrfToken = null;
  await getCsrfToken();
}

/**
 * The cached CSRF token, for the rare request that cannot go through the axios
 * interceptor — specifically a `fetch(..., {keepalive:true})` fired while the
 * page is being torn down, where there is no time to await a token fetch.
 *
 * Returns null if nothing has been cached yet; the caller should treat the
 * request as best-effort. (`navigator.sendBeacon` cannot set headers at all,
 * which is why it is unusable for CSRF-protected routes.)
 */
export function getCachedCsrfToken(): string | null {
  return csrfToken;
}

const MUTATING = new Set(['post', 'put', 'patch', 'delete']);

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const method = (config.method ?? 'get').toLowerCase();
  if (MUTATING.has(method) && !config.url?.includes('/auth/csrf')) {
    const token = await getCsrfToken();
    if (token) config.headers.set('x-csrf-token', token);
  }
  return config;
});

// ── Session refresh ─────────────────────────────────────────────────────────
// The access cookie lasts 15 minutes. On a 401 we try exactly one refresh and
// replay the original request, so an expired token is invisible to the user.
// Concurrent 401s share a single refresh so we don't rotate the token N times
// (rotation is single-use server-side — parallel refreshes would revoke each
// other and log the user out).

// Where to send someone whose session cannot be recovered — see
// lib/admin/login-url.ts. Shared so the path isn't duplicated across the
// middleware, the console layout, and here.

let refreshing: Promise<void> | null = null;

function refreshSession(): Promise<void> {
  refreshing ??= api
    .post('/auth/refresh')
    .then(() => {
      // hb_sid rotates on refresh, so the cached CSRF token is now stale.
      csrfToken = null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const status = error?.response?.status;
    const config = error?.config as
      | (InternalAxiosRequestConfig & { _retried?: boolean })
      | undefined;
    const url: string = config?.url ?? '';

    // A CSRF failure → drop the token so the next mutating call re-fetches.
    if (status === 403) csrfToken = null;

    // Never try to refresh a failed auth call itself — that recurses.
    //
    // /auth/register belongs here too: a failed sign-up has no session to
    // recover, and letting it fall through means the refresh fails and the
    // catch below HARD-NAVIGATES the browser — tearing down the auth modal and
    // everything the user typed, instead of showing them the error.
    const isAuthCall =
      url.includes('/auth/refresh') ||
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/logout');

    // A stale CSRF token → self-heal. The token hash is bound to the hb_sid
    // session cookie (backend security/csrf.ts), and that cookie rotates on
    // login/register and on silent refresh. Any cached token minted against a
    // prior session then 403s the first mutation of the new one — e.g. checkout
    // Pay right after signing in. We already dropped the cache above; here we
    // await a fresh token bound to the CURRENT session and replay the request
    // once, so the failure never reaches the user.
    //
    // Gate on the csrf-csrf error message so genuine authorization 403s
    // ("Forbidden resource" from Nest) are NOT replayed. The CSRF middleware
    // runs before Nest routing (backend main.ts), so its body is the
    // http-errors default carrying this exact message.
    const isCsrfFailure =
      status === 403 &&
      error?.response?.data?.message === 'invalid csrf token';

    if (isCsrfFailure && config && !config._retried && !isAuthCall) {
      config._retried = true;
      await refreshCsrfToken();
      return api(config);
    }

    if (status === 401 && config && !config._retried && !isAuthCall) {
      config._retried = true;
      try {
        await refreshSession();
        return api(config);
      } catch {
        // Refresh failed: the session is genuinely gone.
        if (typeof window !== 'undefined') {
          csrfToken = null;
          const path = window.location.pathname;
          // Route the bounce to the surface the user was actually in. The three
          // builders are not interchangeable: each clamps ?next= to its own path
          // prefix, so using the admin one for an owner would drop the
          // destination AND land them on the wrong login form.
          //
          // Customers have no login page — they get the auth modal re-opened on
          // the page they are already standing on, so nothing they typed is
          // lost. (Before this branch existed, an expired customer was sent to
          // the ADMIN login, which is not even their account type.)
          if (CUSTOMER_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))) {
            window.location.assign(
              customerAuthUrl({
                path: path + window.location.search,
                reason: 'session_expired',
              }),
            );
          } else {
            const inOwner = path.startsWith('/owner');
            const loginPath = inOwner ? OWNER_LOGIN_PATH : LOGIN_PATH;
            const build = inOwner ? ownerLoginUrl : loginUrl;
            if (!path.startsWith(loginPath)) {
              // Preserve where they were so sign-in returns them there.
              window.location.assign(
                build({
                  next: path + window.location.search,
                  reason: 'session_expired',
                }),
              );
            }
          }
        }
      }
    }

    return Promise.reject(error);
  },
);

// ── Typed contract helpers ───────────────────────────────────────────────────
// The generated OpenAPI types back your call sites. Two convenient aliases:
//
//   type Dto = Schema<'LoginDto'>;                 // a request/response model
//   type Body = ReqBody<'/auth/login', 'post'>;    // a specific endpoint body
//
// e.g.  await api.post('/auth/login', body as ReqBody<'/auth/login','post'>)

/** A named schema (DTO) from the OpenAPI contract. */
export type Schema<N extends keyof components['schemas']> =
  components['schemas'][N];

/** The JSON request body for a given path + method. */
export type ReqBody<
  P extends keyof paths,
  M extends keyof paths[P],
> = paths[P][M] extends {
  requestBody: { content: { 'application/json': infer B } };
}
  ? B
  : never;

export type { paths, components };
