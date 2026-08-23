'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import {
  PageHead,
  Note,
  Card,
  TableWrap,
  TableSkeleton,
  EmptyState,
  ErrorState,
} from '@/components/admin/ui';
import { Pill, Tag } from '@/components/admin/Pill';
import { useAdminList } from '@/lib/admin/useAdminList';
import { apiErrorMessage } from '@/lib/admin/api-error';
import { BTN_B, BTN_O, BTN_SM, FILTERBAR, ROWACT, SEG, SEG_B, SEG_B_ON, TD_T1, TD_T2 } from '@/components/admin/styles';

interface NotificationRow {
  id: string;
  event: string;
  channel: 'sms' | 'email';
  delivered: boolean;
  hasPayload: boolean;
  at: string;
  account: { id: string; name: string | null; phone: string };
}

const SEGMENTS = [
  { key: 'all', label: 'All' },
  { key: 'failed', label: 'Undelivered' },
  { key: 'sms', label: 'SMS' },
  { key: 'email', label: 'Email' },
] as const;

export default function Notifications() {
  const [segment, setSegment] = useState<(typeof SEGMENTS)[number]['key']>('all');

  const { items, error, isInitialLoading, hasMore, loadMore, mutate } =
    useAdminList<NotificationRow>('/platform/ops/notifications', {
      delivered: segment === 'failed' ? 'false' : undefined,
      channel: segment === 'sms' || segment === 'email' ? segment : undefined,
      limit: 25,
    });

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function resend(row: NotificationRow) {
    if (busyId) return;
    setBusyId(row.id);
    setActionError(null);
    try {
      await api.post(`/platform/ops/notifications/${row.id}/resend`);
      await mutate();
    } catch (e) {
      setActionError(apiErrorMessage(e, 'Could not resend this notification.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHead
        title="Notifications"
        desc="Platform delivery monitor. Undelivered SMS/email — especially e-tickets and waitlist blasts — surface here; resend replays the stored message and records a fresh attempt."
      />
      {actionError ? (
        <div className="mb-3" role="alert"><Note kind="danger" icon="⚠">{actionError}</Note></div>
      ) : null}
      <div className={FILTERBAR}>
        <div className={SEG}>
          {SEGMENTS.map((s) => (
            <button
              key={s.key}
              className={segment === s.key ? `${SEG_B} ${SEG_B_ON}` : SEG_B}
              onClick={() => setSegment(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <Card flush>
        {error ? (
          <ErrorState error={error} onRetry={() => mutate()} />
        ) : !isInitialLoading && items.length === 0 ? (
          <EmptyState
            title="No notifications"
            desc="Messages appear here as the system sends SMS and email."
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Recipient</th>
                  <th>Channel</th>
                  <th>Status</th>
                  <th>At</th>
                  <th />
                </tr>
              </thead>
              {isInitialLoading ? (
                <TableSkeleton rows={5} cols={6} />
              ) : (
                <tbody>
                  {items.map((n) => (
                    <tr key={n.id} className="group">
                      <td className={TD_T1}>{n.event}</td>
                      <td>
                        <div className={TD_T1}>{n.account.name ?? '—'}</div>
                        <div className={TD_T2}>{n.account.phone}</div>
                      </td>
                      <td><Tag>{n.channel.toUpperCase()}</Tag></td>
                      <td>
                        <Pill tone={n.delivered ? 'ok' : 'danger'}>
                          {n.delivered ? 'delivered' : 'undelivered'}
                        </Pill>
                      </td>
                      <td className={TD_T2}>
                        {new Date(n.at).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className={ROWACT}>
                        {!n.delivered && n.hasPayload ? (
                          <button
                            className={`${BTN_B} ${BTN_SM}`}
                            disabled={busyId === n.id}
                            onClick={() => resend(n)}
                          >
                            {busyId === n.id ? '…' : 'Resend'}
                          </button>
                        ) : !n.delivered ? (
                          <span className={TD_T2} title="Row predates stored payloads">
                            no payload
                          </span>
                        ) : null}
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
