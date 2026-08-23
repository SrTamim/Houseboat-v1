'use client';

import {
  PageHead,
  Card,
  TableWrap,
  TableSkeleton,
  EmptyState,
  ErrorState,
  Note,
} from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';
import { useAdminList } from '@/lib/admin/useAdminList';
import { formatBDT } from '@/lib/admin/money';
import {
  shortId,
  wireStatusLabel,
  wireStatusTone,
} from '@/lib/admin/invoices';
import { BTN_O, BTN_SM, TD_NUM, TD_T1, TD_T2, UNIT } from '@/components/admin/styles';

interface OverpaymentRow {
  id: string;
  status: string;
  displayTotal: string;
  amountPaid: string;
  amountOverpaid: string;
  houseboat: { id: string; name: string };
  customer: { id: string; name: string | null; phone: string };
  booking: { id: string; createdAt: string };
}

export default function Overpayments() {
  const { items, error, isInitialLoading, hasMore, loadMore, mutate } =
    useAdminList<OverpaymentRow>('/platform/finance/overpayments', {
      limit: 25,
    });

  return (
    <>
      <PageHead
        title="Overpayments"
        desc={<>Invoices where the customer paid more than the final bill — an open-seat buyout filled after payment, or a reschedule surplus. The surplus becomes customer credit or a refund.</>}
      />
      <Card flush>
        {error ? (
          <ErrorState error={error} onRetry={() => mutate()} />
        ) : !isInitialLoading && items.length === 0 ? (
          <EmptyState
            title="No overpayments"
            desc="Invoices land here when amount paid exceeds the adjusted bill."
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Boat</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th className={TD_NUM}>Bill</th>
                  <th className={TD_NUM}>Paid</th>
                  <th className={TD_NUM}>Overpaid</th>
                </tr>
              </thead>
              {isInitialLoading ? (
                <TableSkeleton rows={4} cols={7} />
              ) : (
                <tbody>
                  {items.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <div className={TD_T1}>{shortId(inv.id, 'INV')}</div>
                        <div className={TD_T2}>{shortId(inv.booking.id, 'BK')}</div>
                      </td>
                      <td>{inv.houseboat.name}</td>
                      <td>
                        <div className={TD_T1}>{inv.customer.name ?? '—'}</div>
                        <div className={TD_T2}>{inv.customer.phone}</div>
                      </td>
                      <td>
                        <Pill tone={wireStatusTone(inv.status)}>
                          {wireStatusLabel(inv.status)}
                        </Pill>
                      </td>
                      <td className={TD_NUM}>
                        <span className={UNIT}>৳</span> {formatBDT(inv.displayTotal)}
                      </td>
                      <td className={TD_NUM}>
                        <span className={UNIT}>৳</span> {formatBDT(inv.amountPaid)}
                      </td>
                      <td className={TD_NUM} style={{ color: 'var(--danger)' }}>
                        <span className={UNIT}>৳</span> {formatBDT(inv.amountOverpaid)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </TableWrap>
            {hasMore ? (
              <div style={{ padding: 12, textAlign: 'center' }}>
                <button className={`${BTN_O} ${BTN_SM}`} onClick={loadMore}>
                  Load more
                </button>
              </div>
            ) : null}
          </>
        )}
      </Card>
      <Note kind="info" icon="ℹ" style={{ marginTop: 16 }}>
        An open-seat invoice only ever moves down. The surplus lands here first —
        it never becomes a negative payable to the boat.
      </Note>
    </>
  );
}
