import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../auth/auth.types';
import {
  PLATFORM_PERMISSION_KEY,
  RequiredPlatformPermission,
} from './platform-permission.decorator';
import type { PlatformPermissionMap } from './platform-permission.types';

/**
 * Runs after JwtAuthGuard + PermissionGuard. No-op unless the route declares
 * @PlatformPermission.
 *
 * Checks the DATABASE, not the JWT: isPlatform is a JWT claim, so a revoked
 * staffer's token stays "platform" until it expires (≤15m). Because every
 * platform route carries this decorator, re-reading the account here makes
 * staff revocation effective on the very next request console-wide. Grants in
 * the other direction still wait for a token refresh (the JWT-level
 * @PlatformOnly gate runs first), which only ever delays MORE access — fine.
 *
 * platformRole === null on a platform account = unrestricted superadmin
 * (the backward-compat contract; seeded maker/checker admins have no role).
 * `edit` implies `view` so a role can never mutate what it cannot list.
 *
 * Cost: one indexed PK read on a small table per decorated request. Cache in
 * Redis if console traffic ever warrants it.
 */
@Injectable()
export class PlatformPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required =
      this.reflector.getAllAndOverride<RequiredPlatformPermission>(
        PLATFORM_PERMISSION_KEY,
        [context.getHandler(), context.getClass()],
      );
    if (!required) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = req.user;
    if (!user) return false; // JwtAuthGuard should have set this

    const account = await this.prisma.account.findUnique({
      where: { id: user.id },
      select: {
        isPlatform: true,
        platformRole: { select: { permissions: true } },
      },
    });
    if (!account?.isPlatform) {
      throw new ForbiddenException('Platform staff only');
    }
    if (!account.platformRole) return true; // superadmin

    const perms = account.platformRole.permissions as PlatformPermissionMap;
    const modulePerms = perms[required.module];
    const allowed =
      required.action === 'view'
        ? modulePerms?.view === true || modulePerms?.edit === true
        : modulePerms?.edit === true;
    if (!allowed) {
      throw new ForbiddenException(
        `Missing platform permission: ${required.module}/${required.action}`,
      );
    }
    return true;
  }
}
