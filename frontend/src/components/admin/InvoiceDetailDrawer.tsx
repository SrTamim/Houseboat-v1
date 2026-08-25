'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { Drawer } from './Drawer';
import { Pill } from './Pill';
import { ErrorState } from './ui';
import { formatBDT } from '@/lib/admin/money';
import {
  wireStatusLabel,
  wireStatusTone,
  shortId,
  maskToken,
  channelLabel,
  channelTone,
} from '@/lib/admin/invoices';
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

interface InvoiceDetail {
  id: string;
  status: string;
  roomTotal: string;
  discountAmount: string;
  priceShown: string;
  displayTotal: string;
  amountPaid: string;
  amountOverpaid: string;
  commission: string;
  dueToBoat: string;
  payoutBatchId: string | null;
  houseboat: { id: string; name: string; slug: string };
  customer: { id: string; name: string | null; phone: string; email: string | null };
  booking: {
    id: string;
    type: string;
    channel: string;
    status: string;
    createdAt: string;
    departure: {
      id: string;
      startDate: string;
      endDate: string | null;
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
    rescheduleHistory: {
      id: string;
      oldPrice: string | null;
      newPrice: string | null;
      reason: string | null;
      changedAt: string;
      prevDeparture: { startDate: string };
      toDeparture: { startDate: string };
      changedByAccount: { id: string; name: string | null };
    }[];
  };
  payments: {
    id: string;
    amount: string;
    method: string;
    gatewayToken: string | null;
    paidAt: string | null;
  }[];
}

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

export function InvoiceDetailDrawer({
  invoiceId,
  onClose,
}: {
  /** null = closed. */
  invoiceId: string | null;
  onClose: () => void;
}) {
  const { data: inv, error, isLoading } = useSWR<InvoiceDetail>(
    invoiceId ? `/platform/finance/invoices/${invoiceId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const balance = inv
    ? formatBDT(String(Number(inv.displayTotal) - Number(inv.amountPaid)))
    : null;

  return (
    <Drawer
      open={invoiceId !== null}
      onClose={onClose}
      wide
      title={inv ? `${shortId(inv.id, 'INV')} · invoice` : 'Invoice'}
      footer={<button className={BTN_O} onClick={onClose}>Close</button>}
    >
      {error ? (
        <ErrorState error={error} />
      ) : isLoading || !inv ? (
        <p className={`p-4 ${TD_T2}`}>Loading invoice…</p>
      ) : (
        <>
          <div className={DSEC}>
            <h4 className={DSEC_H4}>Status</h4>
            <div className="mb-3 flex flex-wrap gap-2">
              <Pill tone={wireStatusTone(inv.status)}>{wireStatusLabel(inv.status)}</Pill>
              <Pill tone={channelTone(inv.booking.channel)}>
                {channelLabel(inv.booking.channel)}
              </Pill>
              <Pill tone="mut">{inv.booking.type}</Pill>
            </div>
          </div>

          <div className={DSEC}>
            <h4 className={DSEC_H4}>Bill breakdown</h4>
            <dl className={KV}>
              <dt className={KV_DT}>Room total</dt>
              <dd className={KV_DD}><Money value={inv.roomTotal} /></dd>
              <dt className={KV_DT}>Discount</dt>
              <dd className={KV_DD}><Money value={inv.discountAmount} /></dd>
              <dt className={KV_DT}>Price shown</dt>
              <dd className={KV_DD}><Money value={inv.priceShown} /></dd>
              <dt className={KV_DT}>Total</dt>
              <dd className={KV_DD}><Money value={inv.displayTotal} /></dd>
              <dt className={KV_DT}>Paid</dt>
              <dd className={KV_DD}><Money value={inv.amountPaid} /></dd>
              <dt className={KV_DT}>Balance</dt>
              <dd className={KV_DD}><span className={UNIT}>৳</span> {balance}</dd>
              {Number(inv.amountOverpaid) > 0 ? (
                <>
                  <dt className={KV_DT}>Overpaid</dt>
                  <dd className={KV_DD}><Money value={inv.amountOverpaid} /></dd>
                </>
              ) : null}
              <dt className={KV_DT}>Commission</dt>
              <dd className={KV_DD}><Money value={inv.commission} /></dd>
              <dt className={KV_DT}>Due to boat</dt>
              <dd className={KV_DD}><Money value={inv.dueToBoat} /></dd>
            </dl>
          </div>

          <div className={DSEC}>
            <h4 className={DSEC_H4}>Boat &amp; customer</h4>
            <dl className={KV}>
              <dt className={KV_DT}>Boat</dt>
              <dd className={KV_DD}>{inv.houseboat.name}</dd>
              <dt className={KV_DT}>Customer</dt>
              <dd className={KV_DD}>{inv.customer.name ?? '—'}</dd>
              <dt className={KV_DT}>Phone</dt>
              <dd className={KV_DD}>{inv.customer.phone}</dd>
              {inv.customer.email ? (
                <>
                  <dt className={KV_DT}>Email</dt>
                  <dd className={KV_DD}>{inv.customer.email}</dd>
                </>
              ) : null}
              <dt className={KV_DT}>Booking</dt>
              <dd className={KV_DD}>{shortId(inv.booking.id, 'BK')}</dd>
              <dt className={KV_DT}>Departure</dt>
              <dd className={KV_DD}>{formatDate(inv.booking.departure.startDate)}</dd>
            </dl>
          </div>

          <div className={DSEC}>
            <h4 className={DSEC_H4}>Cabins</h4>
            {inv.booking.cabins.length ? (
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
                  {inv.booking.cabins.map((c) => (
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
            <h4 className={DSEC_H4}>Payments</h4>
            {inv.payments.length ? (
              <table className={MINI}>
                <thead>
                  <tr>
                    <th className={MINI_TH}>Amount</th>
                    <th className={MINI_TH}>Method</th>
                    <th className={MINI_TH}>Gateway / txn</th>
                    <th className={MINI_TH}>When</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.payments.map((p) => (
                    <tr key={p.id}>
                      <td className={`${MINI_TD} ${MINI_TD_T1}`}><Money value={p.amount} /></td>
                      <td className={MINI_TD}>{p.method}</td>
                      <td className={MINI_TD}>{maskToken(p.gatewayToken)}</td>
                      <td className={MINI_TD}>{p.paidAt ? formatDate(p.paidAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className={TD_T2}>No payments recorded.</p>
            )}
          </div>

          {inv.booking.rescheduleHistory.length ? (
            <div className={DSEC}>
              <h4 className={DSEC_H4}>Reschedule history</h4>
              <table className={MINI}>
                <thead>
                  <tr>
                    <th className={MINI_TH}>From</th>
                    <th className={MINI_TH}>To</th>
                    <th className={MINI_TH}>By</th>
                    <th className={MINI_TH}>When</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.booking.rescheduleHistory.map((h) => (
                    <tr key={h.id}>
                      <td className={MINI_TD}>{formatDate(h.prevDeparture.startDate)}</td>
                      <td className={`${MINI_TD} ${MINI_TD_T1}`}>{formatDate(h.toDeparture.startDate)}</td>
                      <td className={MINI_TD}>{h.changedByAccount.name ?? '—'}</td>
                      <td className={MINI_TD}>{formatDate(h.changedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </Drawer>
  );
}
