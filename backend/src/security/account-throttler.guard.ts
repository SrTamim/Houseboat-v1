import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limits per account when the caller is authenticated, per IP otherwise.
 *
 * Keying purely on IP is wrong in both directions: users behind one NAT/mobile
 * carrier gateway share a bucket and lock each other out, while an attacker
 * with many IPs gets the full per-IP allowance against a single account.
 *
 * JwtAuthGuard runs before this one (see app.module.ts guard order), so
 * req.user is already populated for authenticated routes. Unauthenticated
 * routes — /auth/login in particular — necessarily fall back to IP, which is
 * why `trust proxy` must be set correctly in main.ts; without it every request
 * behind the platform proxy reports the same address.
 */
@Injectable()
export class AccountThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = (req?.user as { id?: string } | undefined)?.id;
    if (userId) return `account:${userId}`;
    return `ip:${req?.ip ?? 'unknown'}`;
  }
}
