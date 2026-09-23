'use client';

import { useCallback, useEffect, useState } from 'react';
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
import {
  listPending,
  offlineQueueSupported,
  type QueuedIntent,
} from '@/lib/owner/offline-queue';
import { flushQueue, isOnline } from '@/lib/owner/sync-runner';

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
 * Three halves:
 *  - "Pending on this device" reads the local IndexedDB capture queue
 *    (lib/owner/offline-queue.ts) and flushes it via the runner
 *    (lib/owner/sync-runner.ts → POST /sync/replay). This is the device-side
 *    queue; console pages enqueue eligible actions into it when offline.
 *  - "Replayed actions" / "Conflicts" read the audit trail (syncedOffline set),
 *    i.e. what the server MADE of the intents once they arrived.
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

  // ── Device capture queue ──────────────────────────────────────────────────
  const supported = offlineQueueSupported();
  const [pending, setPending] = useState<QueuedIntent[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const refreshPending = useCallback(async () => {
    if (!supported) return;
    setPending(await listPending());
  }, [supported]);

  useEffect(() => {
    void refreshPending();
    // Re-read when the tab regains focus or the device comes back online, so the
    // pending list reflects actions captured on other console pages.
    const onFocus = () => void refreshPending();
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
    };
  }, [refreshPending]);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const out = await flushQueue();
      if (out.skipped) {
        setSyncMsg(isOnline() ? 'Nothing to sync.' : 'Still offline — try again when connected.');
      } else {
        setSyncMsg(
          `Synced ${out.cleared} of ${out.sent}` +
            (out.kept ? ` · ${out.kept} need review below` : ''),
        );
        await mutate(); // refresh the replayed/conflicts cards
      }
    } catch {
      setSyncMsg('Sync failed — check your connection and try again.');
    } finally {
      await refreshPending();
      setSyncing(false);
    }
  }, [mutate, refreshPending]);

  return (
    <>
      <PageHead
        title="Offline sync"
        desc="What happened while the boat had no signal, and what the server made of it once it reconnected."
      />

      {!supported ? (
        <Note kind="info" style={{ marginBottom: 20 }}>
          This browser can’t store an offline queue, so actions here always go straight to
          the server. The cards below show anything that arrived through the replay endpoint.
        </Note>
      ) : (
        <Card
          title="Pending on this device"
          sub="captured offline, waiting to sync"
          flush
          style={{ marginBottom: 20 }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div className="text-[13px] text-muted">
              {pending.length === 0
                ? 'Nothing waiting — all actions on this device have reached the server.'
                : `${pending.length} action${pending.length === 1 ? '' : 's'} waiting to reach the server.`}
              {syncMsg ? <span className="ml-2 font-medium text-ink">{syncMsg}</span> : null}
            </div>
            <button
              type="button"
              onClick={syncNow}
              disabled={syncing || pending.length === 0}
              className="rounded border border-hair bg-field px-3.5 py-1.5 text-[13px] font-semibold text-ink transition-[border-color] hover:border-blue disabled:cursor-not-allowed disabled:opacity-50"
            >
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
          </div>
          {pending.length > 0 && (
            <TableWrap minWidth={560}>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Captured</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <tr key={p.intentId}>
                    <td className="t1">{humanize(p.action)}</td>
                    <td className="t2" data-label="Captured">{formatDateTime(p.deviceTime)}</td>
                    <td data-label="Status">
                      <Pill tone="mut">pending</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
      )}

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
                  <td className="t2" data-label="Actor">{r.actor?.name ?? r.actor?.phone ?? 'system'}</td>
                  <td className="t2" data-label="Device time">{r.deviceTime ? formatDateTime(r.deviceTime) : '—'}</td>
                  <td className="t2" data-label="Server time">{formatDateTime(r.serverTime)}</td>
                  <td data-label="Outcome">
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
                  <td className="t2" data-label="Actor">{r.actor?.name ?? r.actor?.phone ?? 'system'}</td>
                  <td className="t2" data-label="Device time">{r.deviceTime ? formatDateTime(r.deviceTime) : '—'}</td>
                  <td className="t2" data-label="Server time">{formatDateTime(r.serverTime)}</td>
                  <td data-label="Outcome">
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
