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
    ['payment_verified', 'in_payout'],
    ['in_payout', 'bill_cleared'],
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
    // Can't skip verification into payout.
    ['paid', 'in_payout'],
    // in_payout is a lock — no refund from it (must be pulled first).
    ['in_payout', 'refund_requested'],
    // Terminal states go nowhere.
    ['bill_cleared', 'paid'],
    ['refund_completed', 'paid'],
    // Can't jump straight to cleared.
    ['customer_due', 'bill_cleared'],
    // Can't un-verify.
    ['payment_verified', 'paid'],
  ];

  it.each(illegal)('rejects %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertTransition(from, to)).toThrow(/Illegal invoice transition/);
  });
});
