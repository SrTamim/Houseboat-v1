// Real invoice payloads from GET /platform/finance/invoices, plus the wire
// status → label/tone mapping. Replaces the design-preview mock shapes.

import type { PillTone } from './status';

export interface ApiInvoicePayment {
  id: string;
  /** Decimal(12,2) — arrives as a string. */
  amount: string;
  /** gateway / cash */
  method: string;
  gatewayToken: string | null;
}

export interface ApiInvoice {
  id: string;
  status: InvoiceWireStatus;
  /** Decimal(12,2) strings — never parseFloat for arithmetic. */
  displayTotal: string;
  amountPaid: string;
  dueToBoat: string;
  commission: string;
  payoutBatchId: string | null;
  houseboat: { id: string; name: string; slug: string };
  customer: { id: string; name: string | null; phone: string };
  booking: {
    id: string;
    status: string;
    type: string;
    createdAt: string;
    departure: { startDate: string };
  };
  payments: ApiInvoicePayment[];
}

export type InvoiceWireStatus =
  | 'customer_due'
  | 'paid'
  | 'payment_verified'
  | 'in_payout'
  | 'bill_cleared'
  | 'cancelled'
  | 'refund_requested'
  | 'refund_verified'
  | 'refund_completed';

/** Wire state → business label shown in the console. */
export const WIRE_STATUS_LABEL: Record<InvoiceWireStatus, string> = {
  customer_due: 'Customer Due',
  paid: 'Paid',
  payment_verified: 'Ready for Payout',
  in_payout: 'In Payout',
  bill_cleared: 'Paid to Boat',
  cancelled: 'Canceled',
  refund_requested: 'Refund Requested',
  refund_verified: 'Refund Verified',
  refund_completed: 'Refunded',
};

export const WIRE_STATUS_TONE: Record<InvoiceWireStatus, PillTone> = {
  customer_due: 'amb',
  paid: 'blue',
  payment_verified: 'warn',
  in_payout: 'warn',
  bill_cleared: 'ok',
  cancelled: 'mut',
  refund_requested: 'warn',
  refund_verified: 'blue',
  refund_completed: 'ok',
};

export function wireStatusLabel(status: string): string {
  return WIRE_STATUS_LABEL[status as InvoiceWireStatus] ?? status;
}

export function wireStatusTone(status: string): PillTone {
  return WIRE_STATUS_TONE[status as InvoiceWireStatus] ?? 'mut';
}

/** "INV-9a11"-style short handle for a UUID — display only, never a key. */
export function shortId(id: string, prefix: string): string {
  return `${prefix}-${id.slice(0, 8)}`;
}

/** Mask a gateway token for on-screen display. */
export function maskToken(token: string | null): string {
  if (!token) return '— (cash)';
  return token.length > 10 ? `${token.slice(0, 8)}…${token.slice(-4)}` : token;
}
