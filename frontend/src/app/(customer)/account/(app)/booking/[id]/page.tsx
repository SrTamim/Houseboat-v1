'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { money, formatDate, apiErrorMessage } from '@/lib/owner/format';
import type { BookingDetail } from '@/lib/customer/types';

/**
 * Booking detail + actions (design: haorboat-account-booking / -reschedule /
 * -cancel). Reads GET /booking/:id, and drives cancel (POST /:id/cancel) and
 * pay-balance (gateway initiate on the existing invoice).
 */
export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR<BookingDetail>(
    id ? `/booking/${id}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const [busy, setBusy] = useState<'cancel' | 'pay' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (isLoading) return <p style={{ color: 'var(--muted)' }}>Loading…</p>;
  if (error || !data)
    return (
      <div className="card empty" style={{ textAlign: 'center' }}>
        <div className="em">🧭</div>
        <h3>Booking not found</h3>
        <Link className="btn btn-b" href="/account/trips">
          Back to my trips
        </Link>
      </div>
    );

  const inv = data.invoice;
  const paid = inv ? Number(inv.amountPaid) : 0;
  const total = inv ? Number(inv.displayTotal) : 0;
  const due = Math.max(total - paid, 0);
  const cancellable = data.status === 'confirmed' || data.status === 'rescheduled';
  const route = data.departure?.package?.route;

  const cancel = async () => {
    if (!confirm('Cancel this booking? Any eligible refund becomes wallet credit.'))
      return;
    setBusy('cancel');
    setMsg(null);
    try {
      await api.post(`/booking/${id}/cancel`, {});
      await mutate();
      setMsg('Booking cancelled. Any refund is now in your wallet.');
    } catch (e) {
      setMsg(apiErrorMessage(e, 'Could not cancel this booking.'));
    } finally {
      setBusy(null);
    }
  };

  const payBalance = async () => {
    if (!inv) return;
    setBusy('pay');
    setMsg(null);
    try {
      const { data: initiated } = await api.post<{ gatewayPageUrl: string }>(
        '/gateway/sslcommerz/initiate',
        { invoiceId: inv.id },
      );
      window.location.assign(initiated.gatewayPageUrl);
    } catch (e) {
      setMsg(apiErrorMessage(e, 'Could not start payment.'));
      setBusy(null);
    }
  };

  return (
    <>
      <div className="page-head">
        <Link href="/account/trips" style={{ fontSize: 13, color: 'var(--muted)' }}>
          ‹ My trips
        </Link>
        <h1>Booking {data.id.slice(0, 8).toUpperCase()}</h1>
        <p>
          {data.type === 'group' ? 'Full-boat buyout' : 'Cabin booking'} ·{' '}
          {route ? `${route.name}${route.region ? ` · ${route.region}` : ''}` : ''}
        </p>
      </div>

      {data.status === 'cancelled' ? (
        <div className="note danger" style={{ marginBottom: 16 }}>
          This booking is cancelled.
        </div>
      ) : null}

      <div className="card">
        <div className="facts">
          <div className="fact">
            <div className="l">Departure</div>
            <div className="v">
              {data.departure ? formatDate(data.departure.startDate) : '—'}
            </div>
          </div>
          <div className="fact">
            <div className="l">Status</div>
            <div className="v pln">{data.status}</div>
          </div>
          <div className="fact">
            <div className="l">Paid</div>
            <div className="v">৳ {money(paid)}</div>
          </div>
          <div className="fact">
            <div className="l">Due at boarding</div>
            <div className="v" style={{ color: due > 0 ? 'var(--amber)' : undefined }}>
              {due > 0 ? `৳ ${money(due)}` : 'Nothing due'}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="ch">
          <h3>Cabins</h3>
        </div>
        {data.cabins.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>Full-boat buyout — all cabins.</p>
        ) : (
          data.cabins.map((c) => (
            <div className="brow" key={c.id}>
              <span>
                {c.cabin?.name ?? 'Cabin'} ({c.adults}A
                {c.children ? ` + ${c.children}C` : ''})
                {c.isOpenSeat ? ' · shared' : ''}
              </span>
              <b>৳ {money(c.roomPrice)}</b>
            </div>
          ))
        )}
        {inv && Number(inv.discountAmount) > 0 ? (
          <div className="brow muted">
            <span>Discount</span>
            <span>− ৳ {money(inv.discountAmount)}</span>
          </div>
        ) : null}
        <div className="brow total">
          <span>Total</span>
          <span>৳ {money(total)}</span>
        </div>
      </div>

      {msg ? (
        <div className="note" style={{ margin: '14px 0' }}>
          {msg}
        </div>
      ) : null}

      {data.status !== 'cancelled' ? (
        <div className="cta" style={{ gap: 10 }}>
          {due > 0 ? (
            <button className="btn btn-b" disabled={busy !== null} onClick={payBalance}>
              {busy === 'pay' ? 'Starting…' : `Pay balance · ৳ ${money(due)}`}
            </button>
          ) : null}
          {cancellable ? (
            <button className="btn btn-o" disabled={busy !== null} onClick={cancel}>
              {busy === 'cancel' ? 'Cancelling…' : 'Cancel booking'}
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
