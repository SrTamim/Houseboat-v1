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
import { BookingStatusPill, HostCancelBadge, Pill } from '@/components/owner/Pill';
import {
  BTN_B,
  BTN_O,
  BTN_SM,
  INVOICE_PRINT,
  INV_BAND_META,
  INV_EMPTY,
  INV_FOOT,
  INV_GRAND,
  INV_HEAD,
  INV_ID,
  INV_ITEMS,
  INV_LOGO,
  INV_LOGO_PH,
  INV_NAME,
  INV_NEG,
  INV_NO,
  INV_PARTIES,
  INV_PLAT,
  INV_ROW,
  INV_STATUS,
  INV_STATUS_TONE,
  INV_SUB,
  INV_TAG,
  INV_TOTALS,
  INV_TRIP,
  INV_DUE,
} from '@/components/owner/styles';
import { Drawer } from '@/components/owner/Drawer';
import { InvoiceBill } from '@/components/owner/Bill';
import { money, formatDate, maskPhone, humanize, initials, channelLabel } from '@/lib/owner/format';

interface OwnerBooking {
  id: string;
  type: string;
  channel: string;
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
    payments: { method: string; amount: string }[];
  } | null;
}

/** The full bill waterfall, as returned by the invoices endpoint. */
interface InvoiceDetail {
  id: string;
  roomTotal: string;
  discountAmount: string;
  displayTotal: string;
  commission: string;
  dueToBoat: string;
  amountPaid: string;
}

/** Turn a date / month / year selection into a [from, to] departure-date range. */
function dateRange(date: string, month: string, year: string): { from?: string; to?: string } {
  if (date) return { from: date, to: date };
  if (month) {
    // month is "YYYY-MM"
    const [y, m] = month.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
  }
  if (year) return { from: `${year}-01-01`, to: `${year}-12-31` };
  return {};
}

const CURRENT_YEAR = new Date().getUTCFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

