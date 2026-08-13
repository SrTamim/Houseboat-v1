'use client';

import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { formatDateTime, humanize } from '@/lib/owner/format';
import type { NotificationItem } from '@/lib/customer/types';

const ICON: Record<string, string> = {
  booking: '🎟️',
  payment_due: '💳',
  refund_sent: '💰',
  offer: '🏷️',
};

/** Notifications inbox (design: haorboat-account-notifications.html). */
export default function NotificationsPage() {
  const { data, error, isLoading, mutate } = useSWR<NotificationItem[]>(
    '/me/notifications',
    fetcher,
    { revalidateOnFocus: false },
  );

  const notifications = data ?? [];
  const unread = notifications.filter((n) => !n.readAt);

  const markRead = async (id: string) => {
    // Optimistic: flip readAt locally, then confirm with the server.
    mutate(
      notifications.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
      false,
    );
    try {
      await api.post(`/me/notifications/${id}/read`, {});
    } catch {
      mutate();
    }
  };

  const markAll = async () => {
    await Promise.all(unread.map((n) => api.post(`/me/notifications/${n.id}/read`, {})));
    mutate();
  };

  return (
    <>
      <div className="page-head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div>
          <h1>Notifications</h1>
          <p>{unread.length} unread</p>
        </div>
        {unread.length > 0 ? (
          <button
            className="btn btn-o btn-sm"
            style={{ marginLeft: 'auto' }}
            onClick={markAll}
          >
            Mark all read
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : error ? (
        <p style={{ color: 'var(--muted)' }}>Couldn’t load notifications.</p>
      ) : notifications.length === 0 ? (
        <div className="card empty" style={{ textAlign: 'center' }}>
          <div className="em">🔔</div>
          <h3>No notifications</h3>
          <p>Booking updates and offers will appear here.</p>
        </div>
      ) : (
        notifications.map((n) => (
          <div
            className={`note${n.readAt ? '' : ' unread'}`}
            key={n.id}
            onClick={() => !n.readAt && markRead(n.id)}
            style={{ position: 'relative', cursor: n.readAt ? 'default' : 'pointer' }}
          >
            <span className="unread-dot" />
            <span className="ic">{ICON[n.event] ?? '🔔'}</span>
            <div>
              <div className="t">{humanize(n.event)}</div>
              <div className="d">
                Sent via {n.channel} · {formatDateTime(n.at)}
              </div>
            </div>
          </div>
        ))
      )}
    </>
  );
}
