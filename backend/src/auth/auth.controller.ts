import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { randomUUID } from 'crypto';
import { Request, Response, CookieOptions } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { Public, CurrentUser } from './decorators';
import { AuthUser } from './auth.types';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  SESSION_COOKIE,
} from './jwt-auth.guard';
import { CSRF_UTILS, CsrfUtils } from '../security/csrf.module';
import { Inject } from '@nestjs/common';
import { HoldsService } from '../booking/holds.service';
import { GUEST_COOKIE, readGuestToken } from '../booking/guest-token';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    @Inject(CSRF_UTILS) private readonly csrf: CsrfUtils,
    private readonly holds: HoldsService,
  ) {}

  private cookieBase(): CookieOptions {
    const secure = this.config.get<boolean>('auth.cookieSecure') ?? false;
    return {
      httpOnly: true,
      secure,
      // Prod: web (Vercel) and api (Railway) are different sites, so auth
      // cookies must be SameSite=None to flow cross-site — which requires
      // Secure. Dev (same-site localhost) uses Lax.
      sameSite: secure ? 'none' : 'lax',
      path: '/',
    };
  }

  private setAuthCookies(
    res: Response,
    access: string,
    refresh: string,
    rememberMe = false,
  ): void {
    res.cookie(ACCESS_COOKIE, access, {
      ...this.cookieBase(),
      maxAge: 15 * 60 * 1000, // 15m — middleware refreshes it silently
    });
    res.cookie(REFRESH_COOKIE, refresh, {
      ...this.cookieBase(),
      // Remembered: persist 30d. Otherwise session-scoped (no maxAge) so it
      // drops when the browser closes. The refresh JWT still carries its own
      // 30d expiry either way; the cookie is what makes it survive a restart.
      ...(rememberMe ? { maxAge: 30 * 24 * 60 * 60 * 1000 } : {}),
    });
  }

  /** Stable per-login id for CSRF binding — survives access-token rotation. */
  private setSessionCookie(res: Response, rememberMe = false): void {
    res.cookie(SESSION_COOKIE, randomUUID(), {
      ...this.cookieBase(),
      // Track the refresh cookie's lifetime so CSRF binding lasts exactly as
      // long as the session it protects.
      ...(rememberMe ? { maxAge: 30 * 24 * 60 * 60 * 1000 } : {}),
    });
  }

  // Brute-force floor on credential endpoints — tighter than the global limit.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { account, tokens } = await this.auth.register(dto);
    this.setAuthCookies(res, tokens.access, tokens.refresh);
    this.setSessionCookie(res);

    // Same hand-over as login — see the comment there. Registering mid-checkout
    // is now the common path (sign-up is a modal on the checkout page), so a
    // first-time customer holding cabins would otherwise lose them at the one
    // moment it matters most. Never block registration on this.
    const guestToken = readGuestToken(req);
    if (guestToken) {
      try {
        await this.holds.claimForAccount(guestToken, account.id);
        res.clearCookie(GUEST_COOKIE, { path: '/' });
      } catch {
        // Claim failed — checkout's token fallback still covers it.
      }
    }

    return { account };
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Pass the request so successes AND failures are audited with origin.
    const { account, tokens } = await this.auth.login(dto, req);
    this.setAuthCookies(res, tokens.access, tokens.refresh, tokens.remember);
    this.setSessionCookie(res, tokens.remember);

    // Hand over any cabins this browser was holding before signing in.
    // Load-bearing: BookingService.checkout() converts holds by account id, so a
    // hold still owned by the guest token would match nothing and the
    // customer's own checkout would fail with "a held cabin expired or was
    // taken". Never block login on this.
    const guestToken = readGuestToken(req);
    if (guestToken) {
      try {
        await this.holds.claimForAccount(guestToken, account.id);
        res.clearCookie(GUEST_COOKIE, { path: '/' });
      } catch {
        // Claim failed — checkout's token fallback still covers it.
      }
    }

    return { account };
  }

  /**
   * Hand the SPA a CSRF token (and set its matching cookie). Call right after
   * login and reuse the token for the session's state-changing requests. Safe
   * (GET) so it isn't itself CSRF-protected.
   *
   * @Public() because the token is needed BEFORE a session exists — the login
   * POST itself carries it. Requiring auth here deadlocks the sign-in form:
   * it can't get a token without a session, and can't get a session without
   * submitting. Handing an anonymous caller a CSRF token is harmless; the
   * token proves the request came from our page, not that anyone is logged in.
   */
  @Public()
  @Get('csrf')
  getCsrf(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // overwrite=true is required, not optional.
    //
    // The CSRF cookie's hash is bound to hb_sid (see getSessionIdentifier in
    // security/csrf.ts). With the default overwrite=false, generateToken tries
    // to REUSE an existing hb_csrf cookie and — because validateOnReuse
    // defaults to true — throws 'invalid csrf token' when the hash no longer
    // matches the current session id.
    //
    // Logging in sets a fresh hb_sid, which invalidates every token minted
    // before it. That made this endpoint throw 403 for the rest of the
    // session: the only route that can issue a token refused to, so the SPA
    // could never recover and every subsequent login POST failed. Always mint
    // against the CURRENT session instead.
    return { csrfToken: this.csrf.generateToken(req, res, true) };
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Public()
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies = (req as Request & { cookies?: Record<string, string> })
      .cookies;
    const token = cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException('No refresh token');
    const tokens = await this.auth.refresh(token);
    // Only the auth cookies rotate here. hb_sid is deliberately NOT re-issued:
    // the CSRF token is bound to it, so minting a new sid would invalidate the
    // client's cached CSRF token and 403 its next state-changing request. The
    // sid set at login already carries the right lifetime.
    this.setAuthCookies(res, tokens.access, tokens.refresh, tokens.remember);
    return { ok: true };
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies = (req as Request & { cookies?: Record<string, string> })
      .cookies;
    const token = cookies?.[REFRESH_COOKIE];
    if (token) await this.auth.revokeRefresh(token);
    res.clearCookie(ACCESS_COOKIE, this.cookieBase());
    res.clearCookie(REFRESH_COOKIE, this.cookieBase());
    res.clearCookie(SESSION_COOKIE, this.cookieBase());
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
