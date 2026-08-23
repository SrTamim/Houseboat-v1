import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RbacService } from './rbac.service';
import {
  PERMISSION_KEY,
  RequiredPermission,
} from './require-permission.decorator';
import { AuthUser } from '../auth/auth.types';

/**
 * Runs after JwtAuthGuard. If the handler declares @RequirePermission, resolves
 * the boat id from the request and asserts the caller's per-boat permission.
 * Attaches the resolved BoatContext to req.boatContext for downstream use.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const perm = this.reflector.getAllAndOverride<RequiredPermission>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!perm) return true; // no per-boat requirement on this route

    const req = context.switchToHttp().getRequest<
      Request & { user?: AuthUser; boatContext?: unknown }
    >();
    const user = req.user;
    if (!user) return false; // JwtAuthGuard should have set this

    const from = perm.boatIdFrom ?? 'params';
    const key = perm.boatIdKey ?? 'houseboatId';
    const bag = (req as unknown as Record<string, Record<string, string>>)[from];
    const houseboatId = bag?.[key];
    if (!houseboatId) {
      // Don't echo the internal lookup location (params/body/query) back to
      // the caller — that describes our routing, not their mistake.
      throw new BadRequestException(`Missing ${key}`);
    }

    // A route several pages share lists them in `anyOf` — the caller passes with
    // the permission on any one. Otherwise the single `module` is required.
    const ctx =
      perm.anyOf && perm.anyOf.length > 0
        ? await this.rbac.assertAny(
            user.id,
            user.isPlatform,
            houseboatId,
            [perm.module, ...perm.anyOf],
            perm.action,
            { bypassBillingLock: perm.allowWhenLocked },
          )
        : await this.rbac.assert(
            user.id,
            user.isPlatform,
            houseboatId,
            perm.module,
            perm.action,
            { bypassBillingLock: perm.allowWhenLocked },
          );
    req.boatContext = ctx;
    return true;
  }
}
