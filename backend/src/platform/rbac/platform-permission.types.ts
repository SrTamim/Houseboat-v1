import { BadRequestException } from '@nestjs/common';

/**
 * Permission modules for PLATFORM staff, mapped to console sections:
 *  boats    — moderation (boats, routes screens)
 *  finance  — invoices, payouts, refunds, billing, coupons, debtors, analytics
 *  ops      — bookings, waitlist, reviews, reschedules, notifications, cutoff, audit
 *  accounts — account + membership directory
 *  roles    — platform RBAC management
 *  settings — config status
 *
 * Distinct from the per-boat rbac/permission.types.ts — that governs what a
 * boat member can do on their boat; this governs what platform staff can do
 * across all boats.
 */
export const PLATFORM_MODULES = [
  'boats',
  'finance',
  'ops',
  'accounts',
  'roles',
  'settings',
] as const;

export type PlatformPermModule = (typeof PLATFORM_MODULES)[number];
export type PlatformPermAction = 'view' | 'edit';

export type PlatformPermissionMap = Partial<
  Record<PlatformPermModule, { view?: boolean; edit?: boolean }>
>;

const ACTIONS: readonly string[] = ['view', 'edit'];

/**
 * Validate an untrusted permissions object. Throws on unknown modules,
 * unknown actions, or non-boolean values — a typo'd module name must fail
 * loudly at write time, not silently deny at check time.
 */
export function validatePlatformPermissionMap(
  input: unknown,
): PlatformPermissionMap {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('permissions must be an object');
  }
  for (const [module, actions] of Object.entries(input)) {
    if (!(PLATFORM_MODULES as readonly string[]).includes(module)) {
      throw new BadRequestException(`Unknown platform module: ${module}`);
    }
    if (actions === null || typeof actions !== 'object' || Array.isArray(actions)) {
      throw new BadRequestException(`permissions.${module} must be an object`);
    }
    for (const [action, value] of Object.entries(actions)) {
      if (!ACTIONS.includes(action)) {
        throw new BadRequestException(
          `Unknown action on ${module}: ${action}`,
        );
      }
      if (typeof value !== 'boolean') {
        throw new BadRequestException(
          `permissions.${module}.${action} must be a boolean`,
        );
      }
    }
  }
  return input as PlatformPermissionMap;
}
