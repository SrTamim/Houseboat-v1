'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import {
  PageHead,
  Card,
  FilterBar,
  Select,
  Note,
  TableWrap,
  AsyncTable,
} from '@/components/owner/ui';
import { Pill } from '@/components/owner/Pill';
import { formatDateTime, humanize } from '@/lib/owner/format';

interface AuditRow {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  deviceTime: string | null;
  serverTime: string;
  syncedOffline: boolean;
  actor: { id: string; name: string | null; phone: string } | null;
}

interface AuditPage {
  items: AuditRow[];
  nextCursor: string | null;
}

export default function OwnerAuditPage() {
  const { boatId } = useActiveBoat();
  const [action, setAction] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [accumulated, setAccumulated] = useState<AuditRow[]>([]);

  const key = `/houseboats/${boatId}/audit?limit=50${action ? `&action=${action}` : ''}${
    cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
  }`;

  const { data, error, isLoading, mutate } = useSWR<AuditPage>(key, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const actions = useSWR<string[]>(`/houseboats/${boatId}/audit/actions`, fetcher, {
    revalidateOnFocus: false,
  });

  const rows = cursor ? [...accumulated, ...(data?.items ?? [])] : (data?.items ?? []);

  return (
    <>
      <PageHead
        title="Audit log"
        desc="Every change to bookings, money and settings, with who made it and from where. The trail is append-only — nothing here can be edited or deleted, including by us."
      />

      <FilterBar>
        <Select
          ariaLabel="Filter by action"
          options={[
            { value: '', label: 'All actions' },
            ...(actions.data ?? []).map((a) => ({ value: a, label: humanize(a) })),
          ]}
          value={action}
          onChange={(v) => {
            setAction(v);
            setCursor(null);
            setAccumulated([]);
          }}
        />
      </FilterBar>

      <Card flush>
        <TableWrap minWidth={820}>
          <thead>
            <tr>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Device time</th>
              <th>Server time</th>
              <th>Source</th>
            </tr>
          </thead>
          <AsyncTable
            isLoading={isLoading && !cursor}
            error={error}
            isEmpty={rows.length === 0}
            onRetry={() => mutate()}
            empty={
              <div className="state">
                <div className="ic">📜</div>
                <h4>Nothing recorded</h4>
                <p>Actions appear here as you and your team work.</p>
              </div>
            }
          >
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.serverTime}-${r.id}`}>
                  <td className="t1">{r.actor?.name ?? r.actor?.phone ?? 'system'}</td>
                  <td>
                    <Pill tone="mut">{humanize(r.action)}</Pill>
                  </td>
                  <td className="t2">{r.entityType ? humanize(r.entityType) : '—'}</td>
                  <td className="t2">
                    {r.deviceTime ? formatDateTime(r.deviceTime) : '—'}
                  </td>
                  <td className="t2">{formatDateTime(r.serverTime)}</td>
                  <td>
                    <Pill tone={r.syncedOffline ? 'amb' : 'blue'}>
                      {r.syncedOffline ? 'offline replay' : 'online'}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </AsyncTable>

          {data?.nextCursor ? (
            <tfoot>
              <tr>
                <td colSpan={6} style={{ textAlign: 'center' }}>
                  <button
                    className="btn btn-o btn-sm"
                    disabled={isLoading}
                    onClick={() => {
                      setAccumulated(rows);
                      setCursor(data.nextCursor);
                    }}
                  >
                    {isLoading ? 'Loading…' : 'Load more'}
                  </button>
                </td>
              </tr>
            </tfoot>
          ) : null}
        </TableWrap>
      </Card>

      <Note kind="warn" style={{ marginTop: 16 }}>
        Device time and server time can differ — a phone clock is whatever the phone says
        it is, and an offline action carries its device time until it syncs. Server time is
        the authoritative one, and it is what a dispute cites.
      </Note>
    </>
  );
}
