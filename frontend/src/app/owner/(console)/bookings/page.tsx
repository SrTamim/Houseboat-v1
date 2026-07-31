'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import { useOwnerList } from '@/lib/owner/useOwnerList';
import {
  PageHead,
  Card,
  FilterBar,
  Seg,
  Search,
  TableWrap,
  AsyncTable,
  LoadMore,
  Kv,
} from '@/components/owner/ui';
import { BookingStatusPill, Pill } from '@/components/owner/Pill';
import { Drawer } from '@/components/owner/Drawer';
import { InvoiceBill } from '@/components/owner/Bill';
import { money, formatDate, maskPhone, humanize } from '@/lib/owner/format';

interface OwnerBooking {
  id: string;
  type: string;
  status: string;
  headcount: number | null;
  referenceName: string | null;
  createdAt: string;
  customer: { id: string; name: string | null; phone: string };
  bookedByAccount: { id: string; name: string | null };
  departure: {
    id: string;
    startDate: string;
    endDate: string | null;
    status: string;
    package: { durationLabel: string | null; route: { name: string } };
  };
  cabins: {
    id: string;
    adults: number;
    children: number;
    occupancy: number;
    roomPrice: string;
    isOpenSeat: boolean;
    cabin: { id: string; name: string };
  }[];
  guests: { name: string; phone: string | null }[];
  invoice: {
    id: string;
    status: string;
    displayTotal: string;
    amountPaid: string;
    dueToBoat: string;
    payoutBatchId: string | null;
    payments: { method: string; verifiedBy: string | null; amount: string }[];
  } | null;
}

/** The full bill waterfall, as returned by the invoices endpoint. */
interface InvoiceDetail {
  id: string;
  roomTotal: string;
  gatewayFee: string;
  priceShown: string;
  discountAmount: string;
  displayTotal: string;
  commission: string;
  dueToBoat: string;
  amountPaid: string;
}

