/**
 * Shared login-redirect vocabulary.
 *
 * Deliberately dependency-free: this is imported from the Edge middleware, from
 * Server Components, AND from the client bundle. Anything pulled in here has to
 * run in all three, so keep it to plain TS.
 *
 * Before this existed, '/admin/login' was hardcoded in four places and each
 * redirect hop rebuilt (or silently dropped) the ?next= destination.
 */

export const LOGIN_PATH = '/admin/login';
export const DASHBOARD_PATH = '/admin/dashboard';

/** Why the visitor was sent to the login page. Drives the message shown there. */
export type LoginReason = 'not_staff' | 'backend_down' | 'session_expired';

/**
 * Clamp a post-login destination to a same-origin admin path.
 *
 * Mirrors safeNext() in the login page — the clamp deliberately exists on BOTH
 * sides, because this one guards what we *write* into the URL and that one
 * guards what we *read* back out of it. Neither should trust the other.
 *
 * "//evil.com" is a protocol-relative URL, so a startsWith('/') test alone is
 * not sufficient. Backslashes are rejected too: some browsers normalise them to
 * forward slashes, which would smuggle "/\evil.com" past the check.
 *
 * Returns null when the value is unusable, so callers can omit ?next= entirely
 * rather than emitting an empty param.
 */
export function safeNextTarget(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  if (raw.includes('\\')) return null;
  return raw.startsWith('/admin') ? raw : null;
}

/**
 * Build a login URL, preserving where the visitor was headed.
 *
 * Pass next:null (or omit it) to deliberately drop the destination — used for
 * the non-staff bounce, where returning them to the console they can't enter
 * would just loop them straight back here.
 */
export function loginUrl(
  opts: { next?: string | null; reason?: LoginReason } = {},
): string {
  const params = new URLSearchParams();

  const next = safeNextTarget(opts.next);
  // Never point ?next= back at the login page itself — that produces a
  // post-login redirect to the form the user just submitted.
  if (next && !next.startsWith(LOGIN_PATH)) params.set('next', next);

  if (opts.reason) params.set('error', opts.reason);

  const qs = params.toString();
  return qs ? `${LOGIN_PATH}?${qs}` : LOGIN_PATH;
}
