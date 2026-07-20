import { SetMetadata } from '@nestjs/common';
import { PermAction, PermModule } from './permission.types';

export const PERMISSION_KEY = 'requiredPermission';

export interface RequiredPermission {
  module: PermModule;
  action: PermAction;
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