export default function OwnerBookingsPage() {
  const { boatId, boat } = useActiveBoat();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [date, setDate] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [open, setOpen] = useState<OwnerBooking | null>(null);

  const { data: counts } = useSWR<Record<string, number>>(
    `/houseboats/${boatId}/bookings/counts`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const range = dateRange(date, month, year);
  const { items, error, isLoading, isInitialLoading, hasMore, loadMore, mutate } =
    useOwnerList<OwnerBooking>(`/houseboats/${boatId}/bookings`, {
      status,
      q,
      ...(range.from ? { from: range.from } : {}),
      ...(range.to ? { to: range.to } : {}),
    });

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

  // Boat logo for the printed invoice header. Lives on the boat profile, not the
  // /me/boats switcher payload, so fetch it from /manage. A booking-only member
  // without `assets:view` gets 403 → data stays undefined → monogram fallback.
  const { data: boatInfo } = useSWR<{ logoUrl: string | null }>(
    open ? `/houseboats/${boatId}/manage` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const logoUrl = boatInfo?.logoUrl ?? null;

  const options = [
    { value: '', label: 'All', count: counts?.all },
    { value: 'confirmed', label: 'Confirmed', count: counts?.confirmed },
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
        <input
          type="date"
          aria-label="Filter by departure date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setMonth('');
            setYear('');
          }}
        />
        <input
          type="month"
          aria-label="Filter by month"
          value={month}
          onChange={(e) => {
            setMonth(e.target.value);
            setDate('');
            setYear('');
          }}
        />
        <select
          aria-label="Filter by year"
          value={year}
          onChange={(e) => {
            setYear(e.target.value);
            setDate('');
            setMonth('');
          }}
        >
          <option value="">Any year</option>
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
        {date || month || year ? (
          <button
            type="button"
            className={`${BTN_O} ${BTN_SM}`}
            onClick={() => {
              setDate('');
              setMonth('');
              setYear('');
            }}
          >
            Clear dates
          </button>
        ) : null}
      </FilterBar>

      <Card flush>
        <TableWrap minWidth={980}>
          <thead>
            <tr>
              <th>Guest</th>
              <th>Departure</th>
              <th>Cabins</th>
              <th>Type</th>
              <th>Source</th>
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
              <div className="px-6 py-11 text-center text-muted">
                <div className="mb-2.5 text-[26px]">🎟️</div>
                <h4 className="mb-1.5 text-[15px] text-ink">No bookings</h4>
                <p className="mx-auto max-w-[46ch] text-[13px] leading-[1.55]">
                  Nothing matches this filter. Bookings arrive from the website, the
                  counter, or an accepted quote.
                </p>
              </div>
            }
          >
            <tbody>
              {items.map((b) => {
                const lead = b.guests[0];
                return (
                  <tr key={b.id}>
                    <td>
                      <div className="t1">{lead?.name ?? b.customer.name ?? 'Guest'}</div>
                      <div className="t2">{maskPhone(lead?.phone ?? b.customer.phone)}</div>
                    </td>
                    <td data-label="Departure">
                      <div className="t1">{formatDate(b.departure.startDate)}</div>
                      <div className="t2">
                        {b.departure.package.durationLabel ?? '—'} ·{' '}
                        {b.departure.package.route.name}
                      </div>
                    </td>
                    <td data-label="Cabins">
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
                    <td>
                      <Pill tone={b.channel === 'pos' ? 'amb' : 'blue'}>
                        {channelLabel(b.channel)}
                      </Pill>
                    </td>
                    <td className="num" data-label="Pays">{money(b.invoice?.displayTotal ?? 0)}</td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        <BookingStatusPill status={b.status} />
                        <HostCancelBadge departureStatus={b.departure.status} />
                      </div>
                    </td>
                    <td>
                      <div className="rowact">
                        <button className={`${BTN_O} ${BTN_SM}`} onClick={() => setOpen(b)}>
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
          <>
            <button className={BTN_O} onClick={() => setOpen(null)}>
              Close
            </button>
            <button className={BTN_B} onClick={() => window.print()}>
              Print invoice
            </button>
          </>
        }
      >
        {open ? (
          <div className="flex flex-col gap-4">
            {/* On-screen detail — hidden when printing so only the modern
                invoice template below reaches paper. */}
            <div className="flex flex-col gap-4 print:hidden">
            <div className="flex flex-wrap gap-2">
              <BookingStatusPill status={open.status} />
              <HostCancelBadge departureStatus={open.departure.status} />
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
                ['Booked via', channelLabel(open.channel)],
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
                    [
                      'Customer due',
                      money(
                        Math.max(
                          0,
                          Number(open.invoice.displayTotal) -
                            Number(open.invoice.amountPaid),
                        ),
                      ),
                    ],
                  ]}
                />
              </div>
            ) : (
              <div className="flex items-start gap-2.5 rounded border border-[color-mix(in_srgb,var(--warn)_20%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-[15px] py-3 text-[13px] font-medium leading-[1.5] text-warn">
                <span className="flex-none text-[15px] leading-[1.3]">⚠</span>
                <span>This booking has no invoice.</span>
              </div>
            )}
            </div>

            {/* Customer-facing copy — hidden on screen, the only thing that
                prints. Owner-only figures (commission / payout) are
                deliberately excluded. */}
            {(() => {
              const guestName = open.guests[0]?.name ?? open.customer.name ?? '—';
              const phone = open.guests[0]?.phone ?? open.customer.phone;
              const trip = open.departure.package.durationLabel ?? '—';
              const departure = formatDate(open.departure.startDate);
              const invNo = open.invoice
                ? `INV-${open.invoice.id.slice(-6).toUpperCase()}`
                : 'INV-------';

              const roomTotal = invoiceDetail?.roomTotal ?? open.invoice?.displayTotal;
              const discount = invoiceDetail?.discountAmount ?? '0';
              const total = invoiceDetail?.displayTotal ?? open.invoice?.displayTotal;
              const paid = invoiceDetail?.amountPaid ?? open.invoice?.amountPaid;
              const hasInvoice = total != null && paid != null;
              const balanceDue = hasInvoice ? Number(total) - Number(paid) : 0;
              const tone =
                balanceDue <= 0 ? 'paid' : Number(paid) > 0 ? 'partial' : 'due';
              const statusLabel = open.invoice
                ? humanize(open.invoice.status)
                : 'Unpaid';

              return (
                <div className={INVOICE_PRINT}>
                  <div className={INV_HEAD}>
                    <div className={INV_ID}>
                      {logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className={INV_LOGO} src={logoUrl} alt="" />
                      ) : (
                        <span className={`${INV_LOGO} ${INV_LOGO_PH}`}>
                          {initials(boat.name)}
                        </span>
                      )}
                      <div>
                        <div className={INV_NAME}>{boat.name}</div>
                        <div className={INV_TAG}>Invoice</div>
                      </div>
                    </div>
                    <div className={INV_BAND_META}>
                      <div className={INV_NO}>{invNo}</div>
                      <div>Issued {formatDate(new Date())}</div>
                    </div>
                  </div>

                  <div className={INV_PARTIES}>
                    <div>
                      <h5>Billed to</h5>
                      <strong>{guestName}</strong>
                      <div>{phone}</div>
                    </div>
                    <div className={INV_TRIP}>
                      {hasInvoice ? (
                        <span className={`${INV_STATUS} ${INV_STATUS_TONE[tone as 'paid' | 'partial' | 'due']}`}>
                          {statusLabel}
                        </span>
                      ) : null}
                      <div>{open.departure.package.route.name}</div>
                      <div>{trip}</div>
                      <div>Departure {departure}</div>
                    </div>
                  </div>

                  {hasInvoice ? (
                    <>
                      <table className={INV_ITEMS}>
                        <thead>
                          <tr>
                            <th>Description</th>
                            <th className="inv-c">Guests</th>
                            <th className="num">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {open.cabins.map((c) => (
                            <tr key={c.id}>
                              <td>
                                <strong>Cabin {c.cabin.name}</strong>
                                <div className={INV_SUB}>
                                  {trip} · Departure {departure}
                                </div>
                              </td>
                              <td className="inv-c">{c.occupancy}</td>
                              <td className="num">{money(c.roomPrice)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div className={INV_TOTALS}>
                        <div className={INV_ROW}>
                          <span>Subtotal</span>
                          <span>{money(roomTotal!)}</span>
                        </div>
                        {Number(discount) > 0 ? (
                          <div className={`${INV_ROW} ${INV_NEG}`}>
                            <span>Coupon</span>
                            <span>−{money(discount)}</span>
                          </div>
                        ) : null}
                        <div className={`${INV_ROW} ${INV_GRAND}`}>
                          <span>Total</span>
                          <span>{money(total!)}</span>
                        </div>
                        <div className={INV_ROW}>
                          <span>Paid</span>
                          <span>{money(paid!)}</span>
                        </div>
                        <div className={`${INV_ROW} ${INV_DUE}`}>
                          <span>Balance due</span>
                          <span>{money(balanceDue)}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className={INV_EMPTY}>No invoice issued.</div>
                  )}

                  <div className={INV_FOOT}>
                    <span>Thank you for booking with {boat.name}.</span>
                    <span className={INV_PLAT}>⚓ HaorBoat</span>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
