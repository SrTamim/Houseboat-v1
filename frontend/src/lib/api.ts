import axios, { type InternalAxiosRequestConfig } from 'axios';
import type { paths, components } from './api-types';

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

/** Call after logout so a stale token isn't reused across sessions. */
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

api.interceptors.response.use(
  (r) => r,
  (error) => {
    // A CSRF failure → drop the token so the next mutating call re-fetches.
    if (error?.response?.status === 403) csrfToken = null;
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
