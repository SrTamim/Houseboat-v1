import { Prisma } from '@prisma/client';
import { PaymentsService } from '../money/payments.service';

/**
 * Gateway payment recording (G9). The IPN handler calls recordGatewayPayment
 * after re-validating by val_id. Two properties matter for a public money flow:
 *
 *  - Idempotency: a replayed IPN (same gatewayToken) must be a no-op, not a
 *    second payment / second e-ticket. Enforced by the unique gateway_token
 *    index → P2002 → null.
 *  - Settlement: a partial payment (deposit) leaves the invoice customer_due;
 *    only a full settlement flips it to paid.
 */
describe('PaymentsService.recordGatewayPayment (G9)', () => {
  function makeService(opts: {
    invoice?: unknown;
    createThrows?: unknown;
  }) {
    const tx = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue(opts.invoice ?? null),
        update: jest.fn((args: { data: unknown }) =>
          Promise.resolve({ id: 'inv-1', ...(args.data as object) }),
        ),
      },
      invoicePayment: {
        create: opts.createThrows
          ? jest.fn().mockRejectedValue(opts.createThrows)
          : jest.fn().mockResolvedValue({}),
      },
      // recordGatewayPayment takes a SELECT … FOR UPDATE row lock on the invoice
      // first; no real DB in the unit mock, so this is a no-op stub.
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const prisma = {
      $transaction: jest.fn((fn: (t: unknown) => unknown) =>
        Promise.resolve(fn(tx)).catch((e) => {
          throw e;
        }),
      ),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const svc = new PaymentsService(prisma as never, audit as never, {} as never);
    return { svc, tx };
  }

  const P2002 = new Prisma.PrismaClientKnownRequestError('dup', {
    code: 'P2002',
    clientVersion: 'x',
  });

  it('is an idempotent no-op on a replayed IPN (duplicate gatewayToken)', async () => {
    const { svc } = makeService({
      invoice: {
        id: 'inv-1',
        amountPaid: '0',
        displayTotal: '1000',
        status: 'customer_due',
        houseboatId: 'boat-A',
      },
      createThrows: P2002,
    });
    const res = await svc.recordGatewayPayment({
      invoiceId: 'inv-1',
      amount: 1000,
      gatewayToken: 'val-123',
    });
    expect(res).toBeNull();
  });

  it('flips a fully-settled invoice to paid', async () => {
    const { svc, tx } = makeService({
      invoice: {
        id: 'inv-1',
        amountPaid: '0',
        displayTotal: '1000',
        status: 'customer_due',
        houseboatId: 'boat-A',
      },
    });
    await svc.recordGatewayPayment({
      invoiceId: 'inv-1',
      amount: 1000,
      gatewayToken: 'val-123',
    });
    expect(tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'paid' }) }),
    );
  });

  it('leaves a partial (deposit) payment customer_due', async () => {
    const { svc, tx } = makeService({
      invoice: {
        id: 'inv-1',
        amountPaid: '0',
        displayTotal: '1000',
        status: 'customer_due',
        houseboatId: 'boat-A',
      },
    });
    await svc.recordGatewayPayment({
      invoiceId: 'inv-1',
      amount: 500, // 50% advance
      gatewayToken: 'val-123',
    });
    expect(tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'customer_due' }),
      }),
    );
  });
});
