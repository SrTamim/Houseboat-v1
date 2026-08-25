/**
 * Invoice state machine — plan §4. Every legal transition is listed here;
 * anything not listed is rejected. Never trust the UI.
 *
 *  Path A (normal):   customer_due → paid → in_payout → bill_cleared
 *    payment_verified is now an OPTIONAL gateway-only stage: platform finance
 *    still verifies online/gateway receipts (paid → payment_verified), but
 *    owner-recorded payments (cash/bkash/bank/online) settle straight from
 *    paid → in_payout with no separate verify step.
 *
 *  payout_approved is an OPTIONAL manual stage on the platform payout console:
 *    finance approves an invoice for payout (paid|payment_verified →
 *    payout_approved), which locks it against refund/cancel, then pays the
 *    vendor (payout_approved → bill_cleared). Reject bounces it back
 *    (payout_approved → paid) so it re-enters the verify queue. The legacy batch
 *    path (… → in_payout → bill_cleared) still exists for owner-facing history.
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
  | 'payout_approved'
  | 'in_payout'
  | 'bill_cleared'
  | 'cancelled'
  | 'refund_requested'
  | 'refund_verified'
  | 'refund_completed';

const TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  customer_due: ['paid', 'cancelled'],
  paid: ['payment_verified', 'payout_approved', 'in_payout', 'cancelled'],
  // payment_verified → paid is the platform "reject payment" action: finance
  // bounces a verified receipt back to the verify queue for re-checking. It is
  // NOT an owner-reachable path (owners can't un-verify); only the platform
  // payout console triggers it.
  payment_verified: [
    'paid',
    'payout_approved',
    'in_payout',
    'cancelled',
    'refund_requested',
  ],
  // Approved for payout: pay the vendor (→ bill_cleared) or Reject back to paid.
  // Deliberately NOT → refund_requested/cancelled: an approved invoice is
  // committed money, so it is refund/cancel-locked until paid or rejected.
  payout_approved: ['bill_cleared', 'paid'],
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
