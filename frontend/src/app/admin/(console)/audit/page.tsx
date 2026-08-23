'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import {
  PageHead,
  Card,
  TableWrap,
  TableSkeleton,
  EmptyState,
  ErrorState,
} from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';
import { BTN_O, BTN_SM, TD_NUM, TD_T1, TD_T2 } from '@/components/admin/styles';

interface AuditRow {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  serverTime: string;
  syncedOffline: boolean;
  houseboat: { id: string; name: string } | null;
  actor: { id: string; name: string | null; phone: string } | null;
}

interface AuditPage {
  items: AuditRow[];
  nextBefore: string | null;
}

const ACTION_TONE = (action: string): 'ok' | 'warn' | 'danger' | 'blue' | 'mut' => {
  if (action.includes('paid') || action.includes('approve')) return 'ok';
  if (action.includes('price') || action.includes('void')) return 'warn';
  if (action.includes('role') || action.includes('status')) return 'blue';
  return 'mut';
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function Audit() {
  // Older pages are keyed by server_time — the audit log can't cursor on id
  // because its primary key is composite (partitioned table).
  const [before, setBefore] = useState<string | null>(null);
  const [accumulated, setAccumulated] = useState<AuditRow[]>([]);

  const key = before
    ? `/platform/ops/audit?limit=50&before=${encodeURIComponent(before)}`
    : '/platform/ops/audit?limit=50';
  const { data, error, isLoading, mutate } = useSWR<AuditPage>(key, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const items = before ? [...accumulated, ...(data?.items ?? [])] : (data?.items ?? []);
  const initialLoading = isLoading && !before;

  return (
    <>
      <PageHead
        title="Audit log"
        desc="Append-only fraud evidence — nobody, not even the platform, can rewrite it (enforced by a DB trigger). Server time is authoritative; device time may be manipulated."
      />
      <Card flush>
        {error ? (
          <ErrorState error={error} onRetry={() => mutate()} />
        ) : !initialLoading && items.length === 0 ? (
          <EmptyState
            title="No audit entries yet"
            desc="Every money-moving and permission-changing action lands here automatically."
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Boat</th>
                  <th>Server time</th>
                  <th>Src</th>
                </tr>
              </thead>
              {initialLoading ? (
                <TableSkeleton rows={8} cols={6} />
              ) : (
                <tbody>
                  {items.map((row) => (
                    <tr key={`${row.id}-${row.serverTime}`}>
                      <td>
                        <div className={TD_T1}>{row.actor?.name ?? 'system'}</div>
                        {row.actor ? (
                          <div className={TD_T2}>{row.actor.phone}</div>
                        ) : null}
                      </td>
                      <td>
                        <Pill tone={ACTION_TONE(row.action)}>{row.action}</Pill>
                      </td>
                      <td className={TD_T2}>
                        {row.entityType ?? '—'}
                        {row.entityId ? ` · ${row.entityId.slice(0, 8)}` : ''}
                      </td>
                      <td>{row.houseboat?.name ?? <span className={TD_T2}>platform</span>}</td>
                      <td className={TD_NUM}>{formatTime(row.serverTime)}</td>
                      <td>
                        <Pill tone={row.syncedOffline ? 'amb' : 'mut'}>
                          {row.syncedOffline ? 'offline' : 'online'}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </TableWrap>
            {data?.nextBefore ? (
              <div style={{ padding: 12, textAlign: 'center' }}>
                <button
                  className={`${BTN_O} ${BTN_SM}`}
                  onClick={() => {
                    setAccumulated(items);
                    setBefore(data.nextBefore);
                  }}
                >
                  Load older
                </button>
              </div>
            ) : null}
          </>
        )}
      </Card>
    </>
  );
}
