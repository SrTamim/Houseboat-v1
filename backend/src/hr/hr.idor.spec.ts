import { NotFoundException } from '@nestjs/common';
import { HrService } from './hr.service';

/**
 * Cross-boat IDOR guards on HR writes (audit S-M1/S-M2).
 *
 * The controller authorizes only the URL :houseboatId. Before this fix,
 * setLeave / setCrewPresence / listCrew took a staffId or departureId with no
 * check that it belonged to that boat, so a member of Boat-A could touch
 * Boat-B's staff/crew. Each now verifies ownership first.
 */
describe('HrService — cross-boat IDOR guards', () => {
  // staff-A belongs to boat-A only; dep-A belongs to boat-A only.
  function makeService() {
    const prisma = {
      houseboatStaff: {
        findFirst: jest.fn(({ where }: any) =>
          Promise.resolve(
            where.id === 'staff-A' && where.houseboatId === 'boat-A'
              ? { id: 'staff-A' }
              : null,
          ),
        ),
        update: jest.fn().mockResolvedValue({ id: 'staff-A' }),
      },
      tripDeparture: {
        findFirst: jest.fn(({ where }: any) =>
          Promise.resolve(
            where.id === 'dep-A' && where.package?.houseboatId === 'boat-A'
              ? { id: 'dep-A' }
              : null,
          ),
        ),
      },
      tripCrew: {
        upsert: jest.fn().mockResolvedValue({ id: 'crew-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      staffLeave: { create: jest.fn().mockResolvedValue({ id: 'lv-1' }) },
      $transaction: jest.fn((fn: (t: unknown) => unknown) =>
        Promise.resolve(
          fn({
            staffLeave: { create: jest.fn().mockResolvedValue({ id: 'lv-1' }) },
            houseboatStaff: { update: jest.fn().mockResolvedValue({}) },
          }),
        ),
      ),
    };
    const svc = new HrService(prisma as never, { log: jest.fn() } as never);
    return { svc, prisma };
  }

  const LEAVE = { state: 'on_leave' } as never;

  it('setLeave rejects a staffId from another boat', async () => {
    const { svc } = makeService();
    await expect(
      svc.setLeave('boat-B', 'staff-A', LEAVE),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('setLeave allows a staffId that belongs to the boat', async () => {
    const { svc } = makeService();
    await expect(svc.setLeave('boat-A', 'staff-A', LEAVE)).resolves.toBeDefined();
  });

  it('setCrewPresence rejects a departure from another boat', async () => {
    const { svc } = makeService();
    await expect(
      svc.setCrewPresence('boat-B', 'dep-A', 'staff-A', true),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('listCrew rejects a departure from another boat', async () => {
    const { svc } = makeService();
    await expect(
      svc.listCrew('boat-B', 'dep-A'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('listCrew allows the boat that owns the departure', async () => {
    const { svc } = makeService();
    await expect(svc.listCrew('boat-A', 'dep-A')).resolves.toBeDefined();
  });
});
