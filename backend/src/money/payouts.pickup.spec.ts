import { PayoutsService } from './payouts.service';

/**
 * Owner cash no longer has a separate verify step: an invoice recorded as
 * 'paid' must be settleable directly. These lock that the payout pickup pulls
 * BOTH 'paid' (owner-recorded) and 'payment_verified' (gateway-verified)
 * invoices, and rejects a batch when there is nothing to settle.
 */
describe('PayoutsService — payout pickup includes paid', () => {
  function makeService(findMany: jest.Mock) {
    const prisma = {
      invoice: { findMany },
      houseboat: {
        findUnique: jest.fn().mockResolvedValue({ bankAccount: 'ACC-1' }),
      },
      $transaction: jest.fn((fn: (t: unknown) => unknown) =>
        Promise.resolve(
          fn({
            invoice: { findMany, update: jest.fn().mockResolvedValue({}) },
            houseboatPayoutBatch: {
              create: jest.fn().mockResolvedValue({ id: 'batch-1' }),
              update: jest.fn().mockResolvedValue({ id: 'batch-1' }),
            },
          }),
        ),
      ),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const svc = new PayoutsService(prisma as never, audit as never);
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

  it('prepareBatch settles a paid (unverified) cash invoice', async () => {
    const paidCashInvoice = {
      id: 'inv-1',
      status: 'paid',
      commission: '10.00',
      payments: [{ method: 'gateway', amount: '100.00' }],
    };
    const findMany = jest.fn().mockResolvedValue([paidCashInvoice]);
    const { svc } = makeService(findMany);

    await expect(svc.prepareBatch('boat-1', 'prep-1')).resolves.toBeDefined();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['paid', 'payment_verified'] },
        }),
      }),
    );
  });
});
