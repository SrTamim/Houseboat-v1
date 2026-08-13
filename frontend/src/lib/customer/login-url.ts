/**
 * Customer login-redirect vocabulary.
 *
 * Dependency-free: imported from the Edge middleware, from Server Components AND
 * from the client bundle, so it must run in all three.
 *
 * A parallel of lib/owner/login-url.ts rather than a shared module, because the
 * clamp target differs — this admits /account and /checkout destinations, which
 * the owner clamp (only /owner) would silently drop.
 */

export const CUSTOMER_LOGIN_PATH = '/account/login';
export const CUSTOMER_REGISTER_PATH = '/account/register';
export const CUSTOMER_ACCOUNT_PATH = '/account/trips';

/**
 * Why the visitor was sent to login.
 *  - session_expired: no (or stale) session cookie.
 *  - backend_down: the API could not be reached.
 *  - login_required: hit a gated action (e.g. checkout) while signed out.
 */
export type CustomerLoginReason =
  | 'session_expired'
  | 'backend_down'
  | 'login_required';

/**
 * Paths a post-login redirect may land on. Customers, unlike owners, legitimately
 * return to the public funnel (checkout) as well as their account area, so the
 * allowlist is broader than a single prefix — but still same-origin only.
 */
const ALLOWED_NEXT_PREFIXES = ['/account', '/checkout', '/booking', '/boat'];

/**
 * Clamp a post-login destination to a same-origin customer path.
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

/** Build a customer login URL, preserving where the visitor was headed. */
export function customerLoginUrl(
  opts: { next?: string | null; reason?: CustomerLoginReason } = {},
): string {
  const params = new URLSearchParams();

  const next = safeCustomerNext(opts.next);
  // Never point ?next= at the login or register page itself.
  if (
    next &&
    !next.startsWith(CUSTOMER_LOGIN_PATH) &&
    !next.startsWith(CUSTOMER_REGISTER_PATH)
  ) {
    params.set('next', next);
  }

  if (opts.reason) params.set('error', opts.reason);

  const qs = params.toString();
  return qs ? `${CUSTOMER_LOGIN_PATH}?${qs}` : CUSTOMER_LOGIN_PATH;
}
