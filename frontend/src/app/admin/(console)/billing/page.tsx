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
  Search,
} from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';
import { useAdminList } from '@/lib/admin/useAdminList';
import { formatBDT } from '@/lib/admin/money';
import { BTN_O, BTN_SM, FILTERBAR, TD_NUM, TD_T1, TD_T2, TH_NUM, UNIT } from '@/components/admin/styles';

interface SubscriptionRow {
  id: string;
  period: string;
  monthlyFee: string | null;
  amountDue: string;
  status: 'issued' | 'paid' | 'overdue' | 'trial';
  issuedAt: string;
  houseboat: { id: string; name: string };
}

const STATUS_TONE = {
  issued: 'warn',
  paid: 'ok',
  overdue: 'danger',
  trial: 'mut',
} as const;

const STATUS_LABEL: Record<SubscriptionRow['status'], string> = {
  issued: 'issued',
  paid: 'paid',
  overdue: 'overdue',
  trial: 'free trial',
};

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'issued', label: 'Issued' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'trial', label: 'Free trial' },
];

export default function Billing() {
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const { items, error, isInitialLoading, hasMore, loadMore, mutate } =
    useAdminList<SubscriptionRow>('/platform/finance/subscription-invoices', {
      status: status || undefined,
      q: query || undefined,
      limit: 25,
    });

  return (
    <>
      <PageHead
        title="Subscription invoices"
        desc="The monthly bill the platform sends each boat — separate from booking commission. Billing is per boat, never combined across a multi-boat owner."
      />
      <div className={FILTERBAR}>
        <Search
          placeholder="Search boat or period…"
          maxWidth={420}
          value={query}
          onChange={setQuery}
        />
        <Select options={STATUS_OPTIONS} value={status} onChange={setStatus} />
      </div>
      <Card flush>
        {error ? (
          <ErrorState error={error} onRetry={() => mutate()} />
        ) : !isInitialLoading && items.length === 0 ? (
          <EmptyState
            title={query || status ? 'No invoices match' : 'No subscription invoices'}
            desc={
              query || status
                ? 'Try a different search or status filter.'
                : "Issue a boat's monthly bill from the money API; it appears here."
            }
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Boat</th>
                  <th className={TH_NUM}>Monthly fee</th>
                  <th className={TH_NUM}>Amount due</th>
                  <th>Issued</th>
                  <th>Status</th>
                </tr>
              </thead>
              {isInitialLoading ? (
                <TableSkeleton rows={4} cols={6} />
              ) : (
                <tbody>
                  {items.map((s) => (
                    <tr key={s.id}>
                      <td className={TD_T1}>{s.period}</td>
                      <td>{s.houseboat.name}</td>
                      <td className={TD_NUM}>
                        {s.monthlyFee !== null ? (
                          <><span className={UNIT}>৳</span> {formatBDT(s.monthlyFee)}</>
                        ) : '—'}
                      </td>
                      <td className={TD_NUM}>
                        <span className={UNIT}>৳</span> {formatBDT(s.amountDue)}
                      </td>
                      <td className={TD_T2}>
                        {new Date(s.issuedAt).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td>
                        <Pill tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Pill>
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
