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
import { useAdminList } from '@/lib/admin/useAdminList';
import { formatBDT } from '@/lib/admin/money';

interface SubscriptionRow {
  id: string;
  period: string;
  monthlyFee: string | null;
  commissionTotal: string | null;
  amountDue: string;
  status: 'issued' | 'paid' | 'overdue';
  issuedAt: string;
  houseboat: { id: string; name: string };
}

const STATUS_TONE = { issued: 'warn', paid: 'ok', overdue: 'danger' } as const;

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'issued', label: 'Issued' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
];

export default function Billing() {
  const [status, setStatus] = useState('');
  const { items, error, isInitialLoading, hasMore, loadMore, mutate } =
    useAdminList<SubscriptionRow>('/platform/finance/subscription-invoices', {
      status: status || undefined,
      limit: 25,
    });

  return (
    <>
      <PageHead
        title="Subscription invoices"
        desc="The monthly bill the platform sends each boat — separate from booking commission. Billing is per boat, never combined across a multi-boat owner."
      />
      <div className="filterbar">
        <Select options={STATUS_OPTIONS} value={status} onChange={setStatus} />
      </div>
      <Card flush>
        {error ? (
          <ErrorState error={error} onRetry={() => mutate()} />
        ) : !isInitialLoading && items.length === 0 ? (
          <EmptyState
            title="No subscription invoices"
            desc="Issue a boat's monthly bill from the money API; it appears here."
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Boat</th>
                  <th className="num">Monthly fee</th>
                  <th className="num">Commission</th>
                  <th className="num">Amount due</th>
                  <th>Issued</th>
                  <th>Status</th>
                </tr>
              </thead>
              {isInitialLoading ? (
                <TableSkeleton rows={4} cols={7} />
              ) : (
                <tbody>
                  {items.map((s) => (
                    <tr key={s.id}>
                      <td className="t1">{s.period}</td>
                      <td>{s.houseboat.name}</td>
                      <td className="num">
                        {s.monthlyFee !== null ? (
                          <><span className="u">৳</span> {formatBDT(s.monthlyFee)}</>
                        ) : '—'}
                      </td>
                      <td className="num">
                        {s.commissionTotal !== null ? (
                          <><span className="u">৳</span> {formatBDT(s.commissionTotal)}</>
                        ) : '—'}
                      </td>
                      <td className="num">
                        <span className="u">৳</span> {formatBDT(s.amountDue)}
                      </td>
                      <td className="t2">
                        {new Date(s.issuedAt).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td>
                        <Pill tone={STATUS_TONE[s.status]}>{s.status}</Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </TableWrap>
            {hasMore ? (
              <div style={{ padding: 12, textAlign: 'center' }}>
                <button className="btn btn-o btn-sm" onClick={loadMore}>
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
