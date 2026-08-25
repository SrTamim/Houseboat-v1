'use client';

// Invoice table over the real /platform/finance/invoices payload — replaces
// the mock-backed InvoiceTable on wired finance pages.

import {
  Card,
  TableWrap,
  TableSkeleton,
  EmptyState,
  ErrorState,
} from './ui';
import { Pill, Tag } from './Pill';
import { BTN_B, BTN_DANGER, BTN_O, BTN_OK, BTN_SM, ROWACT, TD_NUM, TD_T1, TD_T2, UNIT } from './styles';
import { formatBDT } from '@/lib/admin/money';
import {
  type ApiInvoice,
  wireStatusLabel,
  wireStatusTone,
  shortId,
  maskToken,
  channelLabel,
  channelTone,
} from '@/lib/admin/invoices';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function PlatformInvoiceTable({
  items,
  error,
  isLoading,
  onRetry,
  emptyTitle,
  emptyDesc,
  actionLabel,
  actionBusyId,
  onAction,
  onApprove,
  onReject,
  actionBusyIdShared,
  onOpen,
  hasMore,
  onLoadMore,
}: {
  items: ApiInvoice[];
  error?: unknown;
  isLoading: boolean;
  onRetry?: () => void;
  emptyTitle: string;
  emptyDesc?: React.ReactNode;
  /** Omit for a read-only queue. */
  actionLabel?: string;
  actionBusyId?: string | null;
  onAction?: (invoice: ApiInvoice) => void;
  /** Payout-queue actions, gated by invoice status. Approve shows on paid/payment_verified; Reject on payout_approved. */
  onApprove?: (invoice: ApiInvoice) => void;
  onReject?: (invoice: ApiInvoice) => void;
  /** Busy id shared by the approve/reject buttons. */
  actionBusyIdShared?: string | null;
  /** Open the invoice detail drawer. Omit to hide the Open button. */
  onOpen?: (invoice: ApiInvoice) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
}) {
  const hasRowActions = Boolean(actionLabel || onApprove || onReject);
  // base 9 columns + Open (when onOpen) + a shared action column.
  const cols = 9 + (onOpen ? 1 : 0) + (hasRowActions ? 1 : 0);
  return (
    <Card flush>
      {error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : !isLoading && items.length === 0 ? (
        <EmptyState title={emptyTitle} desc={emptyDesc} />
      ) : (
        <>
          <TableWrap minWidth={1180}>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Boat</th>
                <th>Customer</th>
                <th>Trip start</th>
                <th>Status</th>
                <th>Source</th>
                <th>Payment</th>
                <th className={TD_NUM}>Total</th>
                <th>Gateway / txn</th>
                {onOpen ? <th /> : null}
                {hasRowActions ? <th /> : null}
              </tr>
            </thead>
            {isLoading ? (
              <TableSkeleton rows={5} cols={cols} />
            ) : (
              <tbody>
                {items.map((inv) => {
                  const lastPayment = inv.payments[inv.payments.length - 1];
                  return (
                    <tr key={inv.id} className="group">
                      <td>
                        <div className={TD_T1}>{shortId(inv.id, 'INV')}</div>
                        <div className={TD_T2}>{shortId(inv.booking.id, 'BK')}</div>
                      </td>
                      <td>{inv.houseboat.name}</td>
                      <td>
                        <div className={TD_T1}>{inv.customer.name ?? '—'}</div>
                        <div className={TD_T2}>{inv.customer.phone}</div>
                      </td>
                      <td className={TD_T2}>
                        {formatDate(inv.booking.departure.startDate)}
                      </td>
                      <td>
                        <Pill tone={wireStatusTone(inv.status)}>
                          {wireStatusLabel(inv.status)}
                        </Pill>
                      </td>
                      <td>
                        <Pill tone={channelTone(inv.booking.channel)}>
                          {channelLabel(inv.booking.channel)}
                        </Pill>
                      </td>
                      <td>
                        {lastPayment ? <Tag>{lastPayment.method}</Tag> : <Tag>unpaid</Tag>}
                      </td>
                      <td className={TD_NUM}>
                        <span className={UNIT}>৳</span> {formatBDT(inv.displayTotal)}
                      </td>
                      <td className={TD_T2}>
                        {lastPayment ? maskToken(lastPayment.gatewayToken) : '—'}
                      </td>
                      {onOpen ? (
                        <td>
                          <div className={ROWACT}>
                            <button
                              className={`${BTN_O} ${BTN_SM}`}
                              onClick={() => onOpen(inv)}
                            >
                              Open
                            </button>
                          </div>
                        </td>
                      ) : null}
                      {hasRowActions ? (
                        <td>
                          <div className={ROWACT}>
                            {actionLabel && onAction ? (
                              <button
                                className={`${BTN_B} ${BTN_SM}`}
                                disabled={actionBusyId === inv.id}
                                onClick={() => onAction(inv)}
                              >
                                {actionBusyId === inv.id ? '…' : actionLabel}
                              </button>
                            ) : null}
                            {onApprove &&
                            (inv.status === 'paid' ||
                              inv.status === 'payment_verified') ? (
                              <button
                                className={`${BTN_OK} ${BTN_SM}`}
                                disabled={actionBusyIdShared === inv.id}
                                onClick={() => onApprove(inv)}
                              >
                                {actionBusyIdShared === inv.id ? '…' : 'Approve'}
                              </button>
                            ) : null}
                            {onReject &&
                            (inv.status === 'payout_approved' ||
                              inv.status === 'payment_verified') ? (
                              <button
                                className={`${BTN_DANGER} ${BTN_SM}`}
                                disabled={actionBusyIdShared === inv.id}
                                onClick={() => onReject(inv)}
                              >
                                {actionBusyIdShared === inv.id ? '…' : 'Reject'}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            )}
          </TableWrap>
          {hasMore && onLoadMore ? (
            <div className="p-3 text-center">
              <button className={`${BTN_O} ${BTN_SM}`} onClick={onLoadMore}>
                Load more
              </button>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