export default function OwnerBookingsPage() {
  const { boatId } = useActiveBoat();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<OwnerBooking | null>(null);

  const { data: counts } = useSWR<Record<string, number>>(
    `/houseboats/${boatId}/bookings/counts`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const { items, error, isLoading, isInitialLoading, hasMore, loadMore, mutate } =
    useOwnerList<OwnerBooking>(`/houseboats/${boatId}/bookings`, { status, q });

  // Full invoice detail for the drawer. The list payload carries a summary; the
  // bill breakdown needs every step of the waterfall, which only the invoices
  // endpoint returns.
  const { data: invoicePage } = useSWR<{ items: InvoiceDetail[] }>(
    open?.invoice ? `/houseboats/${boatId}/invoices?limit=200` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const invoiceDetail =
    invoicePage?.items.find((i) => i.id === open?.invoice?.id) ?? null;

  const options = [
    { value: '', label: 'All', count: counts?.all },
    { value: 'confirmed', label: 'Confirmed', count: counts?.confirmed },
    { value: 'rescheduled', label: 'Rescheduled', count: counts?.rescheduled },
    { value: 'cancelled', label: 'Cancelled', count: counts?.cancelled },
    { value: 'not_arrived', label: 'Not arrived', count: counts?.not_arrived },
    { value: 'completed', label: 'Completed', count: counts?.completed },
  ];

  return (
    <>
      <PageHead
        title="Bookings"
        desc="Every booking on this boat, whichever way it came in — the website, a counter sale, or a quote you priced."
      />

      <FilterBar>
        <Seg options={options} value={status} onChange={setStatus} />
        <Search placeholder="Search guest, phone…" value={q} onChange={setQ} />
      </FilterBar>

      <Card flush>
        <TableWrap minWidth={900}>
          <thead>
            <tr>
              <th>Guest</th>
              <th>Departure</th>
              <th>Cabins</th>
              <th>Type</th>
              <th className="num">Pays</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <AsyncTable
            isLoading={isInitialLoading}
            error={error}
            isEmpty={items.length === 0}
            onRetry={() => mutate()}
            empty={
              <div className="state">
                <div className="ic">🎟️</div>
                <h4>No bookings</h4>
                <p>
                  Nothing matches this filter. Bookings arrive from the website, the
                  counter, or an accepted quote.
                </p>
              </div>
            }
          >
            <tbody>
              {items.map((b) => {
                const lead = b.guests[0];
                const unverifiedCash = b.invoice?.payments.some(
                  (p) => p.method === 'cash' && !p.verifiedBy,
                );
                return (
                  <tr key={b.id}>
                    <td>
                      <div className="t1">
                        {lead?.name ?? b.customer.name ?? 'Guest'}{' '}
                        {b.bookedByAccount.id !== b.customer.id ? (
                          <span className="tag">POS</span>
                        ) : null}
                      </div>
                      <div className="t2">{maskPhone(lead?.phone ?? b.customer.phone)}</div>
                    </td>
                    <td>
                      <div className="t1">{formatDate(b.departure.startDate)}</div>
                      <div className="t2">
                        {b.departure.package.durationLabel ?? '—'} ·{' '}
                        {b.departure.package.route.name}
                      </div>
                    </td>
                    <td>
                      <div className="t1">
                        {b.cabins.map((c) => c.cabin.name).join(', ') || '—'}
                      </div>
                      <div className="t2">
                        {b.cabins.reduce((n, c) => n + c.occupancy, 0)} guests
                      </div>
                    </td>
                    <td>
                      <Pill tone={b.type === 'group' ? 'amb' : 'blue'}>{b.type}</Pill>
                    </td>
                    <td className="num">{money(b.invoice?.displayTotal ?? 0)}</td>
                    <td>
                      {unverifiedCash ? (
                        <Pill tone="warn">cash unverified</Pill>
                      ) : (
                        <BookingStatusPill status={b.status} />
                      )}
                    </td>
                    <td>
                      <div className="rowact">
                        <button className="btn btn-sm btn-o" onClick={() => setOpen(b)}>
                          Invoice
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </AsyncTable>
        </TableWrap>
        <LoadMore hasMore={hasMore} isLoading={isLoading} onClick={loadMore} />
      </Card>

      <Drawer
        open={open !== null}
        title="Booking"
        onClose={() => setOpen(null)}
        footer={
          <button className="btn btn-o" onClick={() => setOpen(null)}>
            Close
          </button>
        }
      >
        {open ? (
          <div className="stack" style={{ gap: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <BookingStatusPill status={open.status} />
              <Pill tone={open.type === 'group' ? 'amb' : 'blue'}>{open.type}</Pill>
              {open.invoice?.payoutBatchId ? <Pill tone="lock">in payout</Pill> : null}
            </div>

            <Kv
              rows={[
                ['Departure', formatDate(open.departure.startDate)],
                ['Trip', open.departure.package.durationLabel ?? '—'],
                ['Route', open.departure.package.route.name],
                [
                  'Cabins',
                  open.cabins.map((c) => `${c.cabin.name} (${c.occupancy}p)`).join(', ') ||
                    '—',
                ],
                ['Lead guest', open.guests[0]?.name ?? open.customer.name ?? '—'],
                ['Phone', open.guests[0]?.phone ?? open.customer.phone],
                ['Booked by', open.bookedByAccount.name ?? '—'],
                ['Reference', open.referenceName ?? '—'],
                ['Booked on', formatDate(open.createdAt)],
              ]}
            />

            {invoiceDetail ? (
              <div>
                <h4
                  style={{
                    fontSize: 12,
                    textTransform: 'uppercase',
                    letterSpacing: '.05em',
                    color: 'var(--muted)',
                    marginBottom: 10,
                  }}
                >
                  Bill breakdown
                </h4>
                <InvoiceBill invoice={invoiceDetail} />
              </div>
            ) : open.invoice ? (
              <div>
                <h4
                  style={{
                    fontSize: 12,
                    textTransform: 'uppercase',
                    letterSpacing: '.05em',
                    color: 'var(--muted)',
                    marginBottom: 10,
                  }}
                >
                  Invoice
                </h4>
                <Kv
                  rows={[
                    ['Status', humanize(open.invoice.status)],
                    ['Customer pays', money(open.invoice.displayTotal)],
                    ['Paid so far', money(open.invoice.amountPaid)],
                    ['You receive', money(open.invoice.dueToBoat)],
                  ]}
                />
              </div>
            ) : (
              <div className="note warn">
                <span className="ic">⚠</span>
                <span>This booking has no invoice.</span>
              </div>
            )}
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
