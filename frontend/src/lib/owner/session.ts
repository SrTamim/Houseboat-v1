import { cookies } from 'next/headers';

export interface OwnerUser {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  isPlatform: boolean;
}

/** One row of GET /api/me/boats — the boat switcher's source of truth. */
export interface OwnerBoat {
  houseboatId: string;
  name: string;
  slug: string;
  status: string;
  role: string;
}

/**
 * Server-side API origin. Must be absolute: a relative '/api/...' fetch has no
 * origin on the server, so this bypasses the Next rewrite and talks to the
 * backend directly.
 */
const API_ORIGIN = process.env.API_PROXY_TARGET ?? 'http://localhost:4000';

/**
 * Outcome of an owner session check.
 *
 * 'anonymous', 'no_boats' and 'unavailable' are deliberately distinct:
 *  - anonymous   → not signed in; send to login with ?next=
 *  - no_boats    → signed in, but this account operates no boat. A customer who
 *                  wandered into /owner. Bouncing them with ?next= would loop.
 *  - unavailable → the API is down. Reporting this as "signed out" sends a
 *                  valid owner to a login form that will also fail.
 */
export type OwnerSessionResult =
  | { status: 'authenticated'; user: OwnerUser; boats: OwnerBoat[] }
  | { status: 'no_boats'; user: OwnerUser }
  | { status: 'anonymous' }
  | { status: 'unavailable' };

/** GET against the backend with the caller's cookies attached. */
async function apiGet(path: string, cookieHeader: string): Promise<Response> {
  return fetch(`${API_ORIGIN}${path}`, {
    headers: { cookie: cookieHeader },
    // Session state must never be cached across requests or users.
    cache: 'no-store',
  });
}

/**
 * Resolve the signed-in owner and the boats they operate.
 *
 * Two calls, because GET /auth/me deliberately returns identity only — what a
 * person *is* derives from relations, so boat access comes from /me/boats.
 *
 * This is the authoritative check for the console. middleware.ts only tests
 * that a cookie exists; it runs on the Edge with no JWT secret, so a forged
 * value passes it. Here the backend actually verifies the token.
 */
export async function getOwnerSession(): Promise<OwnerSessionResult> {
  const jar = await cookies();
  const cookieHeader = jar.toString();
  if (!cookieHeader) return { status: 'anonymous' };

  let meRes: Response;
  try {
    meRes = await apiGet('/api/auth/me', cookieHeader);
  } catch {
    return { status: 'unavailable' };
  }

  if (meRes.status === 401 || meRes.status === 403) return { status: 'anonymous' };
  if (meRes.status >= 500) return { status: 'unavailable' };
  if (!meRes.ok) return { status: 'anonymous' };

  let user: OwnerUser;
  try {
    user = (await meRes.json()) as OwnerUser;
  } catch {
    // 200 with an unparseable body means the contract is broken, not the user.
    return { status: 'unavailable' };
  }

  let boatsRes: Response;
  try {
    boatsRes = await apiGet('/api/me/boats', cookieHeader);
  } catch {
    return { status: 'unavailable' };
  }
  if (boatsRes.status >= 500) return { status: 'unavailable' };
  if (!boatsRes.ok) return { status: 'anonymous' };

  let boats: OwnerBoat[];
  try {
    boats = (await boatsRes.json()) as OwnerBoat[];
  } catch {
    return { status: 'unavailable' };
  }

  // Note: isPlatform is NOT required. Owners are not staff — membership of at
  // least one boat is the whole entry condition for this console.
  if (boats.length === 0) return { status: 'no_boats', user };

  return { status: 'authenticated', user, boats };
}
