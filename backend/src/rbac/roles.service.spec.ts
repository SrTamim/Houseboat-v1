import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RolesService } from './roles.service';

/**
 * Role deletion: Owner protection, the owner-distribution FK guard, and removal
 * of the members on a deleted role. Prisma + AuditService hand-mocked; the
 * $transaction callback runs against the same mock client.
 */
function makeService(overrides: Record<string, unknown> = {}) {
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const prisma: Record<string, unknown> = {
    role: {
      findFirst: jest.fn(),
      delete: jest.fn().mockResolvedValue({ id: 'role-1' }),
    },
    houseboatMember: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    houseboatStaff: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    ownerDistribution: { count: jest.fn().mockResolvedValue(0) },
    ...overrides,
  };
  prisma.$transaction = jest.fn(async (cb: (tx: unknown) => unknown) => cb(prisma));
  const svc = new RolesService(prisma as never, audit as never);
  return { svc, prisma, audit };
}

describe('RolesService.delete', () => {
  it('404s when the role is not on this boat', async () => {
    const { svc, prisma } = makeService();
    (prisma.role as { findFirst: jest.Mock }).findFirst.mockResolvedValue(null);
    await expect(svc.delete('boat-1', 'role-x', 'actor')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('refuses to delete the Owner role', async () => {
    const { svc, prisma } = makeService();
    (prisma.role as { findFirst: jest.Mock }).findFirst.mockResolvedValue({
      id: 'role-1',
      name: 'Owner',
    });
    await expect(svc.delete('boat-1', 'role-1', 'actor')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('blocks when a member on the role has recorded distributions', async () => {
    const { svc, prisma } = makeService();
    (prisma.role as { findFirst: jest.Mock }).findFirst.mockResolvedValue({
      id: 'role-1',
      name: 'Manager',
    });
    (prisma.houseboatMember as { findMany: jest.Mock }).findMany.mockResolvedValue([
      { id: 'mem-1' },
      { id: 'mem-2' },
    ]);
    (prisma.ownerDistribution as { count: jest.Mock }).count.mockResolvedValue(1);

    await expect(svc.delete('boat-1', 'role-1', 'actor')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('clears staff links, removes members, deletes the role, and audits', async () => {
    const { svc, prisma, audit } = makeService();
    (prisma.role as { findFirst: jest.Mock }).findFirst.mockResolvedValue({
      id: 'role-1',
      name: 'Manager',
    });
    (prisma.houseboatMember as { findMany: jest.Mock }).findMany.mockResolvedValue([
      { id: 'mem-1' },
    ]);
    (prisma.ownerDistribution as { count: jest.Mock }).count.mockResolvedValue(0);

    const res = await svc.delete('boat-1', 'role-1', 'actor');

    expect(
      (prisma.houseboatStaff as { updateMany: jest.Mock }).updateMany,
    ).toHaveBeenCalledWith({ where: { roleId: 'role-1' }, data: { roleId: null } });
    expect(
      (prisma.houseboatMember as { deleteMany: jest.Mock }).deleteMany,
    ).toHaveBeenCalledWith({ where: { roleId: 'role-1', houseboatId: 'boat-1' } });
    expect((prisma.role as { delete: jest.Mock }).delete).toHaveBeenCalledWith({
      where: { id: 'role-1' },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'role_delete' }),
    );
    expect(res).toEqual({ deleted: true, removedMembers: 1 });
  });
});
