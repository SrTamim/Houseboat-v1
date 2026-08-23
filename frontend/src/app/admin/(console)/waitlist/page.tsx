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
import { useAdminList } from '@/lib/admin/useAdminList';
import { BTN_O, BTN_SM, MONEY, TD_NUM, TD_T1, TD_T2 } from '@/components/admin/styles';

interface WaitlistEntry {
  id: string;
  partySize: number;
  createdAt: string;
  customer: { id: string; name: string | null; phone: string };
  departure: {
    id: string;
    startDate: string;
    status: string;
    availableCount: number;
    package: {
      durationLabel: string | null;
      houseboat: { id: string; name: string };
    };
  };
}

const DEPARTURE_TONE: Record<string, 'ok' | 'warn' | 'danger' | 'mut'> = {
  scheduled: 'ok',
  in_progress: 'warn',
  completed: 'mut',
  cancelled: 'danger',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function Waitlist() {
  const { items, error, isInitialLoading, hasMore, loadMore, mutate } =
    useAdminList<WaitlistEntry>('/platform/ops/waitlist', { limit: 50 });

  return (
    <>
      <PageHead
        title="Waitlist"
        desc={<>Customers queued for full departures, newest first. When a cabin frees, all waitlisted customers are notified at once — first to hold wins.</>}
      />

      <Card title="Waitlist entries" flush>
        {error ? (
          <ErrorState error={error} onRetry={() => mutate()} />
        ) : !isInitialLoading && items.length === 0 ? (
          <EmptyState
            title="Waitlist is empty"
            desc="Entries appear here when customers join the waitlist for a full departure."
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <th>Departure</th>
                  <th>Customer</th>
                  <th className={TD_NUM}>Party</th>
                  <th className={TD_NUM}>Available now</th>
                  <th>Departure status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              {isInitialLoading ? (
                <TableSkeleton rows={5} cols={6} />
              ) : (
                <tbody>
                  {items.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <div className={TD_T1}>
                          {entry.departure.package.houseboat.name} ·{' '}
                          {formatDate(entry.departure.startDate)}
                        </div>
                        <div className={TD_T2}>
                          {entry.departure.package.durationLabel ?? '—'}
                        </div>
                      </td>
                      <td>
                        <div className={TD_T1}>{entry.customer.name ?? '—'}</div>
                        <div className={TD_T2}>{entry.customer.phone}</div>
                      </td>
                      <td className={TD_NUM}>{entry.partySize}</td>
                      <td className={TD_NUM}>
                        {entry.departure.availableCount > 0 ? (
                          <b className={MONEY}>{entry.departure.availableCount}</b>
                        ) : (
                          0
                        )}
                      </td>
                      <td>
                        <Pill tone={DEPARTURE_TONE[entry.departure.status] ?? 'mut'}>
                          {entry.departure.status}
                        </Pill>
                      </td>
                      <td className={TD_T2}>{formatDate(entry.createdAt)}</td>
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
