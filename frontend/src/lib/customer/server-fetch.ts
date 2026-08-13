import 'server-only';

/**
 * Server-side GET against the backend for public customer data. Absolute origin
 * (a relative '/api/...' has no origin on the server, so it bypasses the Next
 * rewrite). Public endpoints only — no cookies forwarded. Returns null on any
 * failure so pages can render a graceful "unavailable" state instead of throwing.
 */
const API_ORIGIN = process.env.API_PROXY_TARGET ?? 'http://localhost:4000';

export async function serverGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_ORIGIN}/api${path}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
