import { SetMetadata } from '@nestjs/common';
import { PermAction, PermModule } from './permission.types';

export const PERMISSION_KEY = 'requiredPermission';

export interface RequiredPermission {
  module: PermModule;
  action: PermAction;
  /**
   * Shared-read escape hatch: a route consumed by several pages passes when the
   * caller holds `action` on ANY of these pages (in addition to `module`). Use
   * for lookups multiple pages depend on (e.g. the departure roster read by the
   * departure, schedule and pos pages) so a role scoped to any one consumer can
   * still reach it. `module` stays the canonical/primary owner.
   */
  anyOf?: PermModule[];
  /** Where to read the houseboat id from on the request. Default: params.houseboatId */
  boatIdFrom?: 'params' | 'body' | 'query';
  boatIdKey?: string;
  /**
   * Allow this route even when the boat is billing-locked. Only the billing/
   * payment surface (view the bill, pay it) should set this — everything else
   * stays blocked until the overdue bill is cleared.
   */
  allowWhenLocked?: boolean;
}

/**
 * Declarative per-boat permission requirement. The PermissionGuard resolves
 * the boat id from the request and asserts via RbacService.
 *
 *   @RequirePermission({ module: 'money', action: 'edit' })
 */
export const RequirePermission = (perm: RequiredPermission) =>
  SetMetadata(PERMISSION_KEY, perm);
