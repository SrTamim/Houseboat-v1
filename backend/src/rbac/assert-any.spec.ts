import { ForbiddenException } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { PermissionMap } from './permission.types';

/**
 * assertAny backs the `anyOf` decorator option: a route several pages share
 * passes when the caller holds the action on ANY listed page. These tests pin
 * the shared-read regressions the per-page re-tag could otherwise introduce
 * (e.g. a departure- or pos-scoped role reaching the shared /bookings list).
 */
function serviceForRole(permissions: PermissionMap, locked = false) {
  const membership = {
    id: 'm',
    roleId: 'r',
    status: 'active',
    endDate: null,
    role: { permissions },
  };
  const prisma = {
    houseboatMember: { findFirst: jest.fn().mockResolvedValue(membership) },
    houseboatSubscriptionInvoice: {
      findFirst: jest.fn().mockResolvedValue(locked ? { id: 'inv' } : null),
    },
  };
  return new RbacService(prisma as never);
}

describe('RbacService.assertAny — anyOf shared routes', () => {
  it('passes when the caller holds any one of the pages', async () => {
    // A pos-only role reaching the shared /bookings list (module bookings, anyOf pos).
    const svc = serviceForRole({ pos: { view: true, edit: true } });
    await expect(
      svc.assertAny('u', false, 'boat', ['bookings', 'departure', 'pos'], 'view'),
    ).resolves.toBeTruthy();
  });

  it('passes a schedule-only role on the shared /packages read', async () => {
    const svc = serviceForRole({ schedule: { view: true, edit: false } });
    await expect(
      svc.assertAny('u', false, 'boat', ['packages', 'schedule'], 'view'),
    ).resolves.toBeTruthy();
  });

  it('rejects when the caller holds none of the pages', async () => {
    const svc = serviceForRole({ costs: { view: true, edit: true } });
    await expect(
      svc.assertAny('u', false, 'boat', ['bookings', 'departure', 'pos'], 'view'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects edit for an exited member even if the page grants edit', async () => {
    const membership = {
      id: 'm',
      roleId: 'r',
      status: 'exited',
      endDate: new Date(),
      role: { permissions: { pos: { view: true, edit: true } } },
    };
    const prisma = {
      houseboatMember: { findFirst: jest.fn().mockResolvedValue(membership) },
      houseboatSubscriptionInvoice: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const svc = new RbacService(prisma as never);
    await expect(
      svc.assertAny('u', false, 'boat', ['bookings', 'pos'], 'edit'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    // ...but view still works for the exited member.
    await expect(
      svc.assertAny('u', false, 'boat', ['bookings', 'pos'], 'view'),
    ).resolves.toBeTruthy();
  });

  it('platform staff bypass returns null without a role', async () => {
    const svc = serviceForRole({});
    await expect(
      svc.assertAny('u', true, 'boat', ['bookings'], 'edit'),
    ).resolves.toBeNull();
  });

  it('still enforces the billing lock (no bypass) even when permitted', async () => {
    const svc = serviceForRole({ billing: { view: true, edit: true } }, true);
    await expect(
      svc.assertAny('u', false, 'boat', ['billing', 'settings'], 'view'),
    ).rejects.toThrow(/locked/);
  });

  it('honors bypassBillingLock for the billing surface', async () => {
    const svc = serviceForRole({ billing: { view: true, edit: true } }, true);
    await expect(
      svc.assertAny('u', false, 'boat', ['billing', 'settings'], 'view', {
        bypassBillingLock: true,
      }),
    ).resolves.toBeTruthy();
  });

  it('works with a migrated legacy role (staff → crew/attendance/payroll/team)', async () => {
    // A pre-migration staff role, un-migrated: expandLegacyPermissions turns it
    // into the four staff pages, so anyOf['payroll','attendance'] passes.
    const svc = serviceForRole({ staff: { view: true, edit: false } });
    await expect(
      svc.assertAny('u', false, 'boat', ['crew', 'payroll', 'attendance'], 'view'),
    ).resolves.toBeTruthy();
  });
});
