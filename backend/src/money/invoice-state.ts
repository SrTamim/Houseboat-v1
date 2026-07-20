/**
 * Invoice state machine — plan §4. Every legal transition is listed here;
 * anything not listed is rejected. Never trust the UI.
 *
 *  Path A (normal):   customer_due → paid → payment_verified → in_payout → bill_cleared
 *  Path B (customer cancels): cancelled → payment_verified → in_payout → bill_cleared
 *  Path C (owner cancels):    refund_requested → refund_verified → refund_completed
 *
 *  in_payout is a LOCK: once set, no refund can double-spend.
 */
export type InvoiceStatus =
  | 'customer_due'
  | 'paid'
  | 'payment_verified'
  | 'in_payout'
  | 'bill_cleared'
  | 'cancelled'
  | 'refund_requested'
  | 'refund_verified'
  | 'refund_completed';

const TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  customer_due: ['paid', 'cancelled'],
  paid: ['payment_verified', 'cancelled'],
  payment_verified: ['in_payout', 'cancelled', 'refund_requested'],
  in_payout: ['bill_cleared'],
  bill_cleared: [],
  cancelled: ['payment_verified'], // customer-cancel still flows through settlement
  refund_requested: ['refund_verified'],
  refund_verified: ['refund_completed'],
  refund_completed: [],
};

export function canTransition(
  from: InvoiceStatus,
  to: InvoiceStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: InvoiceStatus, to: InvoiceStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal invoice transition: ${from} → ${to}`);
  }
}
