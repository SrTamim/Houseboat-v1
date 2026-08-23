import { BadRequestException, ConflictException } from '@nestjs/common';
import { MembershipService } from './membership.service';

/**
 * Duplicate-member guard, exited re-hire reactivation, and hard-delete (with the
 * owner-distribution FK guard). Prisma + AuditService are hand-mocked.
 */
function makeService(overrides: Record<string, unknown> = {}) {
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const prisma = {
    account: { findUnique: jest.fn() },
    role: { findFirst: jest.fn().mockResolvedValue({ id: 'role-1' }) },
    houseboatMember: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({ id: 'mem-1' }),
    },
    ownerDistribution: { count: jest.fn().mockResolvedValue(0) },
    ...overrides,
  };
  const svc = new MembershipService(prisma as never, audit as never);
  return { svc, prisma, audit };
}

describe('MembershipService.addMember — duplicate guard + reactivate', () => {
  const input = { phone: '+8801700000000', roleId: 'role-1' };

  it('rejects adding a person who is already an active member', async () => {
    const { svc, prisma } = makeService();
    prisma.account.findUnique.mockResolvedValue({ id: 'acc-1' });
    prisma.houseboatMember.findFirst.mockResolvedValue({
      id: 'mem-1',
      status: 'active',
    });

    await expect(svc.addMember('boat-1', 'actor', input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.houseboatMember.create).not.toHaveBeenCalled();
    expect(prisma.houseboatMember.update).not.toHaveBeenCalled();
  });

  it('reactivates an exited membership instead of creating a second row', async () => {
    const { svc, prisma, audit } = makeService();
    prisma.account.findUnique.mockResolvedValue({ id: 'acc-1' });
    prisma.houseboatMember.findFirst.mockResolvedValue({
      id: 'mem-1',
      status: 'exited',
      roleId: 'old-role',
      endDate: new Date(),
    });
    prisma.houseboatMember.update.mockResolvedValue({ id: 'mem-1' });

    await svc.addMember('boat-1', 'actor', input);

    expect(prisma.houseboatMember.create).not.toHaveBeenCalled();
    expect(prisma.houseboatMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mem-1' },
        data: expect.objectContaining({ status: 'active', endDate: null, roleId: 'role-1' }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'member_reactivate' }),
    );
  });

  it('creates a fresh membership when the person has none', async () => {
    const { svc, prisma, audit } = makeService();
    prisma.account.findUnique.mockResolvedValue({ id: 'acc-1' });
    prisma.houseboatMember.findFirst.mockResolvedValue(null);
    prisma.houseboatMember.create.mockResolvedValue({ id: 'mem-new' });

    await svc.addMember('boat-1', 'actor', input);

    expect(prisma.houseboatMember.create).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'member_add' }),
    );
  });
});

describe('MembershipService.deleteMember — FK guard', () => {
  it('blocks deleting a member who has recorded distributions', async () => {
    const { svc, prisma } = makeService();
    prisma.houseboatMember.findFirst.mockResolvedValue({
      id: 'mem-1',
      houseboatId: 'boat-1',
      accountId: 'acc-1',
      roleId: 'role-1',
      status: 'active',
    });
    prisma.ownerDistribution.count.mockResolvedValue(2);

    await expect(
      svc.deleteMember('mem-1', 'boat-1', 'actor'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.houseboatMember.delete).not.toHaveBeenCalled();
  });

  it('audits BEFORE deleting on the clean path', async () => {
    const { svc, prisma, audit } = makeService();
    prisma.houseboatMember.findFirst.mockResolvedValue({
      id: 'mem-1',
      houseboatId: 'boat-1',
      accountId: 'acc-1',
      roleId: 'role-1',
      status: 'active',
    });
    prisma.ownerDistribution.count.mockResolvedValue(0);

    const order: string[] = [];
    audit.log.mockImplementation(async () => {
      order.push('audit');
    });
    prisma.houseboatMember.delete.mockImplementation(async () => {
      order.push('delete');
      return { id: 'mem-1' };
    });

    await svc.deleteMember('mem-1', 'boat-1', 'actor');

    expect(order).toEqual(['audit', 'delete']);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'member_delete' }),
    );
  });
});
