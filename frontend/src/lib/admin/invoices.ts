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
  /** Number of cabins on the booking. */
  cabinCount: number;
  houseboat: { id: string; name: string; slug: string };
  customer: { id: string; name: string | null; phone: string };
  booking: {
    id: string;
    status: string;
    type: string;
    channel: string;
    createdAt: string;
    departure: {
      startDate: string;
      /** 'cancelled' = the owner cancelled the whole trip (host-cancelled badge). */
      status?: string;
      cancelReason?: string | null;
    };
  };
  payments: ApiInvoicePayment[];
  /** Latest InvoiceRefund id for this invoice (verify-refund action target). */
  refundId?: string | null;
  /** 'customer' | 'owner' — drives the verify-refund vs gateway-verify branch. */
  refundOrigin?: string | null;
  /** Latest InvoiceRefund status — feeds the host-cancelled/refund badge. */
  refundStatus?: string | null;
}

export type InvoiceWireStatus =
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

/** Wire state → business label shown in the console. */
export const WIRE_STATUS_LABEL: Record<InvoiceWireStatus, string> = {
  customer_due: 'Customer Due',
  paid: 'Paid',
  payment_verified: 'Ready for Payout',
  payout_approved: 'Approved for Payout',
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
  payout_approved: 'blue',
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

/**
 * Booking source label — where the booking came from. 'pos' = owner counter
 * sale, everything else (default 'web') = the public website. Internal only:
 * never shown to a customer or on an invoice.
 */
export function channelLabel(channel: string | null | undefined): string {
  return channel === 'pos' ? 'Counter' : 'Website';
}

/** Pill tone for the source badge — Website reads as the default (blue), Counter as amber. */
export function channelTone(channel: string | null | undefined): PillTone {
  return channel === 'pos' ? 'amb' : 'blue';
}

/** Mask a gateway token for on-screen display. */
export function maskToken(token: string | null): string {
  if (!token) return '— (cash)';
  return token.length > 10 ? `${token.slice(0, 8)}…${token.slice(-4)}` : token;
}

/**
 * Badge for a host-cancelled trip, shown alongside the normal invoice status.
 * A host-cancelled invoice keeps status 'paid' until the customer requests a
 * refund, so this is the only on-screen signal that the trip was cancelled.
 * Returns null when the trip was not host-cancelled.
 */
export function hostCancelBadge(
  departureStatus: string | null | undefined,
  refundStatus?: string | null,
): { label: string; tone: PillTone } | null {
  if (departureStatus !== 'cancelled') return null;
  switch (refundStatus) {
    case 'requested':
      return { label: 'Refund requested', tone: 'warn' };
    case 'verified':
      return { label: 'Refund verified', tone: 'blue' };
    case 'completed':
      return { label: 'Refunded', tone: 'ok' };
    default:
      return { label: 'Host-cancelled', tone: 'amb' };
  }
}
