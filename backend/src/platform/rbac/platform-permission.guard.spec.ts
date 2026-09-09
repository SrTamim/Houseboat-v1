import { ForbiddenException } from '@nestjs/common';
import { PlatformPermissionGuard } from './platform-permission.guard';
import { PLATFORM_PERMISSION_KEY } from './platform-permission.decorator';

/**
 * The guard reads the DATABASE, not the JWT — a revoked staffer must be
 * blocked on the next request even while their token still claims isPlatform.
 */
describe('PlatformPermissionGuard', () => {
  function makeGuard(opts: {
    meta?: { page: string; action: string; anyOf?: string[] };
    account?: {
      isPlatform: boolean;
      platformRole: { permissions: unknown } | null;
    } | null;
  }) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(opts.meta),
    };
    const findUnique = jest.fn().mockResolvedValue(opts.account ?? null);
    const prisma = { account: { findUnique } };
    const guard = new PlatformPermissionGuard(
      reflector as never,
      prisma as never,
    );
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 'acct-1', isPlatform: true } }),
      }),
    };
    return { guard, context: context as never, findUnique, reflector };
  }

  it('passes without a DB call when the route has no metadata', async () => {
    const { guard, context, findUnique } = makeGuard({ meta: undefined });
    expect(await guard.canActivate(context)).toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('403s when DB isPlatform=false even though the JWT claims platform (staleness)', async () => {
    const { guard, context } = makeGuard({
      meta: { page: 'payouts', action: 'view' },
      account: { isPlatform: false, platformRole: null },
    });
    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('passes with a null role (superadmin)', async () => {
    const { guard, context } = makeGuard({
      meta: { page: 'payouts', action: 'edit' },
      account: { isPlatform: true, platformRole: null },
    });
    expect(await guard.canActivate(context)).toBe(true);
  });

  it('edit implies view: an edit grant passes a view route', async () => {
    const { guard, context } = makeGuard({
      meta: { page: 'payouts', action: 'view' },
      account: {
        isPlatform: true,
        platformRole: { permissions: { payouts: { edit: true } } },
      },
    });
    expect(await guard.canActivate(context)).toBe(true);
  });

  it('view-only grant 403s on an edit route', async () => {
    const { guard, context } = makeGuard({
      meta: { page: 'payouts', action: 'edit' },
      account: {
        isPlatform: true,
        platformRole: { permissions: { payouts: { view: true } } },
      },
    });
    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('missing page in the map 403s', async () => {
    const { guard, context } = makeGuard({
      meta: { page: 'boats', action: 'view' },
      account: {
        isPlatform: true,
        platformRole: { permissions: { payouts: { view: true } } },
      },
    });
    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('anyOf: a grant on an alternate page satisfies a shared route', async () => {
    const { guard, context } = makeGuard({
      meta: { page: 'booking-invoice', action: 'view', anyOf: ['verify'] },
      account: {
        isPlatform: true,
        platformRole: { permissions: { verify: { view: true } } },
      },
    });
    expect(await guard.canActivate(context)).toBe(true);
  });

  it('legacy module grant is expanded to its pages at read time', async () => {
    // A pre-migration role storing the old `finance` module must still reach a
    // finance page route.
    const { guard, context } = makeGuard({
      meta: { page: 'payouts', action: 'edit' },
      account: {
        isPlatform: true,
        platformRole: { permissions: { finance: { edit: true } } },
      },
    });
    expect(await guard.canActivate(context)).toBe(true);
  });

  it('uses handler-then-class metadata resolution', async () => {
    const { guard, context, reflector } = makeGuard({ meta: undefined });
    await guard.canActivate(context);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      PLATFORM_PERMISSION_KEY,
      expect.any(Array),
    );
  });
});
