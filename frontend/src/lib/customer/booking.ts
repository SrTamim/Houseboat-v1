/** Customer-side booking helpers shared across the trips list + detail pages. */

/** Days a customer has to request a refund after the host cancels a trip. */
export const REFUND_REQUEST_DAYS = 6;

type DepartureLike = {
  status?: string;
  cancelledAt?: string | null;
} | null | undefined;

/** True when the owner cancelled the trip (regardless of the request window). */
export function isHostCancelled(dep: DepartureLike): boolean {
  return dep?.status === 'cancelled';
}

/**
 * True while the customer may still request a refund: the trip was host-cancelled
 * AND we are within REFUND_REQUEST_DAYS of the cancellation. Mirrors the backend
 * gate in RefundsService.requestRefundAsCustomer.
 */
export function refundWindowOpen(dep: DepartureLike): boolean {
  if (!isHostCancelled(dep) || !dep?.cancelledAt) return false;
  const deadline =
    new Date(dep.cancelledAt).getTime() + REFUND_REQUEST_DAYS * 864e5;
  return Date.now() <= deadline;
}

/** Human label for an InvoiceRefund status shown to the customer. */
export function refundStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'requested':
      return 'Refund requested';
    case 'verified':
      return 'Refund approved';
    case 'completed':
      return 'Refund sent';
    default:
      return 'Refund';
  }
}
