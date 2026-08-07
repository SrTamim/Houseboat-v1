/**
 * Invoice state machine — plan §4. Every legal transition is listed here;
 * anything not listed is rejected. Never trust the UI.
 *
 *  Path A (normal):   customer_due → paid → in_payout → bill_cleared
 *    payment_verified is now an OPTIONAL gateway-only stage: platform finance
 *    still verifies online/gateway receipts (paid → payment_verified), but
 *    owner-recorded payments (cash/bkash/bank/online) settle straight from
 *    paid → in_payout with no separate verify step.
 *  Path B (customer cancels): cancelled → payment_verified → in_payout → bill_cleared
 *  Path C (owner cancels):    refund_requested → refund_verified → refund_completed
 *    POS refunds (owner counter-sale, bookedBy != customer) settle in one step:
 *    refund_requested → refund_completed. There is no separate finance to verify a
 *    walk-in refund, so the owner both raises and settles it. The 3-person
 *    separation still governs platform refunds.
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
  paid: ['payment_verified', 'in_payout', 'cancelled'],
  payment_verified: ['in_payout', 'cancelled', 'refund_requested'],
  in_payout: ['bill_cleared'],
  bill_cleared: [],
  cancelled: ['payment_verified'], // customer-cancel still flows through settlement
  refund_requested: ['refund_verified', 'refund_completed'], // refund_completed = POS one-step settle
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
