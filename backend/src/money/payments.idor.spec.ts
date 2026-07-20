import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';

/**
 * P0.1 regression: money routes must re-check per-boat authorization at the
 * service layer (the global guards can't resolve a boat from :invoiceId).
 * A caller with no membership on the invoice's boat must be rejected before any
 * write happens.
 */
describe('PaymentsService — IDOR guard', () => {
  const INVOICE = { id: 'inv-1', houseboatId: 'boat-Y', status: 'customer_due', amountPaid: '0' };

  function makeService(assertImpl: jest.Mock) {
    const tx = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue(INVOICE),
        update: jest.fn().mockResolvedValue({ ...INVOICE, status: 'paid' }),
      },
      invoicePayment: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      // recordPayment runs inside a transaction — pass our fake tx through.
      $transaction: jest.fn((fn: (t: unknown) => unknown) => Promise.resolve(fn(tx))),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const rbac = { assert: assertImpl };
    const svc = new PaymentsService(
      prisma as never,
      audit as never,
      rbac as never,
    );
    return { svc, tx, rbac };
  }

  it('rejects a caller who is not authorized on the invoice’s boat', async () => {
    const assert = jest.fn().mockRejectedValue(new ForbiddenException());
    const { svc, tx } = makeService(assert);

    await expect(
      svc.recordPayment('inv-1', 'attacker', false, {
        amount: 100,
        method: 'cash',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Guard must fire BEFORE any payment row is written.
    expect(assert).toHaveBeenCalledWith(
      'attacker',
      false,
      'boat-Y',
      'money',
      'edit',
    );
    expect(tx.invoicePayment.create).not.toHaveBeenCalled();
  });

  it('allows an authorized caller and records the payment', async () => {
    const assert = jest.fn().mockResolvedValue(null);
    const { svc, tx } = makeService(assert);

    await svc.recordPayment('inv-1', 'owner', false, {
      amount: 100,
      method: 'cash',
    });

    expect(tx.invoicePayment.create).toHaveBeenCalledTimes(1);
  });
});
