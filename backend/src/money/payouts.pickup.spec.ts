import { PayoutsService } from './payouts.service';

/**
 * Owner cash no longer has a separate verify step: an invoice recorded as
 * 'paid' must be settleable directly. The read side (duePayments) still pulls
 * BOTH 'paid' (owner-recorded) and 'payment_verified' (gateway-verified)
 * invoices.
 *
 * The batch WRITE path (prepareBatch/approveBatch/markPaid) is RETIRED — it
 * wrote an uncapped dueToBoat and bypassed the gateway-verify gate the live
 * per-invoice payout flow (platform-finance.payBoat) enforces. It now throws.
 */
describe('PayoutsService — payout pickup + retired batch writes', () => {
  function makeService(findMany: jest.Mock) {
    const prisma = {
      invoice: { findMany },
    };
    const svc = new PayoutsService(prisma as never);
    return { svc, findMany };
  }

  it('duePayments pulls both paid and payment_verified invoices', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { svc } = makeService(findMany);

    await svc.duePayments('boat-1');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          houseboatId: 'boat-1',
          status: { in: ['paid', 'payment_verified'] },
          payoutBatchId: null,
        }),
      }),
    );
  });

  it('prepareBatch is retired and rejects', async () => {
    const { svc } = makeService(jest.fn());
    await expect(svc.prepareBatch('boat-1', 'prep-1')).rejects.toThrow(
      /retired/i,
    );
  });

  it('approveBatch and markPaid are retired and reject', async () => {
    const { svc } = makeService(jest.fn());
    await expect(svc.approveBatch('batch-1', 'appr-1')).rejects.toThrow(
      /retired/i,
    );
    await expect(svc.markPaid('batch-1', 'pay-1')).rejects.toThrow(/retired/i);
  });
});
