import {
  canTransition,
  assertTransition,
  InvoiceStatus,
} from './invoice-state';

/**
 * The invoice state machine is the guard against illegal money moves (plan §4).
 * These lock the legal paths and prove illegal jumps are rejected.
 */
describe('invoice-state machine', () => {
  const legal: [InvoiceStatus, InvoiceStatus][] = [
    // Path A — normal booking
    ['customer_due', 'paid'],
    ['paid', 'payment_verified'],
    // Owner-recorded payments settle straight to payout — no verify step.
    ['paid', 'in_payout'],
    ['payment_verified', 'in_payout'],
    ['in_payout', 'bill_cleared'],
    // Payout-approval path (platform console): approve, then pay or reject.
    ['paid', 'payout_approved'],
    ['payment_verified', 'payout_approved'],
    ['payout_approved', 'bill_cleared'],
    ['payout_approved', 'paid'], // Reject / un-approve
    ['payment_verified', 'paid'], // platform "reject payment" — back to verify queue
    // Path B — customer cancels
    ['customer_due', 'cancelled'],
    ['cancelled', 'payment_verified'],
    // Path C — owner cancels
    ['payment_verified', 'refund_requested'],
    ['refund_requested', 'refund_verified'],
    ['refund_verified', 'refund_completed'],
  ];

  it.each(legal)('allows %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  const illegal: [InvoiceStatus, InvoiceStatus][] = [
    // in_payout is a lock — no refund from it (must be pulled first).
    ['in_payout', 'refund_requested'],
    // Terminal states go nowhere.
    ['bill_cleared', 'paid'],
    ['refund_completed', 'paid'],
    // Can't jump straight to cleared.
    ['customer_due', 'bill_cleared'],
    // payout_approved is committed money: refund + cancel are locked out until
    // it's paid or rejected (the Reject → paid path is the only way back).
    ['payout_approved', 'refund_requested'],
    ['payout_approved', 'cancelled'],
  ];

  it.each(illegal)('rejects %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertTransition(from, to)).toThrow(/Illegal invoice transition/);
  });
});
