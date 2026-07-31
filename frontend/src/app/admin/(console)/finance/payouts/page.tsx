'use client';

import {
  PageHead,
  Card,
  TableWrap,
  TableSkeleton,
  EmptyState,
  ErrorState,
} from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';
import { PlatformInvoiceTable } from '@/components/admin/PlatformInvoiceTable';
import { useAdminList } from '@/lib/admin/useAdminList';
import { formatBDT, isNegative } from '@/lib/admin/money';
import type { ApiInvoice } from '@/lib/admin/invoices';

interface PayoutBatch {
  id: string;
  status: string;
  /** Decimal(12,2) — arrives as a string, and CAN be negative (boat owes the platform). */
  totalAmount: string;
  paidAt: string | null;
  preparedBy: string | null;
  approvedBy: string | null;
  houseboat: { id: string; name: string; slug: string };
}

export default function Payouts() {
  const batches = useAdminList<PayoutBatch>('/platform/finance/payout-batches', {
    limit: 20,
  });
  const readyInvoices = useAdminList<ApiInvoice>('/platform/finance/invoices', {
    status: 'payment_verified',
    limit: 20,
  });

  return (
    <>
      <PageHead
        title="Payouts"
        desc={<>Verified invoices below are ready to batch per boat — the preparer must not be the approver, and a boat with no bank account cannot be paid.</>}
      />
      <Card title="Payout batches" flush style={{ marginBottom: 20 }}>
        {batches.error ? (
          <ErrorState error={batches.error} onRetry={() => batches.mutate()} />
        ) : !batches.isInitialLoading && batches.items.length === 0 ? (
          <EmptyState
            title="No payout batches yet"
            desc="Batches appear here once a boat's verified invoices are prepared for payment."
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Boat</th>
                  <th>Status</th>
                  <th className="num">Total</th>
                  <th>Paid</th>
                </tr>
              </thead>
              {batches.isInitialLoading ? (
                <TableSkeleton rows={4} cols={5} />
              ) : (
                <tbody>
                  {batches.items.map((b) => (
                    <tr key={b.id}>
                      <td className="t1">{b.id.slice(0, 8)}</td>
                      <td>{b.houseboat.name}</td>
                      <td>
                        <Pill tone={b.status === 'paid' ? 'ok' : 'mut'}>
                          {b.status}
                        </Pill>
                      </td>
                      <td
                        className="num"
                        // A negative batch means the boat owes the platform —
                        // surface that rather than hiding the sign.
                        style={
                          isNegative(b.totalAmount)
                            ? { color: 'var(--danger)' }
                            : undefined
                        }
                      >
                        <span className="u">৳</span> {formatBDT(b.totalAmount)}
                      </td>
                      <td className="t2">
                        {b.paidAt
                          ? new Date(b.paidAt).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </TableWrap>
            {batches.hasMore ? (
              <div style={{ padding: 12, textAlign: 'center' }}>
                <button className="btn btn-o btn-sm" onClick={batches.loadMore}>
                  Load more
                </button>
              </div>
            ) : null}
          </>
        )}
      </Card>

      <PageHead title="Ready for payout" desc="Verified invoices not yet pulled into a batch." />
      <PlatformInvoiceTable
        items={readyInvoices.items}
        error={readyInvoices.error}
        isLoading={readyInvoices.isInitialLoading}
        onRetry={() => readyInvoices.mutate()}
        emptyTitle="No invoices ready for payout"
        emptyDesc="Invoices land here after payment verification, until they enter a payout batch."
        hasMore={readyInvoices.hasMore}
        onLoadMore={readyInvoices.loadMore}
      />
    </>
  );
}
