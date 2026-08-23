'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import {
  PageHead,
  Card,
  Note,
  TableWrap,
  AsyncTable,
  EmptyState,
} from '@/components/owner/ui';
import { Pill } from '@/components/owner/Pill';
import { formatDateTime, humanize } from '@/lib/owner/format';

interface AuditRow {
  id: string;
  action: string;
  entityType: string | null;
  deviceTime: string | null;
  serverTime: string;
  syncedOffline: boolean;
  actor: { name: string | null; phone: string } | null;
}

/**
 * Offline sync.
 *
 * Replayed actions are recorded in the audit trail with syncedOffline set, so
 * this page reads that rather than a queue of its own. The device-side capture
 * queue does not exist yet — when it does, the pending half of this page gets a
 * real source instead of the note below.
 *
 * The replay engine logs BOTH applied intents and failures with syncedOffline
 * set: a failure lands as action 'sync_conflict' (unauthorized / conflict /
 * error). We split on that so a conflict is never shown as "applied" — which
 * would silently hide the exact money-losing outcome the Conflicts card warns
 * about.
 */
export default function OwnerSyncPage() {
  const { boatId } = useActiveBoat();

  const { data, error, isLoading, mutate } = useSWR<{ items: AuditRow[] }>(
    `/houseboats/${boatId}/audit?limit=50`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const rows = (data?.items ?? []).filter((r) => r.syncedOffline);
  const applied = rows.filter((r) => r.action !== 'sync_conflict');
  const needsReview = rows.filter((r) => r.action === 'sync_conflict');

  return (
    <>
      <PageHead
        title="Offline sync"
        desc="What happened while the boat had no signal, and what the server made of it once it reconnected."
      />

      <Note kind="info" style={{ marginBottom: 20 }}>
        Offline capture is not enabled on this device yet. Actions taken in the console go
        straight to the server; this page shows anything that arrived through the replay
        endpoint, which is how a future offline client will submit its queue.
      </Note>

      <Card title="Replayed actions" sub="captured offline, applied on reconnect" flush>
        <TableWrap minWidth={760}>
          <thead>
            <tr>
              <th>Action</th>
              <th>Actor</th>
              <th>Device time</th>
              <th>Server time</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <AsyncTable
            isLoading={isLoading}
            error={error}
            isEmpty={applied.length === 0}
            onRetry={() => mutate()}
            empty={
              <div className="px-6 py-11 text-center text-muted">
                <div className="mb-2.5 text-[26px]">🔄</div>
                <h4 className="mb-1.5 text-[15px] text-ink">Nothing replayed</h4>
                <p className="mx-auto max-w-[46ch] text-[13px] leading-[1.55]">
                  Everything on this boat was recorded live. Offline actions would appear
                  here once they sync.
                </p>
              </div>
            }
          >
            <tbody>
              {applied.map((r) => (
                <tr key={`${r.serverTime}-${r.id}`}>
                  <td className="t1">{humanize(r.action)}</td>
                  <td className="t2">{r.actor?.name ?? r.actor?.phone ?? 'system'}</td>
                  <td className="t2">{r.deviceTime ? formatDateTime(r.deviceTime) : '—'}</td>
                  <td className="t2">{formatDateTime(r.serverTime)}</td>
                  <td>
                    <Pill tone="ok">applied</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </AsyncTable>
        </TableWrap>
      </Card>

      <Card
        title="Conflicts"
        sub="captured offline but not applied — a person decides"
        flush
        style={{ marginTop: 20 }}
      >
        <Note kind="warn" style={{ margin: '0 0 12px' }}>
          Conflicting or unauthorised outcomes — the classic being a booking marked paid
          on one device and voided on another, or an action queued after the actor lost
          access — are never merged automatically. They are surfaced here for a person to
          decide, because guessing would silently lose money either way.
        </Note>
        <TableWrap minWidth={760}>
          <thead>
            <tr>
              <th>Action</th>
              <th>Actor</th>
              <th>Device time</th>
              <th>Server time</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <AsyncTable
            isLoading={isLoading}
            error={error}
            isEmpty={needsReview.length === 0}
            onRetry={() => mutate()}
            empty={
              <EmptyState
                icon="✅"
                title="No conflicts"
                message="Every replayed action was authorised and applied cleanly."
              />
            }
          >
            <tbody>
              {needsReview.map((r) => (
                <tr key={`${r.serverTime}-${r.id}`}>
                  <td className="t1">{humanize(r.action)}</td>
                  <td className="t2">{r.actor?.name ?? r.actor?.phone ?? 'system'}</td>
                  <td className="t2">{r.deviceTime ? formatDateTime(r.deviceTime) : '—'}</td>
                  <td className="t2">{formatDateTime(r.serverTime)}</td>
                  <td>
                    <Pill tone="danger">needs review</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </AsyncTable>
        </TableWrap>
      </Card>

      <Card title="How replay decides" style={{ marginTop: 20 }}>
        <div className="flex flex-col gap-5" style={{ gap: 10 }}>
          <Note kind="info">
            A replayed action is re-authorised against the permissions you had at the
            time it was taken, not the ones you have now. Losing access mid-trip does not
            retroactively approve what was queued.
          </Note>
          <Note kind="info">
            Repeats are harmless: an action that already landed is recognised and logged
            rather than applied twice.
          </Note>
        </div>
      </Card>
    </>
  );
}
