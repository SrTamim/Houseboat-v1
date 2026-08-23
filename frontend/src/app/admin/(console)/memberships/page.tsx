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
import { BTN_O, BTN_SM, FILTERBAR, TD_NUM, TD_T1, TD_T2 } from '@/components/admin/styles';

interface MembershipRow {
  id: string;
  shareholderPct: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  account: { id: string; name: string | null; phone: string };
  houseboat: { id: string; name: string };
  role: { id: string; name: string };
}

const STATUS_OPTIONS = [
  { value: '', label: 'All members' },
  { value: 'active', label: 'Active only' },
  { value: 'exited', label: 'Exited only' },
];

function formatMonth(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-GB', {
    month: 'short',
    year: '2-digit',
  });
}

function period(m: MembershipRow): string {
  const from = formatMonth(m.startDate);
  const to = formatMonth(m.endDate);
  if (from && to) return `${from} – ${to}`;
  if (from) return `since ${from}`;
  return '—';
}

export default function Memberships() {
  const [status, setStatus] = useState('');
  const { items, error, isInitialLoading, hasMore, loadMore, mutate } =
    useAdminList<MembershipRow>('/platform/ops/memberships', {
      status: status || undefined,
      limit: 25,
    });

  return (
    <>
      <PageHead
        title="Membership oversight"
        desc="Per-boat co-owners for dispute support. An exited shareholder keeps read access to their own period only. Distributions are recorded, never auto-split."
      />
      <div className={FILTERBAR}>
        <Select options={STATUS_OPTIONS} value={status} onChange={setStatus} />
      </div>
      <Card flush>
        {error ? (
          <ErrorState error={error} onRetry={() => mutate()} />
        ) : !isInitialLoading && items.length === 0 ? (
          <EmptyState
            title="No memberships yet"
            desc="Members appear here when owners add co-owners and staff to their boats."
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Boat</th>
                  <th>Role</th>
                  <th className={TD_NUM}>Share</th>
                  <th>Period</th>
                  <th>Status</th>
                </tr>
              </thead>
              {isInitialLoading ? (
                <TableSkeleton rows={5} cols={6} />
              ) : (
                <tbody>
                  {items.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className={TD_T1}>{m.account.name ?? '—'}</div>
                        <div className={TD_T2}>{m.account.phone}</div>
                      </td>
                      <td>{m.houseboat.name}</td>
                      <td>
                        <Pill tone={m.role.name === 'Owner' ? 'blue' : 'mut'}>
                          {m.role.name}
                        </Pill>
                      </td>
                      <td className={TD_NUM}>
                        {m.shareholderPct !== null ? `${m.shareholderPct}%` : '—'}
                      </td>
                      <td className={TD_T2}>{period(m)}</td>
                      <td>
                        <Pill tone={m.status === 'active' ? 'ok' : 'warn'}>
                          {m.status === 'active' ? 'active' : 'exited · read-only'}
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
