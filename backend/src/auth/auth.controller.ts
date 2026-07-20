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

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    @Inject(CSRF_UTILS) private readonly csrf: CsrfUtils,
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

  private setAuthCookies(res: Response, access: string, refresh: string): void {
    res.cookie(ACCESS_COOKIE, access, {
      ...this.cookieBase(),
      maxAge: 15 * 60 * 1000, // 15m
    });
    res.cookie(REFRESH_COOKIE, refresh, {
      ...this.cookieBase(),
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30d
    });
  }

  /** Stable per-login id for CSRF binding — survives access-token rotation. */
  private setSessionCookie(res: Response): void {
    res.cookie(SESSION_COOKIE, randomUUID(), {
      ...this.cookieBase(),
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30d
    });
  }

  // Brute-force floor on credential endpoints — tighter than the global limit.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { account, tokens } = await this.auth.register(dto);
    this.setAuthCookies(res, tokens.access, tokens.refresh);
    this.setSessionCookie(res);
    return { account };
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { account, tokens } = await this.auth.login(dto);
    this.setAuthCookies(res, tokens.access, tokens.refresh);
    this.setSessionCookie(res);
    return { account };
  }

  /**
   * Hand the SPA a CSRF token (and set its matching cookie). Call right after
   * login and reuse the token for the session's state-changing requests. Safe
   * (GET) so it isn't itself CSRF-protected.
   */
  @Get('csrf')
  getCsrf(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return { csrfToken: this.csrf.generateToken(req, res) };
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
    this.setAuthCookies(res, tokens.access, tokens.refresh);
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
