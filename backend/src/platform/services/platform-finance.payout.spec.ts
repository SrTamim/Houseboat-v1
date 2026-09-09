import { BadRequestException } from '@nestjs/common';
import { PlatformFinanceService } from './platform-finance.service';

/**
 * The invoice-level "Pay to Vendors" action: only approved, unpaid invoices of
 * the named boat may be paid; paying moves them to bill_cleared, links them to a
 * new receipt (HouseboatPayoutBatch, status 'paid'), snapshots the boat's bank
 * details, and computes dueToBoat from GATEWAY receipts − commission.
 */
function makeService(invoices: any[], bankAccount: unknown = { bankName: 'X' }) {
  const created: any[] = [];
  const updated: any[] = [];
  const tx = {
    invoice: {
      findMany: jest.fn().mockResolvedValue(invoices),
      update: jest.fn(({ where, data }: any) => {
        updated.push({ id: where.id, ...data });
        return Promise.resolve({});
      }),
    },
    houseboatPayoutBatch: {
      create: jest.fn(({ data }: any) => {
        created.push(data);
        return Promise.resolve({ ...data });
      }),
    },
    houseboatBillingConfig: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    houseboat: {
      findUnique: jest.fn().mockResolvedValue({ bankAccount }),
    },
    $transaction: jest.fn((fn: (t: unknown) => unknown) => Promise.resolve(fn(tx))),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const svc = new PlatformFinanceService(prisma as never, audit as never, { get: () => undefined } as never);
  return { svc, prisma, tx, audit, created, updated };
}

const approved = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  status: 'payout_approved',
  houseboatId: 'boat-1',
  payoutBatchId: null,
  commission: '10.00',
  // displayTotal ≥ gateway receipts so the overpayment cap is a no-op here.
  displayTotal: '1000.00',
  payments: [{ method: 'gateway', amount: '100.00' }],
  ...over,
});

describe('PlatformFinanceService.payInvoices', () => {
  it('pays approved invoices: creates a receipt and clears each invoice', async () => {
    const { svc, created, updated, audit } = makeService([
      approved('inv-1'),
      approved('inv-2'),
    ]);

    const res = await svc.payInvoices('boat-1', ['inv-1', 'inv-2'], 'admin-1');

    const receiptId = created[0].id;
    expect(res).toEqual({ receiptId });
    // Receipt is a 'paid' batch for the boat, with the bank snapshot + total
    // = 2 × (100 − 10) = 180.
    expect(created[0]).toMatchObject({
      houseboatId: 'boat-1',
      status: 'paid',
      paidBy: 'admin-1',
      bankSnapshot: { bankName: 'X' },
    });
    expect(created[0].totalAmount.toFixed(2)).toBe('180.00');
    // Both invoices become bill_cleared, linked to the receipt.
    expect(updated).toEqual([
      { id: 'inv-1', status: 'bill_cleared', payoutBatchId: receiptId },
      { id: 'inv-2', status: 'bill_cleared', payoutBatchId: receiptId },
    ]);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payout_paid' }),
      expect.anything(),
    );
  });

  it('caps gateway receipts at displayTotal so an overpayment does not inflate the payout', async () => {
    const { svc, created } = makeService([
      approved('inv-1', {
        displayTotal: '100.00',
        // Customer overpaid: 120 through the gateway on a 100 invoice.
        payments: [{ method: 'gateway', amount: '120.00' }],
      }),
    ]);
    await svc.payInvoices('boat-1', ['inv-1'], 'admin-1');
    // Receipts capped at displayTotal (100), then − 10 commission = 90.
    // Without the cap this would be (120 − 10) = 110.
    expect(created[0].totalAmount.toFixed(2)).toBe('90.00');
  });

  it('only counts gateway receipts (cash never entered the platform)', async () => {
    const { svc, created } = makeService([
      approved('inv-1', {
        payments: [
          { method: 'gateway', amount: '100.00' },
          { method: 'cash', amount: '50.00' },
        ],
      }),
    ]);
    await svc.payInvoices('boat-1', ['inv-1'], 'admin-1');
    // (100 gateway − 10 commission) = 90; cash ignored.
    expect(created[0].totalAmount.toFixed(2)).toBe('90.00');
  });

  it('rejects a non-approved invoice', async () => {
    const { svc } = makeService([approved('inv-1', { status: 'paid' })]);
    await expect(
      svc.payInvoices('boat-1', ['inv-1'], 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an already-paid (batched) invoice', async () => {
    const { svc } = makeService([approved('inv-1', { payoutBatchId: 'old' })]);
    await expect(
      svc.payInvoices('boat-1', ['inv-1'], 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an invoice belonging to another boat', async () => {
    const { svc } = makeService([approved('inv-1', { houseboatId: 'boat-2' })]);
    await expect(
      svc.payInvoices('boat-1', ['inv-1'], 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to pay when the boat has no bank account', async () => {
    const { svc } = makeService([approved('inv-1')], null);
    await expect(
      svc.payInvoices('boat-1', ['inv-1'], 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

/** Reject bounces an approved or payment-verified invoice back to 'paid'. */
function makeRejectService(invoice: any) {
  const updated: any[] = [];
  const tx = {
    invoice: {
      findUnique: jest.fn().mockResolvedValue(invoice),
      update: jest.fn(({ where, data }: any) => {
        updated.push({ id: where.id, ...data });
        return Promise.resolve({});
      }),
    },
  };
  const prisma = {
    $transaction: jest.fn((fn: (t: unknown) => unknown) => Promise.resolve(fn(tx))),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const svc = new PlatformFinanceService(prisma as never, audit as never, { get: () => undefined } as never);
  return { svc, updated };
}

describe('PlatformFinanceService.rejectInvoicePayout', () => {
  it('rejects an approved invoice back to paid, clearing dueToBoat', async () => {
    const { svc, updated } = makeRejectService({
      id: 'inv-1',
      status: 'payout_approved',
      houseboatId: 'boat-1',
    });
    await svc.rejectInvoicePayout('inv-1', 'admin-1');
    expect(updated).toEqual([{ id: 'inv-1', status: 'paid', dueToBoat: 0 }]);
  });

  it('rejects a payment-verified invoice back to paid (un-verify to verify queue)', async () => {
    const { svc, updated } = makeRejectService({
      id: 'inv-1',
      status: 'payment_verified',
      houseboatId: 'boat-1',
    });
    await svc.rejectInvoicePayout('inv-1', 'admin-1');
    expect(updated).toEqual([{ id: 'inv-1', status: 'paid', dueToBoat: 0 }]);
  });

  it('refuses to reject an invoice already in the verify state (paid)', async () => {
    const { svc } = makeRejectService({
      id: 'inv-1',
      status: 'paid',
      houseboatId: 'boat-1',
    });
    await expect(
      svc.rejectInvoicePayout('inv-1', 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
