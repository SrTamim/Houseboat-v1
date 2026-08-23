import { cookies } from 'next/headers';

export interface CustomerUser {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  phoneVerified: boolean;
  isPlatform: boolean;
  /** National ID / passport (plaintext), null if not set. */
  nid?: string | null;
}

/**
 * Server-side API origin. Must be absolute: a relative '/api/...' fetch has no
 * origin on the server, so this bypasses the Next rewrite and talks to the
 * backend directly.
 */
const API_ORIGIN = process.env.API_PROXY_TARGET ?? 'http://localhost:4000';

/**
 * Outcome of a customer session check. Simpler than the owner's: a customer is
 * just any signed-in Account — there is no boat/role gate, so no `no_boats`.
 *  - anonymous   → not signed in; send to login with ?next=
 *  - unavailable → the API is down; don't misreport as signed-out.
 */
export type CustomerSessionResult =
  | { status: 'authenticated'; user: CustomerUser }
  | { status: 'anonymous' }
  | { status: 'unavailable' };

/**
 * Resolve the signed-in customer.
 *
 * Calls ONLY GET /auth/me — deliberately NOT /me/boats (that classifies an
 * account by boat membership, which a customer lacks; using it here would reject
 * every legitimate customer). This is the authoritative gate for /account/*;
 * middleware.ts only checks that a cookie exists (Edge has no JWT secret).
 */
export async function getCustomerSession(): Promise<CustomerSessionResult> {
  const jar = await cookies();
  const cookieHeader = jar.toString();
  if (!cookieHeader) return { status: 'anonymous' };

  let meRes: Response;
  try {
    meRes = await fetch(`${API_ORIGIN}/api/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
  } catch {
    return { status: 'unavailable' };
  }

  if (meRes.status === 401 || meRes.status === 403) return { status: 'anonymous' };
  if (meRes.status >= 500) return { status: 'unavailable' };
  if (!meRes.ok) return { status: 'anonymous' };

  try {
    const user = (await meRes.json()) as CustomerUser;
    return { status: 'authenticated', user };
  } catch {
    return { status: 'unavailable' };
  }
}
