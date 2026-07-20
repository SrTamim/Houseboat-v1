/** JWT access-token payload. Kept small — role/permission checks hit the DB
 *  per request (see RbacService) so a stale token can't grant stale access. */
export interface JwtPayload {
  sub: string; // account id
  isPlatform: boolean;
  type: 'access' | 'refresh';
  jti?: string; // present on refresh tokens — used for revocation
}

/** Shape attached to req.user after AuthGuard runs. */
export interface AuthUser {
  id: string;
  isPlatform: boolean;
}

/** Normalise a BD phone to canonical +8801XXXXXXXXX form. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('8801')) return `+${digits}`;
  if (digits.startsWith('01')) return `+88${digits}`;
  return `+${digits}`;
}
