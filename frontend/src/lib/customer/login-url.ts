/**
 * Customer auth-modal vocabulary.
 *
 * Dependency-free: imported from the Edge middleware, from Server Components AND
 * from the client bundle, so it must run in all three.
 *
 * Customer sign-in is a MODAL, not a page — there is no /account/login route.
 * Callers that can reach into React open it via `useAuthModal()`; callers that
 * only control a URL (a server redirect, a full-page bounce) encode the intent
 * as `?auth=login` and let AuthModalProvider pick it up on mount.
 */

/** Query params AuthModalProvider consumes on mount to auto-open the modal. */
export const AUTH_PARAM = 'auth';
export const NEXT_PARAM = 'next';
export const REASON_PARAM = 'error';

export type AuthMode = 'login' | 'register';

/**
 * Why the visitor is being asked to sign in.
 *  - session_expired: their session cookie was missing or rejected.
 *  - backend_down: the API could not be reached.
 *  - login_required: they hit a gated action (e.g. checkout) while signed out.
 */
export type CustomerLoginReason =
  | 'session_expired'
  | 'backend_down'
  | 'login_required';

/**
 * Copy shown at the top of the modal when it was opened for a reason. Lives here
 * rather than in the component so the middleware/URL vocabulary and the message
 * the user reads cannot drift apart.
 */
export const AUTH_REASON_COPY: Record<CustomerLoginReason, string> = {
  session_expired: 'Your session expired — please sign in again.',
  backend_down: 'We couldn’t reach the server. Try again shortly.',
  login_required: 'Please sign in to continue to checkout.',
};

export function authReasonCopy(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return AUTH_REASON_COPY[raw as CustomerLoginReason] ?? null;
}

/**
 * Paths a post-auth redirect may land on. Customers, unlike owners, legitimately
 * return to the public funnel (checkout) as well as their account area, so the
 * allowlist is broader than a single prefix — but still same-origin only.
 */
const ALLOWED_NEXT_PREFIXES = ['/account', '/checkout', '/booking', '/boat'];

/**
 * Clamp a post-auth destination to a same-origin customer path.
 *
 * "//evil.com" is protocol-relative, so startsWith('/') alone is not enough.
 * Backslashes are rejected too: some browsers normalise them to forward slashes,
 * which would smuggle "/\evil.com" past the check. Returns null when unusable so
 * callers can omit ?next= rather than emit an empty param.
 */
export function safeCustomerNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  if (raw.includes('\\')) return null;
  return ALLOWED_NEXT_PREFIXES.some((p) => raw === p || raw.startsWith(p + '/') || raw.startsWith(p + '?'))
    ? raw
    : null;
}

/**
 * Build a URL that opens the auth modal on `path`.
 *
 * For the callers that cannot simply call openAuth(): a hard client bounce from
 * the axios interceptor, or any server-side redirect. `path` is where the modal
 * should appear — it must already be a real page, since the modal renders over
 * whatever is there.
 */
export function customerAuthUrl(
  opts: {
    path?: string;
    mode?: AuthMode;
    next?: string | null;
    reason?: CustomerLoginReason;
  } = {},
): string {
  const path = opts.path && opts.path.startsWith('/') ? opts.path : '/';
  const [basePath, baseQuery = ''] = path.split('?');
  const params = new URLSearchParams(baseQuery);

  params.set(AUTH_PARAM, opts.mode ?? 'login');

  const next = safeCustomerNext(opts.next);
  if (next) params.set(NEXT_PARAM, next);
  else params.delete(NEXT_PARAM);

  if (opts.reason) params.set(REASON_PARAM, opts.reason);

  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
