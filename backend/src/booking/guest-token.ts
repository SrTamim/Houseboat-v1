import { randomUUID } from 'crypto';
import type { CookieOptions, Request, Response } from 'express';

/**
 * Per-browser id for signed-out visitors who take cabin holds.
 *
 * A cabin hold must have exactly one owner: an account, or — for a visitor who
 * has not signed in — this token. It is NOT a session and grants nothing. It
 * only answers "is this the same browser that took the hold?", which is what
 * lets `release()` refuse to free someone else's cabin.
 *
 * When the visitor logs in, HoldsService.claimForAccount() moves their live
 * holds onto the account and clears the token, because checkout converts holds
 * by account id.
 *
 * httpOnly so page scripts cannot read or forge it. Not security-critical —
 * worst case a visitor frees a cabin they took in another tab — but there is no
 * reason to expose it.
 */
export const GUEST_COOKIE = 'hb_gid';

/** Matches the auth cookies' cross-site rules (see AuthController.cookieBase). */
function guestCookieOptions(secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
    // Comfortably longer than a hold's 10-minute TTL so a slow booker keeps the
    // same identity, short enough that it is not a durable tracking id.
    maxAge: 24 * 60 * 60 * 1000,
  };
}

/** Read the caller's guest id, if their browser already has one. */
export function readGuestToken(req: Request): string | null {
  const cookies = (req as Request & { cookies?: Record<string, string> })
    .cookies;
  return cookies?.[GUEST_COOKIE] ?? null;
}

/**
 * Read the guest id, minting and setting one when absent. Only call this on a
 * request that is actually about to take a hold — issuing the cookie on every
 * page view would tag readers who never book anything.
 */
export function ensureGuestToken(
  req: Request,
  res: Response,
  secure: boolean,
): string {
  const existing = readGuestToken(req);
  if (existing) return existing;
  const token = randomUUID();
  res.cookie(GUEST_COOKIE, token, guestCookieOptions(secure));
  return token;
}
