/**
 * Owner-console login-redirect vocabulary.
 *
 * Deliberately dependency-free: imported from the Edge middleware, from Server
 * Components AND from the client bundle, so it has to run in all three.
 *
 * A parallel of lib/admin/login-url.ts rather than a shared module, because the
 * clamp target differs — admin's safeNextTarget only admits /admin paths, and
 * reusing it here would silently drop every owner destination.
 */

export const OWNER_LOGIN_PATH = '/owner/login';
export const OWNER_SIGNUP_PATH = '/owner/signup';
export const OWNER_DASHBOARD_PATH = '/owner/dashboard';

/**
 * Why the visitor was sent to the login page.
 *  - not_owner: signed in, but the account operates no boats.
 *  - backend_down: the API could not be reached, so we can't tell.
 *  - session_expired: no (or stale) session cookie.
 */
export type OwnerLoginReason = 'not_owner' | 'backend_down' | 'session_expired';

/**
 * Clamp a post-login destination to a same-origin owner path.
 *
 * "//evil.com" is protocol-relative, so startsWith('/') alone is not enough.
 * Backslashes are rejected too: some browsers normalise them to forward
 * slashes, which would smuggle "/\evil.com" past the check.
 *
 * Returns null when unusable so callers can omit ?next= rather than emit an
 * empty param.
 */
export function safeOwnerNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  if (raw.includes('\\')) return null;
  return raw.startsWith('/owner') ? raw : null;
}

/**
 * Build an owner login URL, preserving where the visitor was headed.
 *
 * Pass next:null (or omit) to deliberately drop the destination — used for the
 * not_owner bounce, where returning them to a console they cannot enter would
 * loop them straight back here.
 */
export function ownerLoginUrl(
  opts: { next?: string | null; reason?: OwnerLoginReason } = {},
): string {
  const params = new URLSearchParams();

  const next = safeOwnerNext(opts.next);
  // Never point ?next= at the login or signup page itself.
  if (
    next &&
    !next.startsWith(OWNER_LOGIN_PATH) &&
    !next.startsWith(OWNER_SIGNUP_PATH)
  ) {
    params.set('next', next);
  }

  if (opts.reason) params.set('error', opts.reason);

  const qs = params.toString();
  return qs ? `${OWNER_LOGIN_PATH}?${qs}` : OWNER_LOGIN_PATH;
}
