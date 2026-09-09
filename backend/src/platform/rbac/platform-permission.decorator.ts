import { SetMetadata } from '@nestjs/common';
import type {
  PlatformPermAction,
  PlatformPermPage,
} from './platform-permission.types';

export const PLATFORM_PERMISSION_KEY = 'platformPermission';

export interface RequiredPlatformPermission {
  page: PlatformPermPage;
  action: PlatformPermAction;
  /**
   * Shared-read escape hatch: a route several pages consume passes when the
   * caller holds `action` on `page` OR on ANY of these pages. Use for lookups
   * multiple pages depend on (e.g. the invoice list read by verify,
   * booking-invoice, payouts and pay-to-vendors). `page` stays the canonical
   * primary owner. Same mechanics as the per-boat @RequirePermission anyOf.
   */
  anyOf?: PlatformPermPage[];
}

/**
 * Declare the platform permission a route needs. Class-level sets the
 * controller default; a handler-level decorator overrides it (reflector is
 * handler-first, same mechanics as @RequirePermission).
 *
 *   @PlatformPermission('payouts', 'edit')
 *   @PlatformPermission('booking-invoice', 'view', ['verify', 'payouts'])
 */
export const PlatformPermission = (
  page: PlatformPermPage,
  action: PlatformPermAction,
  anyOf?: PlatformPermPage[],
) => SetMetadata(PLATFORM_PERMISSION_KEY, { page, action, anyOf });
