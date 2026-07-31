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
import { formatBDT } from '@/lib/admin/money';
import {
  type ApiInvoice,
  wireStatusLabel,
  wireStatusTone,
  shortId,
  maskToken,
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
  hasMore?: boolean;
  onLoadMore?: () => void;
}) {
  const cols = actionLabel ? 9 : 8;
  return (
    <Card flush>
      {error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : !isLoading && items.length === 0 ? (
        <EmptyState title={emptyTitle} desc={emptyDesc} />
      ) : (
        <>
          <TableWrap minWidth={1100}>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Boat</th>
                <th>Customer</th>
                <th>Trip start</th>
                <th>Status</th>
                <th>Payment</th>
                <th className="num">Total</th>
                <th>Gateway / txn</th>
                {actionLabel ? <th /> : null}
              </tr>
            </thead>
            {isLoading ? (
              <TableSkeleton rows={5} cols={cols} />
            ) : (
              <tbody>
                {items.map((inv) => {
                  const lastPayment = inv.payments[inv.payments.length - 1];
                  return (
                    <tr key={inv.id}>
                      <td>
                        <div className="t1">{shortId(inv.id, 'INV')}</div>
                        <div className="t2">{shortId(inv.booking.id, 'BK')}</div>
                      </td>
                      <td>{inv.houseboat.name}</td>
                      <td>
                        <div className="t1">{inv.customer.name ?? '—'}</div>
                        <div className="t2">{inv.customer.phone}</div>
                      </td>
                      <td className="t2">
                        {formatDate(inv.booking.departure.startDate)}
                      </td>
                      <td>
                        <Pill tone={wireStatusTone(inv.status)}>
                          {wireStatusLabel(inv.status)}
                        </Pill>
                      </td>
                      <td>
                        {lastPayment ? <Tag>{lastPayment.method}</Tag> : <Tag>unpaid</Tag>}
                      </td>
                      <td className="num">
                        <span className="u">৳</span> {formatBDT(inv.displayTotal)}
                      </td>
                      <td className="t2">
                        {lastPayment ? maskToken(lastPayment.gatewayToken) : '—'}
                      </td>
                      {actionLabel && onAction ? (
                        <td className="rowact">
                          <button
                            className="btn btn-sm btn-b"
                            disabled={actionBusyId === inv.id}
                            onClick={() => onAction(inv)}
                          >
                            {actionBusyId === inv.id ? '…' : actionLabel}
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            )}
          </TableWrap>
          {hasMore && onLoadMore ? (
            <div style={{ padding: 12, textAlign: 'center' }}>
              <button className="btn btn-o btn-sm" onClick={onLoadMore}>
                Load more
              </button>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
