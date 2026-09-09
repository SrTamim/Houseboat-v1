'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { Drawer } from './Drawer';
import { Pill } from './Pill';
import { ErrorState } from './ui';
import { formatBDT } from '@/lib/admin/money';
import { wireStatusLabel, wireStatusTone, shortId, channelLabel, channelTone, hostCancelBadge } from '@/lib/admin/invoices';
import {
  BTN_O,
  DSEC,
  DSEC_H4,
  KV,
  KV_DD,
  KV_DT,
  MINI,
  MINI_TD,
  MINI_TD_T1,
  MINI_TH,
  TD_T2,
  UNIT,
} from './styles';

interface BookingDetail {
  id: string;
  type: string;
  channel: string;
  status: string;
  headcount: number | null;
  createdAt: string;
  customer: { id: string; name: string | null; phone: string; email: string | null };
  departure: {
    id: string;
    startDate: string;
    endDate: string | null;
    status: string;
    package: { durationLabel: string | null; houseboat: { id: string; name: string } };
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
  guests: { id: string; name: string; phone: string | null; email: string | null }[];
  invoice: {
    id: string;
    status: string;
    roomTotal: string;
    discountAmount: string;
    displayTotal: string;
    amountPaid: string;
    amountOverpaid: string;
    payments: { id: string; amount: string; method: string; paidAt: string | null }[];
  } | null;
}

const BOOKING_TONE: Record<string, 'ok' | 'warn' | 'danger' | 'mut' | 'blue'> = {
  confirmed: 'ok',
  rescheduled: 'blue',
  cancelled: 'mut',
  not_arrived: 'danger',
  completed: 'ok',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function Money({ value }: { value: string }) {
  return (
    <>
      <span className={UNIT}>৳</span> {formatBDT(value)}
    </>
  );
}

export function BookingDetailDrawer({
  bookingId,
  onClose,
}: {
  /** null = closed. */
  bookingId: string | null;
  onClose: () => void;
}) {
  const { data: b, error, isLoading } = useSWR<BookingDetail>(
    bookingId ? `/platform/ops/bookings/${bookingId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const balance = b?.invoice
    ? formatBDT(
        String(Number(b.invoice.displayTotal) - Number(b.invoice.amountPaid)),
      )
    : null;

  return (
    <Drawer
      open={bookingId !== null}
      onClose={onClose}
      wide
      title={b ? `${shortId(b.id, 'BK')} · booking` : 'Booking'}
      footer={<button className={BTN_O} onClick={onClose}>Close</button>}
    >
      {error ? (
        <ErrorState error={error} />
      ) : isLoading || !b ? (
        <p className={`p-4 ${TD_T2}`}>Loading booking…</p>
      ) : (
        <>
          <div className={DSEC}>
            <h4 className={DSEC_H4}>Status</h4>
            <div className="mb-3 flex flex-wrap gap-2">
              <Pill tone={BOOKING_TONE[b.status] ?? 'mut'}>{b.status}</Pill>
              {(() => {
                const badge = hostCancelBadge(b.departure.status);
                return badge ? <Pill tone={badge.tone}>{badge.label}</Pill> : null;
              })()}
              <Pill tone="mut">{b.type}</Pill>
              <Pill tone={channelTone(b.channel)}>{channelLabel(b.channel)}</Pill>
              {b.invoice ? (
                <Pill tone={wireStatusTone(b.invoice.status)}>
                  {wireStatusLabel(b.invoice.status)}
                </Pill>
              ) : null}
            </div>
          </div>

          <div className={DSEC}>
            <h4 className={DSEC_H4}>Trip</h4>
            <dl className={KV}>
              <dt className={KV_DT}>Boat</dt>
              <dd className={KV_DD}>{b.departure.package.houseboat.name}</dd>
              <dt className={KV_DT}>Departure</dt>
              <dd className={KV_DD}>{formatDate(b.departure.startDate)}</dd>
              {b.departure.package.durationLabel ? (
                <>
                  <dt className={KV_DT}>Duration</dt>
                  <dd className={KV_DD}>{b.departure.package.durationLabel}</dd>
                </>
              ) : null}
              <dt className={KV_DT}>Booked</dt>
              <dd className={KV_DD}>{formatDate(b.createdAt)}</dd>
            </dl>
          </div>

          <div className={DSEC}>
            <h4 className={DSEC_H4}>Customer</h4>
            <dl className={KV}>
              <dt className={KV_DT}>Name</dt>
              <dd className={KV_DD}>{b.customer.name ?? '—'}</dd>
              <dt className={KV_DT}>Phone</dt>
              <dd className={KV_DD}>{b.customer.phone}</dd>
              {b.customer.email ? (
                <>
                  <dt className={KV_DT}>Email</dt>
                  <dd className={KV_DD}>{b.customer.email}</dd>
                </>
              ) : null}
              {b.guests[0] ? (
                <>
                  <dt className={KV_DT}>Lead guest</dt>
                  <dd className={KV_DD}>{b.guests[0].name}</dd>
                </>
              ) : null}
            </dl>
          </div>

          <div className={DSEC}>
            <h4 className={DSEC_H4}>Cabins</h4>
            {b.cabins.length ? (
              <table className={MINI}>
                <thead>
                  <tr>
                    <th className={MINI_TH}>Cabin</th>
                    <th className={MINI_TH}>Adults</th>
                    <th className={MINI_TH}>Children</th>
                    <th className={MINI_TH}>Open seat</th>
                    <th className={MINI_TH}>Room price</th>
                  </tr>
                </thead>
                <tbody>
                  {b.cabins.map((c) => (
                    <tr key={c.id}>
                      <td className={`${MINI_TD} ${MINI_TD_T1}`}>{c.cabin.name}</td>
                      <td className={MINI_TD}>{c.adults}</td>
                      <td className={MINI_TD}>{c.children}</td>
                      <td className={MINI_TD}>{c.isOpenSeat ? 'Yes' : 'No'}</td>
                      <td className={MINI_TD}><Money value={c.roomPrice} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className={TD_T2}>No cabins on this booking.</p>
            )}
          </div>

          <div className={DSEC}>
            <h4 className={DSEC_H4}>Bill</h4>
            {b.invoice ? (
              <>
                <dl className={KV}>
                  <dt className={KV_DT}>Room total</dt>
                  <dd className={KV_DD}><Money value={b.invoice.roomTotal} /></dd>
                  <dt className={KV_DT}>Discount</dt>
                  <dd className={KV_DD}><Money value={b.invoice.discountAmount} /></dd>
                  <dt className={KV_DT}>Total</dt>
                  <dd className={KV_DD}><Money value={b.invoice.displayTotal} /></dd>
                  <dt className={KV_DT}>Paid</dt>
                  <dd className={KV_DD}><Money value={b.invoice.amountPaid} /></dd>
                  <dt className={KV_DT}>Balance</dt>
                  <dd className={KV_DD}>
                    <span className={UNIT}>৳</span> {balance}
                  </dd>
                  {Number(b.invoice.amountOverpaid) > 0 ? (
                    <>
                      <dt className={KV_DT}>Overpaid</dt>
                      <dd className={KV_DD}><Money value={b.invoice.amountOverpaid} /></dd>
                    </>
                  ) : null}
                </dl>
                {b.invoice.payments.length ? (
                  <table className={`mt-3 ${MINI}`}>
                    <thead>
                      <tr>
                        <th className={MINI_TH}>Payment</th>
                        <th className={MINI_TH}>Method</th>
                        <th className={MINI_TH}>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.invoice.payments.map((p) => (
                        <tr key={p.id}>
                          <td className={`${MINI_TD} ${MINI_TD_T1}`}><Money value={p.amount} /></td>
                          <td className={MINI_TD}>{p.method}</td>
                          <td className={MINI_TD}>{p.paidAt ? formatDate(p.paidAt) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </>
            ) : (
              <p className={TD_T2}>No invoice for this booking.</p>
            )}
          </div>
        </>
      )}
    </Drawer>
  );
}
