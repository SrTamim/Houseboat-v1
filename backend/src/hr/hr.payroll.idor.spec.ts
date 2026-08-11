import { NotFoundException } from '@nestjs/common';
import { HrService } from './hr.service';

/**
 * Cross-boat IDOR regression (Round 3, C2). The payroll routes authorize the
 * caller's `staff:edit` on the URL :houseboatId, but the service must also
 * confirm the staff / payroll row belongs to that boat — otherwise a member of
 * boat A could run/adjust/mark-paid payroll for boat B.
 */
describe('HrService — payroll cross-boat guard', () => {
  function makeService(overrides: {
    staffFindFirst?: unknown;
    payrollFindFirst?: unknown;
  }) {
    const prisma = {
      houseboatStaff: {
        findFirst: jest.fn().mockResolvedValue(overrides.staffFindFirst ?? null),
        findUnique: jest.fn().mockResolvedValue({
          id: 'staff-B',
          houseboatId: 'boat-B',
          monthlySalary: '1000',
        }),
      },
      staffPayroll: {
        findFirst: jest.fn().mockResolvedValue(overrides.payrollFindFirst ?? null),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'pay-B', paid: true }),
        create: jest.fn(),
      },
      tripCrew: { count: jest.fn().mockResolvedValue(0) },
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const svc = new HrService(prisma as never, audit as never);
    return { svc, prisma };
  }

  it('runPayroll rejects a staffId from another boat (404, no write)', async () => {
    // assertStaffOwned → findFirst({id, houseboatId}) returns null for boat A.
    const { svc, prisma } = makeService({ staffFindFirst: null });
    await expect(
      svc.runPayroll('boat-A', 'staff-B', { period: '2026-07' }, 'attacker'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.staffPayroll.create).not.toHaveBeenCalled();
  });

  it('markPayrollPaid rejects a payrollId from another boat (404, no write)', async () => {
    const { svc, prisma } = makeService({ payrollFindFirst: null });
    await expect(
      svc.markPayrollPaid('boat-A', 'pay-B', 'attacker'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.staffPayroll.update).not.toHaveBeenCalled();
  });

  it('adjustPayroll rejects a payrollId from another boat (404, no write)', async () => {
    const { svc, prisma } = makeService({ payrollFindFirst: null });
    await expect(
      svc.adjustPayroll('boat-A', 'pay-B', { bonus: 500 }, 'attacker'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.staffPayroll.update).not.toHaveBeenCalled();
  });

  it('markPayrollPaid succeeds when the payroll belongs to the boat', async () => {
    const { svc, prisma } = makeService({ payrollFindFirst: { id: 'pay-A' } });
    await svc.markPayrollPaid('boat-A', 'pay-A', 'owner');
    expect(prisma.staffPayroll.update).toHaveBeenCalledTimes(1);
  });
});
