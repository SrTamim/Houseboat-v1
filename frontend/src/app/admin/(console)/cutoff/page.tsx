'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
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
import { TD_NUM, TD_T1, TD_T2 } from '@/components/admin/styles';

interface DueDeparture {
  id: string;
  startDate: string;
  endDate: string | null;
  status: 'scheduled' | 'in_progress';
  availableCount: number;
  package: {
    durationLabel: string | null;
    houseboat: { id: string; name: string };
  };
  _count: { bookings: number; holds: number };
}

export default function Cutoff() {
  const { data, error, isLoading, mutate } = useSWR<DueDeparture[]>(
    '/platform/ops/departures/due',
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 60_000 },
  );

  const rows = data ?? [];

  return (
    <>
      <PageHead
        title="Cutoff & finalize"
        desc="Departures whose date has arrived but whose status has not finished advancing. The status-advance job normally clears this list — a lingering row means it is stuck."
      />
      <Card title="Departures at/past cutoff" flush>
        {error ? (
          <ErrorState error={error} onRetry={() => mutate()} />
        ) : !isLoading && rows.length === 0 ? (
          <EmptyState
            title="Nothing stuck"
            desc="All departures have advanced on time. Rows appear here when a departure's date passes while it is still scheduled or in progress."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Departure</th>
                <th>Start</th>
                <th>Status</th>
                <th className={TD_NUM}>Bookings</th>
                <th className={TD_NUM}>Holds</th>
                <th className={TD_NUM}>Available</th>
              </tr>
            </thead>
            {isLoading ? (
              <TableSkeleton rows={3} cols={6} />
            ) : (
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div className={TD_T1}>{d.package.houseboat.name}</div>
                      <div className={TD_T2}>{d.package.durationLabel ?? '—'}</div>
                    </td>
                    <td className={TD_T2}>
                      {new Date(d.startDate).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td>
                      <Pill tone={d.status === 'scheduled' ? 'warn' : 'blue'}>
                        {d.status}
                      </Pill>
                    </td>
                    <td className={TD_NUM}>{d._count.bookings}</td>
                    <td className={TD_NUM}>{d._count.holds}</td>
                    <td className={TD_NUM}>{d.availableCount}</td>
                  </tr>
                ))}
              </tbody>
            )}
          </TableWrap>
        )}
      </Card>
      <Note kind="info" icon="ℹ" style={{ marginTop: 16 }}>
        An unfilled buyout stands — nothing is refunded because the full amount
        was never charged. Whatever the invoice reads at finalize is final.
      </Note>
    </>
  );
}
