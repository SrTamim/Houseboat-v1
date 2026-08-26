import { RbacService, BILLING_GRACE_DAYS } from './rbac.service';

/**
 * The billing lock is time-based, not instant: a boat is only locked once it has
 * an unpaid subscription invoice issued MORE than BILLING_GRACE_DAYS ago.
 */
describe('RbacService.isBillingLocked — 14-day grace', () => {
  function serviceWithInvoice(issuedAt: Date | null) {
    const prisma = {
      houseboatSubscriptionInvoice: {
        findFirst: jest.fn(
          (args: {
            where: {
              issuedAt?: { lt: Date };
              status?: { notIn?: string[] };
            };
          }) => {
            // A trial ($0) invoice must never lock: the query excludes it, so a
            // boat whose only unpaid invoice is a trial finds no lock row.
            expect(args.where.status?.notIn).toEqual(['paid', 'trial']);
            // Emulate the query: return a row only if an unpaid invoice is older
            // than the cutoff the service passes in.
            if (issuedAt == null) return Promise.resolve(null);
            const cutoff = args.where.issuedAt!.lt;
            return Promise.resolve(issuedAt < cutoff ? { id: 'inv' } : null);
          },
        ),
      },
    };
    return new RbacService(prisma as never);
  }

  const days = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

  it('not locked when there is no unpaid invoice', async () => {
    const svc = serviceWithInvoice(null);
    expect(await svc.isBillingLocked('boat')).toBe(false);
  });

  it('not locked within the grace window (issued 10 days ago)', async () => {
    const svc = serviceWithInvoice(days(10));
    expect(await svc.isBillingLocked('boat')).toBe(false);
  });

  it('not locked exactly at the edge (just under 14 days)', async () => {
    const svc = serviceWithInvoice(days(BILLING_GRACE_DAYS - 1));
    expect(await svc.isBillingLocked('boat')).toBe(false);
  });

  it('locked once past the grace window (issued 15 days ago)', async () => {
    const svc = serviceWithInvoice(days(BILLING_GRACE_DAYS + 1));
    expect(await svc.isBillingLocked('boat')).toBe(true);
  });
});

/**
 * When locked, assert() blocks ALL boat access (view + edit) except callers that
 * pass bypassBillingLock (the billing/payment surface).
 */
describe('RbacService.assert — lock blocks everything but billing', () => {
  function lockedService() {
    const membership = {
      id: 'm',
      roleId: 'r',
      status: 'active',
      endDate: null,
      // Page-shaped role (post per-page migration). `billing` is granted so the
      // permission check passes and the test exercises the billing LOCK, not a
      // missing-permission rejection.
      role: { permissions: { billing: { view: true, edit: true } } },
    };
    const prisma = {
      houseboatMember: { findFirst: jest.fn().mockResolvedValue(membership) },
      houseboatSubscriptionInvoice: {
        // Always "locked" (an old unpaid invoice exists).
        findFirst: jest.fn().mockResolvedValue({ id: 'inv' }),
      },
    };
    return new RbacService(prisma as never);
  }

  it('blocks a normal view when locked', async () => {
    const svc = lockedService();
    await expect(
      svc.assert('u', false, 'boat', 'billing', 'view'),
    ).rejects.toThrow(/locked/);
  });

  it('blocks a normal edit when locked', async () => {
    const svc = lockedService();
    await expect(
      svc.assert('u', false, 'boat', 'billing', 'edit'),
    ).rejects.toThrow(/locked/);
  });

  it('allows the billing surface (bypassBillingLock) when locked', async () => {
    const svc = lockedService();
    await expect(
      svc.assert('u', false, 'boat', 'billing', 'view', {
        bypassBillingLock: true,
      }),
    ).resolves.toBeTruthy();
  });
});
