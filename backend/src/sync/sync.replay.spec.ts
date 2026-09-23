import { Prisma } from '@prisma/client';
import { SyncService } from './sync.service';

/**
 * Covers the audit #6/#7/#11 sync-replay fixes: offline cash routes through the
 * real payments path, duplicate intents are refused atomically by the ledger,
 * and date changes run the online booked-departure guard. The replay engine had
 * no test before this.
 */

function makeDeps(over: Record<string, any> = {}) {
  const claimed = new Set<string>();
  const prisma = {
    syncIntentApplied: {
      create: jest.fn(async ({ data }: any) => {
        if (claimed.has(data.intentId)) {
          // Emulate the unique-PK violation.
          throw new Prisma.PrismaClientKnownRequestError('dup', {
            code: 'P2002',
            clientVersion: 'test',
          });
        }
        claimed.add(data.intentId);
        return data;
      }),
      delete: jest.fn(async ({ where }: any) => {
        claimed.delete(where.intentId);
        return {};
      }),
    },
    // assertEntityBoat / wasAuthorized reads.
    houseboatMember: {
      findFirst: jest.fn().mockResolvedValue({
        role: { permissions: { bookings: { edit: true } } },
      }),
    },
    invoice: { findUnique: jest.fn().mockResolvedValue({ houseboatId: 'boat-1' }) },
    ...over.prisma,
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const payments = { recordPayment: jest.fn().mockResolvedValue({}) };
  const trips = { updateDeparture: jest.fn().mockResolvedValue({}) };
  const ops = { addCost: jest.fn(), recordMovement: jest.fn() };
  const maintenance = { createRequest: jest.fn(), updateRequest: jest.fn() };
  const bookings = { setCheckin: jest.fn() };
  const rbac = {};

  const svc = new SyncService(
    prisma as never,
    rbac as never,
    ops as never,
    audit as never,
    maintenance as never,
    bookings as never,
    payments as never,
    trips as never,
  );
  return { svc, prisma, payments, trips, audit, claimed };
}

const baseIntent = (over: Record<string, unknown> = {}) => ({
  intentId: 'intent-1',
  houseboatId: 'boat-1',
  action: 'mark_cash_paid',
  deviceTime: new Date().toISOString(),
  payload: { invoiceId: '11111111-1111-1111-1111-111111111111', amount: 500 },
  ...over,
});

describe('SyncService.replay', () => {
  it('routes offline cash through payments.recordPayment (settles the invoice)', async () => {
    const { svc, payments } = makeDeps();
    const res = await svc.replay('acc-1', false, [baseIntent() as never]);
    expect(res.results[0].status).toBe('applied');
    expect(payments.recordPayment).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      'acc-1',
      false,
      expect.objectContaining({ amount: 500, method: 'cash', receivedBy: 'acc-1' }),
    );
  });

  it('refuses a duplicate intentId atomically (ledger P2002 → duplicate)', async () => {
    const { svc, payments } = makeDeps();
    const first = await svc.replay('acc-1', false, [baseIntent() as never]);
    expect(first.results[0].status).toBe('applied');
    // Same intentId again — the ledger claim throws P2002.
    const second = await svc.replay('acc-1', false, [baseIntent() as never]);
    expect(second.results[0].status).toBe('duplicate');
    // The action ran exactly once.
    expect(payments.recordPayment).toHaveBeenCalledTimes(1);
  });

  it('releases the claim when the action fails, so a retry is not swallowed', async () => {
    const { svc, payments, claimed } = makeDeps();
    payments.recordPayment.mockRejectedValueOnce(new Error('boom'));
    const res = await svc.replay('acc-1', false, [baseIntent() as never]);
    expect(res.results[0].status).toBe('error');
    // Claim released → not left marked as applied.
    expect(claimed.has('intent-1')).toBe(false);
  });

  it('routes date_change through trips.updateDeparture (booked-departure guard)', async () => {
    const { svc, trips } = makeDeps();
    const intent = baseIntent({
      intentId: 'intent-2',
      action: 'date_change',
      payload: {
        departureId: '22222222-2222-2222-2222-222222222222',
        startDate: '2026-10-01',
      },
    });
    // assertEntityBoat('departure', …) reads tripDeparture.findUnique and pulls
    // package.houseboatId; stub that shape so the cross-boat guard passes.
    (svc as any).prisma.tripDeparture = {
      findUnique: jest
        .fn()
        .mockResolvedValue({ package: { houseboatId: 'boat-1' } }),
    };
    const res = await svc.replay('acc-1', false, [intent as never]);
    expect(res.results[0].status).toBe('applied');
    expect(trips.updateDeparture).toHaveBeenCalledWith(
      'boat-1',
      '22222222-2222-2222-2222-222222222222',
      { startDate: '2026-10-01' },
      'acc-1',
    );
  });
});
