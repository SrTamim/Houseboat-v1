import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PlatformRbacService } from './platform-rbac.service';

describe('PlatformRbacService — self-protection and integrity', () => {
  function makeService(opts?: {
    account?: {
      id: string;
      isPlatform: boolean;
      platformRoleId: string | null;
    } | null;
    role?: { id: string } | null;
    roleWithCount?: {
      id: string;
      name: string;
      permissions: unknown;
      _count: { accounts: number };
    } | null;
  }) {
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const accountUpdate = jest.fn((args: { data: unknown }) =>
      Promise.resolve({
        id: 'target',
        isPlatform: true,
        platformRoleId: null,
        ...(args.data as object),
      }),
    );
    const prisma = {
      account: {
        findUnique: jest.fn().mockResolvedValue(
          opts?.account === undefined
            ? { id: 'target', isPlatform: true, platformRoleId: null }
            : opts.account,
        ),
        update: accountUpdate,
      },
      platformRole: {
        findUnique: jest.fn().mockResolvedValue(
          opts?.roleWithCount !== undefined
            ? opts.roleWithCount
            : opts?.role !== undefined
              ? opts.role
              : { id: 'role-1' },
        ),
        delete: jest.fn().mockResolvedValue({}),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const svc = new PlatformRbacService(prisma as never, audit as never);
    return { svc, prisma, audit, accountUpdate };
  }

  it('blocks changing your own staff access', async () => {
    const { svc } = makeService();
    await expect(
      svc.setStaff('me', { isPlatform: false }, 'me'),
    ).rejects.toThrow(BadRequestException);
  });

  it('blocks changing your own platform role', async () => {
    const { svc } = makeService();
    await expect(
      svc.assignRole('me', { platformRoleId: null }, 'me'),
    ).rejects.toThrow(BadRequestException);
  });

  it('revoking staff also clears the platform role in the same update', async () => {
    const { svc, accountUpdate } = makeService({
      account: { id: 'target', isPlatform: true, platformRoleId: 'role-1' },
    });
    await svc.setStaff('target', { isPlatform: false }, 'admin');
    expect(accountUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isPlatform: false, platformRoleId: null },
      }),
    );
  });

  it('cannot assign a role to a non-staff account', async () => {
    const { svc } = makeService({
      account: { id: 'target', isPlatform: false, platformRoleId: null },
    });
    await expect(
      svc.assignRole('target', { platformRoleId: 'role-1' }, 'admin'),
    ).rejects.toThrow(BadRequestException);
  });

  it('404s when assigning a role that does not exist', async () => {
    const { svc } = makeService({ role: null });
    await expect(
      svc.assignRole('target', { platformRoleId: 'ghost' }, 'admin'),
    ).rejects.toThrow(NotFoundException);
  });

  it('refuses to delete a role that is still assigned', async () => {
    const { svc } = makeService({
      roleWithCount: {
        id: 'role-1',
        name: 'Finance Officer',
        permissions: {},
        _count: { accounts: 2 },
      },
    });
    await expect(svc.deleteRole('role-1', 'admin')).rejects.toThrow(
      ConflictException,
    );
  });

  it('deletes an unassigned role and audits it', async () => {
    const { svc, audit } = makeService({
      roleWithCount: {
        id: 'role-1',
        name: 'Finance Officer',
        permissions: {},
        _count: { accounts: 0 },
      },
    });
    await svc.deleteRole('role-1', 'admin');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'platform_role_delete' }),
    );
  });
});
