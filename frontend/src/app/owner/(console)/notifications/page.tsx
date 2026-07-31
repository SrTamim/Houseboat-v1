'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import {
  PageHead,
  Card,
  FilterBar,
  Seg,
  Note,
  TableWrap,
  AsyncTable,
} from '@/components/owner/ui';
import { Pill } from '@/components/owner/Pill';
import { formatDateTime, humanize } from '@/lib/owner/format';

interface Notification {
  id: string;
  event: string;
  channel: string;
  delivered: boolean;
  at: string;
}

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed', label: 'Failed' },
];

export default function OwnerNotificationsPage() {
  const [filter, setFilter] = useState('');

  // Notifications are per account, not per boat — this is your own inbox.
  const { data, error, isLoading, mutate } = useSWR<Notification[]>(
    '/me/notifications',
    fetcher,
    { revalidateOnFocus: false },
  );

  const rows = (data ?? []).filter((n) => {
    if (filter === 'delivered') return n.delivered;
    if (filter === 'failed') return !n.delivered;
    return true;
  });

  return (
    <>
      <PageHead
        title="Notifications"
        desc="Everything the platform has sent you, and whether it actually arrived. A failed delivery is worth chasing — it usually means a wrong number."
      />

      <FilterBar>
        <Seg
          options={FILTERS.map((f) => ({
            ...f,
            count:
              f.value === 'delivered'
                ? (data ?? []).filter((n) => n.delivered).length
                : f.value === 'failed'
                  ? (data ?? []).filter((n) => !n.delivered).length
                  : data?.length,
          }))}
          value={filter}
          onChange={setFilter}
        />
      </FilterBar>

      <Card flush>
        <TableWrap minWidth={620}>
          <thead>
            <tr>
              <th>Event</th>
              <th>Channel</th>
              <th>When</th>
              <th>Delivered</th>
            </tr>
          </thead>
          <AsyncTable
            isLoading={isLoading}
            error={error}
            isEmpty={rows.length === 0}
            onRetry={() => mutate()}
            empty={
              <div className="state">
                <div className="ic">🔔</div>
                <h4>Nothing sent yet</h4>
                <p>
                  Booking confirmations, payment reminders and low-stock alerts land here.
                </p>
              </div>
            }
          >
            <tbody>
              {rows.map((n) => (
                <tr key={n.id}>
                  <td className="t1">{humanize(n.event)}</td>
                  <td>
                    <Pill tone={n.channel === 'sms' ? 'blue' : 'mut'}>{n.channel}</Pill>
                  </td>
                  <td className="t2">{formatDateTime(n.at)}</td>
                  <td>
                    <Pill tone={n.delivered ? 'ok' : 'danger'}>
                      {n.delivered ? 'delivered' : 'failed'}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </AsyncTable>
        </TableWrap>
      </Card>

      <Note kind="info" style={{ marginTop: 16 }}>
        This is your own inbox rather than the boat&apos;s — it follows your account across
        every boat you operate. Which events reach you is set on the Settings page, per
        boat.
      </Note>
    </>
  );
}
