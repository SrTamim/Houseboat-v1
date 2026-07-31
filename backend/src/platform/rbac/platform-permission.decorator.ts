import { SetMetadata } from '@nestjs/common';
import type {
  PlatformPermAction,
  PlatformPermModule,
} from './platform-permission.types';

export const PLATFORM_PERMISSION_KEY = 'platformPermission';

export interface RequiredPlatformPermission {
  module: PlatformPermModule;
  action: PlatformPermAction;
}

/**
 * Declare the platform permission a route needs. Class-level sets the
 * controller default; a handler-level decorator overrides it (reflector is
 * handler-first, same mechanics as @RequirePermission).
 */
export const PlatformPermission = (
  module: PlatformPermModule,
  action: PlatformPermAction,
) => SetMetadata(PLATFORM_PERMISSION_KEY, { module, action });
