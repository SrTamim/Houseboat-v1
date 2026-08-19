'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { formatDateTime, humanize } from '@/lib/owner/format';
import type { NotificationItem } from '@/lib/customer/types';

const ICON: Record<string, string> = {
  booking: '🎟️',
  payment_due: '💳',
  refund_sent: '💰',
  offer: '🏷️',
  waitlist: '⏳',
  cancelled: '⚑',
};

type Filter = 'all' | 'unread';

/** Notifications inbox (design: haorboat-account-notifications.html). */
export default function NotificationsPage() {
  const { data, error, isLoading, mutate } = useSWR<NotificationItem[]>(
    '/me/notifications',
    fetcher,
    { revalidateOnFocus: false },
  );
  const [filter, setFilter] = useState<Filter>('all');

  const notifications = data ?? [];
  const unread = notifications.filter((n) => !n.readAt);
  const shown = filter === 'unread' ? unread : notifications;

  const markRead = async (id: string) => {
    mutate(
      notifications.map((n) =>
        n.id === id ? { ...n, readAt: new Date().toISOString() } : n,
      ),
      false,
    );
    try {
      await api.post(`/me/notifications/${id}/read`, {});
    } catch {
      mutate();
    }
  };

  const markAll = async () => {
    mutate(
      notifications.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
      false,
    );
    await Promise.all(unread.map((n) => api.post(`/me/notifications/${n.id}/read`, {})));
    mutate();
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-display text-[26px] font-semibold tracking-[-0.02em] text-ink">
            Notifications
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Waitlist openings, payments and trip updates.{' '}
            <b className="text-ink">{unread.length} unread</b>.
          </p>
        </div>
        {unread.length > 0 ? (
          <button
            onClick={markAll}
            className="ml-auto inline-flex items-center gap-1.5 rounded border border-hair bg-raise-1 px-3.5 py-2 text-[13px] font-bold text-ink shadow-e1 transition-colors hover:border-blue hover:text-blue"
          >
            ✓ Mark all read
          </button>
        ) : null}
      </div>

      {/* filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {(['all', 'unread'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13.5px] font-semibold transition-colors ${
              filter === f
                ? 'border-blue bg-[color-mix(in_srgb,var(--blue)_10%,transparent)] text-blue'
                : 'border-hair bg-raise-1 text-bodytext hover:text-ink'
            }`}
          >
            {f === 'all' ? 'All' : 'Unread'}
            <span
              className={`grid h-5 min-w-[20px] place-items-center rounded-full px-1.5 text-[11px] font-extrabold ${
                filter === f ? 'bg-blue text-white' : 'bg-chip text-muted'
              }`}
            >
              {f === 'all' ? notifications.length : unread.length}
            </span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : error ? (
        <p className="text-muted">Couldn&rsquo;t load notifications.</p>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-hair bg-raise-1 px-6 py-12 text-center shadow-e1">
          <div className="text-4xl">🔕</div>
          <h3 className="mt-3 font-display text-lg font-semibold text-ink">
            {filter === 'unread' ? 'You’re all caught up' : 'No notifications'}
          </h3>
          <p className="mt-1.5 text-sm text-muted">
            Booking updates and offers will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-hair bg-raise-1 shadow-e1">
          {shown.map((n) => {
            const isUnread = !n.readAt;
            return (
              <div
                key={n.id}
                onClick={() => isUnread && markRead(n.id)}
                className={`relative grid grid-cols-[42px_1fr_auto] items-start gap-3.5 border-b border-hair px-5 py-4 last:border-b-0 ${
                  isUnread ? 'cursor-pointer bg-[color-mix(in_srgb,var(--blue)_4%,transparent)]' : ''
                }`}
              >
                {isUnread ? (
                  <span className="absolute left-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-amber" />
                ) : null}
                <span className="grid h-[42px] w-[42px] place-items-center rounded-xl bg-chip text-lg">
                  {ICON[n.event] ?? '🔔'}
                </span>
                <div>
                  <div className="text-[14.5px] font-bold text-ink">
                    {humanize(n.event)}
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-muted">
                    Sent via {n.channel} · {formatDateTime(n.at)}
                  </div>
                </div>
                {isUnread ? (
                  <span className="mt-1 text-[11px] font-bold text-blue">New</span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
