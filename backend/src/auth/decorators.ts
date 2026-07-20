import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { AuthUser } from './auth.types';

/** Mark a route as not requiring authentication. */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Mark a route as platform-staff only (is_platform = true). */
export const IS_PLATFORM_KEY = 'isPlatformOnly';
export const PlatformOnly = () => SetMetadata(IS_PLATFORM_KEY, true);

/** Inject the authenticated user (set by JwtAuthGuard). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AuthUser;
  },
);
