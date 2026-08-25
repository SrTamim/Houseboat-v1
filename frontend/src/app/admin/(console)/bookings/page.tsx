'use client';

import { useState } from 'react';
import {
  PageHead,
  Card,
  TableWrap,
  TableSkeleton,
  EmptyState,
  ErrorState,
  Search,
  Select,
} from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';
import { BookingDetailDrawer } from '@/components/admin/BookingDetailDrawer';
import { useAdminList } from '@/lib/admin/useAdminList';
import { formatBDT } from '@/lib/admin/money';
import { wireStatusLabel, wireStatusTone, shortId, channelLabel, channelTone } from '@/lib/admin/invoices';
import { BTN_O, BTN_SM, FILTERBAR, ROWACT, TD_NUM, TD_T1, TD_T2, UNIT } from '@/components/admin/styles';

interface BookingRow {
  id: string;
  type: string;
  channel: string;
  status: string;
  headcount: number | null;
  createdAt: string;
  cabinCount: number;
  customer: { id: string; name: string | null; phone: string };
  departure: {
    id: string;
    startDate: string;
    status: string;
    package: {
      durationLabel: string | null;
      houseboat: { id: string; name: string };
    };
  };
  invoice: {
    id: string;
    status: string;
    displayTotal: string;
    amountPaid: string;
  } | null;
}

const BOOKING_TONE: Record<string, 'ok' | 'warn' | 'danger' | 'mut' | 'blue'> = {
  confirmed: 'ok',
  rescheduled: 'blue',
  cancelled: 'mut',
  not_arrived: 'danger',
  completed: 'ok',
};

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rescheduled', label: 'Rescheduled' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'not_arrived', label: 'Not arrived' },
  { value: 'completed', label: 'Completed' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function Bookings() {
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const { items, error, isInitialLoading, hasMore, loadMore, mutate } =
    useAdminList<BookingRow>('/platform/ops/bookings', {
      status: status || undefined,
      q: query || undefined,
      limit: 25,
    });

  return (
    <>
      <PageHead
        title="Bookings"
        desc="Every booking across all boats, newest first. Money actions live in the finance queues — this is the operational view."
      />
      <div className={FILTERBAR}>
        <Search
          placeholder="Search customer name or phone…"
          value={query}
          onChange={setQuery}
        />
        <Select options={STATUS_OPTIONS} value={status} onChange={setStatus} />
      </div>
      <Card flush>
        {error ? (
          <ErrorState error={error} onRetry={() => mutate()} />
        ) : !isInitialLoading && items.length === 0 ? (
          <EmptyState
            title={query || status ? 'No bookings match' : 'No bookings yet'}
            desc={
              query || status
                ? 'Try a different search or status filter.'
                : 'Bookings appear here as customers check out on the public site.'
            }
          />
        ) : (
          <>
            <TableWrap minWidth={1080}>
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Boat · departure</th>
                  <th>Customer</th>
                  <th className={TD_NUM}>Cabins</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Invoice</th>
                  <th className={TD_NUM}>Total</th>
                  <th>Booked</th>
                  <th />
                </tr>
              </thead>
              {isInitialLoading ? (
                <TableSkeleton rows={6} cols={10} />
              ) : (
                <tbody>
                  {items.map((b) => (
                    <tr key={b.id} className="group">
                      <td>
                        <div className={TD_T1}>{shortId(b.id, 'BK')}</div>
                        <div className={TD_T2}>{b.type}</div>
                      </td>
                      <td>
                        <div className={TD_T1}>{b.departure.package.houseboat.name}</div>
                        <div className={TD_T2}>
                          {formatDate(b.departure.startDate)}
                          {b.departure.package.durationLabel
                            ? ` · ${b.departure.package.durationLabel}`
                            : ''}
                        </div>
                      </td>
                      <td>
                        <div className={TD_T1}>{b.customer.name ?? '—'}</div>
                        <div className={TD_T2}>{b.customer.phone}</div>
                      </td>
                      <td className={TD_NUM}>{b.cabinCount || b.headcount || '—'}</td>
                      <td>
                        <Pill tone={BOOKING_TONE[b.status] ?? 'mut'}>{b.status}</Pill>
                      </td>
                      <td>
                        <Pill tone={channelTone(b.channel)}>{channelLabel(b.channel)}</Pill>
                      </td>
                      <td>
                        {b.invoice ? (
                          <Pill tone={wireStatusTone(b.invoice.status)}>
                            {wireStatusLabel(b.invoice.status)}
                          </Pill>
                        ) : (
                          <span className={TD_T2}>—</span>
                        )}
                      </td>
                      <td className={TD_NUM}>
                        {b.invoice ? (
                          <>
                            <span className={UNIT}>৳</span>{' '}
                            {formatBDT(b.invoice.displayTotal)}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={TD_T2}>{formatDate(b.createdAt)}</td>
                      <td className={ROWACT}>
                        <button
                          className={`${BTN_O} ${BTN_SM}`}
                          onClick={() => setOpenId(b.id)}
                        >
                          Open
                        </button>
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
      <BookingDetailDrawer bookingId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
