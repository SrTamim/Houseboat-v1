'use client';

import { useState } from 'react';
import {
  PageHead,
  Card,
  TableWrap,
  TableSkeleton,
  EmptyState,
  ErrorState,
  Select,
} from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';
import { BTN_O, BTN_SM, FILTERBAR, TD_NUM, TD_T1, TD_T2, UNIT } from '@/components/admin/styles';
import { useAdminList } from '@/lib/admin/useAdminList';
import { formatBDT } from '@/lib/admin/money';
import { shortId } from '@/lib/admin/invoices';

interface CreditRow {
  id: string;
  amount: string;
  status: 'open' | 'used';
  account: { id: string; name: string | null; phone: string };
  sourceInvoice: { id: string; houseboat: { name: string } } | null;
  usedInInvoice: { id: string } | null;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All credits' },
  { value: 'open', label: 'Open only' },
  { value: 'used', label: 'Used only' },
];

export default function Credits() {
  const [status, setStatus] = useState('');
  const { items, error, isInitialLoading, hasMore, loadMore, mutate } =
    useAdminList<CreditRow>('/platform/finance/credits', {
      status: status || undefined,
      limit: 25,
    });

  return (
    <>
      <PageHead
        title="Customer-credit ledger"
        desc="Platform liability — money owed to customers as credit toward future bookings. Fed by overpayments and reschedule advances."
      />
      <div className={FILTERBAR}>
        <Select options={STATUS_OPTIONS} value={status} onChange={setStatus} />
      </div>
      <Card flush>
        {error ? (
          <ErrorState error={error} onRetry={() => mutate()} />
        ) : !isInitialLoading && items.length === 0 ? (
          <EmptyState
            title="No customer credits"
            desc="Credits appear here when an overpayment is converted instead of refunded."
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className={TD_NUM}>Amount</th>
                  <th>Source</th>
                  <th>Used in</th>
                  <th>Status</th>
                </tr>
              </thead>
              {isInitialLoading ? (
                <TableSkeleton rows={4} cols={5} />
              ) : (
                <tbody>
                  {items.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className={TD_T1}>{c.account.name ?? '—'}</div>
                        <div className={TD_T2}>{c.account.phone}</div>
                      </td>
                      <td className={TD_NUM}>
                        <span className={UNIT}>৳</span> {formatBDT(c.amount)}
                      </td>
                      <td className={TD_T2}>
                        {c.sourceInvoice
                          ? `${shortId(c.sourceInvoice.id, 'INV')} · ${c.sourceInvoice.houseboat.name}`
                          : '—'}
                      </td>
                      <td className={TD_T2}>
                        {c.usedInInvoice ? shortId(c.usedInInvoice.id, 'INV') : '—'}
                      </td>
                      <td>
                        <Pill tone={c.status === 'open' ? 'blue' : 'ok'}>
                          {c.status}
                        </Pill>
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
    </>
  );
}
