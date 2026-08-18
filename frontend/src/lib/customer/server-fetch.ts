import 'server-only';
import { cookies } from 'next/headers';

/**
 * Server-side GET against the backend for public customer data. Absolute origin
 * (a relative '/api/...' has no origin on the server, so it bypasses the Next
 * rewrite). Returns null on any failure so pages can render a graceful
 * "unavailable" state instead of throwing.
 *
 * Cookies are NOT forwarded by default — most of these reads are the same for
 * every visitor and should not depend on who is asking. Pass
 * `{ withCookies: true }` for the endpoints whose answer is viewer-specific:
 * per-cabin availability marks the caller's own holds `held_by_me`, which needs
 * the session or hb_gid cookie to resolve. Same approach getCustomerSession()
 * uses for /auth/me.
 */
const API_ORIGIN = process.env.API_PROXY_TARGET ?? 'http://localhost:4000';

export async function serverGet<T>(
  path: string,
  opts?: { withCookies?: boolean },
): Promise<T | null> {
  try {
    let headers: HeadersInit | undefined;
    if (opts?.withCookies) {
      const jar = await cookies();
      const cookieHeader = jar.toString();
      if (cookieHeader) headers = { cookie: cookieHeader };
    }
    const res = await fetch(`${API_ORIGIN}/api${path}`, {
      cache: 'no-store',
      headers,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
