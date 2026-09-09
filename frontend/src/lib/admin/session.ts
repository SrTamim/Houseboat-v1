import { cookies } from 'next/headers';

/** Per-page platform permissions, `{ [navKey]: { view, edit } }`. */
export type PlatformPermissionMap = Record<
  string,
  { view?: boolean; edit?: boolean }
>;

export interface AdminUser {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  isPlatform: boolean;
  /**
   * Effective per-page permissions for nav-gating. `null` = superadmin (no role
   * assigned) → treated as allow-all. Absent on an older /auth/me payload is
   * likewise treated as allow-all, so a rollout skew never locks staff out.
   */
  platformPermissions?: PlatformPermissionMap | null;
}

/**
 * Server-side API origin.
 *
 * Must be absolute: a relative '/api/...' fetch has no origin on the server.
 * This deliberately bypasses the Next rewrite and talks to the backend
 * directly, so it works during SSR where no browser is involved.
 */
const API_ORIGIN = process.env.API_PROXY_TARGET ?? 'http://localhost:4000';

/**
 * Outcome of a session check.
 *
 * 'anonymous' and 'unavailable' are deliberately distinct. Collapsing both to
 * null meant an API outage was reported to the user as "signed out": a valid
 * admin got dumped on the login page, typed a correct password, and that failed
 * too — with no indication the backend was the problem.
 */
export type SessionResult =
  | { status: 'authenticated'; user: AdminUser }
  | { status: 'anonymous' }
  | { status: 'unavailable' };

/**
 * Resolve the signed-in user from the request's cookies.
 *
 * This is the authoritative session check for the console. middleware.ts only
 * checks that a cookie is present — it runs on the Edge with no JWT secret, so
 * a forged value passes it. Here the backend actually verifies the token.
 */
export async function getAdminSession(): Promise<SessionResult> {
  const jar = await cookies();
  const cookieHeader = jar.toString();
  if (!cookieHeader) return { status: 'anonymous' };

  let res: Response;
  try {
    res = await fetch(`${API_ORIGIN}/api/auth/me`, {
      headers: { cookie: cookieHeader },
      // Session state must never be cached across requests or users.
      cache: 'no-store',
    });
  } catch {
    // Network-level failure: the backend is down or unreachable. This says
    // nothing about whether the session is valid.
    return { status: 'unavailable' };
  }

  // The backend rejected the credentials — genuinely signed out.
  if (res.status === 401 || res.status === 403) return { status: 'anonymous' };
  // The backend is up but broken. Same user-facing treatment as unreachable.
  if (res.status >= 500) return { status: 'unavailable' };
  if (!res.ok) return { status: 'anonymous' };

  try {
    return { status: 'authenticated', user: (await res.json()) as AdminUser };
  } catch {
    // 200 with an unparseable body means the contract is broken, not the user.
    return { status: 'unavailable' };
  }
}
