'use client';

import { useState } from 'react';
import {
  PageHead,
  Card,
  TableWrap,
  TableSkeleton,
  EmptyState,
  ErrorState,
  Select,
} from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';
import { useAdminList } from '@/lib/admin/useAdminList';
import { formatBDT } from '@/lib/admin/money';
import { wireStatusLabel, wireStatusTone, shortId } from '@/lib/admin/invoices';

interface BookingRow {
  id: string;
  type: string;
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
  const { items, error, isInitialLoading, hasMore, loadMore, mutate } =
    useAdminList<BookingRow>('/platform/ops/bookings', {
      status: status || undefined,
      limit: 25,
    });

  return (
    <>
      <PageHead
        title="Bookings"
        desc="Every booking across all boats, newest first. Money actions live in the finance queues — this is the operational view."
      />
      <div className="filterbar">
        <Select options={STATUS_OPTIONS} value={status} onChange={setStatus} />
      </div>
      <Card flush>
        {error ? (
          <ErrorState error={error} onRetry={() => mutate()} />
        ) : !isInitialLoading && items.length === 0 ? (
          <EmptyState
            title="No bookings yet"
            desc="Bookings appear here as customers check out on the public site."
          />
        ) : (
          <>
            <TableWrap minWidth={1000}>
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Boat · departure</th>
                  <th>Customer</th>
                  <th className="num">Cabins</th>
                  <th>Status</th>
                  <th>Invoice</th>
                  <th className="num">Total</th>
                  <th>Booked</th>
                </tr>
              </thead>
              {isInitialLoading ? (
                <TableSkeleton rows={6} cols={8} />
              ) : (
                <tbody>
                  {items.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <div className="t1">{shortId(b.id, 'BK')}</div>
                        <div className="t2">{b.type}</div>
                      </td>
                      <td>
                        <div className="t1">{b.departure.package.houseboat.name}</div>
                        <div className="t2">
                          {formatDate(b.departure.startDate)}
                          {b.departure.package.durationLabel
                            ? ` · ${b.departure.package.durationLabel}`
                            : ''}
                        </div>
                      </td>
                      <td>
                        <div className="t1">{b.customer.name ?? '—'}</div>
                        <div className="t2">{b.customer.phone}</div>
                      </td>
                      <td className="num">{b.cabinCount || b.headcount || '—'}</td>
                      <td>
                        <Pill tone={BOOKING_TONE[b.status] ?? 'mut'}>{b.status}</Pill>
                      </td>
                      <td>
                        {b.invoice ? (
                          <Pill tone={wireStatusTone(b.invoice.status)}>
                            {wireStatusLabel(b.invoice.status)}
                          </Pill>
                        ) : (
                          <span className="t2">—</span>
                        )}
                      </td>
                      <td className="num">
                        {b.invoice ? (
                          <>
                            <span className="u">৳</span>{' '}
                            {formatBDT(b.invoice.displayTotal)}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="t2">{formatDate(b.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              )}
            </TableWrap>
            {hasMore ? (
              <div style={{ padding: 12, textAlign: 'center' }}>
                <button className="btn btn-o btn-sm" onClick={loadMore}>
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
