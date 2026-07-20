import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IS_PUBLIC_KEY, IS_PLATFORM_KEY } from './decorators';
import { JwtPayload } from './auth.types';

export const ACCESS_COOKIE = 'hb_access';
export const REFRESH_COOKIE = 'hb_refresh';
/** Stable per-login session id — outlives access-token rotation. Used as the
 *  CSRF session identifier so refreshing the access token doesn't void the
 *  SPA's CSRF token. */
export const SESSION_COOKIE = 'hb_sid';

/**
 * Reads the access JWT from the HttpOnly cookie (falls back to Bearer header
 * for API clients / tests). Attaches { id, isPlatform } to req.user.
 * Honors @Public() and @PlatformOnly().
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const req = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(req);

    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('Not authenticated');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('auth.jwtSecret'),
      });
    } catch {
      if (isPublic) return true;
      throw new UnauthorizedException('Invalid or expired session');
    }
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Wrong token type');
    }

    (req as Request & { user: unknown }).user = {
      id: payload.sub,
      isPlatform: payload.isPlatform,
    };

    const platformOnly = this.reflector.getAllAndOverride<boolean>(
      IS_PLATFORM_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (platformOnly && !payload.isPlatform) {
      throw new ForbiddenException('Platform staff only');
    }

    return true;
  }

  private extractToken(req: Request): string | null {
    const cookies = (req as Request & { cookies?: Record<string, string> })
      .cookies;
    if (cookies?.[ACCESS_COOKIE]) return cookies[ACCESS_COOKIE];
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) return auth.slice(7);
    return null;
  }
}
