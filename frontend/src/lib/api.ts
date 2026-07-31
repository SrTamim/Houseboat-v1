import axios, { type InternalAxiosRequestConfig } from 'axios';
import type { paths, components } from './api-types';
import { LOGIN_PATH, loginUrl } from './admin/login-url';

/**
 * Shared axios instance. Talks to /api (proxied to the NestJS backend in
 * dev via next.config rewrites; set NEXT_PUBLIC_API_URL in prod).
 * withCredentials so the HttpOnly auth cookie rides along.
 */
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? '/api',
  withCredentials: true,
});

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
    const isAuthCall =
      url.includes('/auth/refresh') ||
      url.includes('/auth/login') ||
      url.includes('/auth/logout');

    if (status === 401 && config && !config._retried && !isAuthCall) {
      config._retried = true;
      try {
        await refreshSession();
        return api(config);
      } catch {
        // Refresh failed: the session is genuinely gone.
        if (typeof window !== 'undefined') {
          csrfToken = null;
          if (!window.location.pathname.startsWith(LOGIN_PATH)) {
            // Preserve where they were so sign-in returns them there.
            // loginUrl() clamps the destination, so a 401 on the public site
            // yields a bare login path rather than a non-admin ?next=.
            window.location.assign(
              loginUrl({
                next: window.location.pathname + window.location.search,
                reason: 'session_expired',
              }),
            );
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
