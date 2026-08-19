'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { money, formatDate, apiErrorMessage } from '@/lib/owner/format';
import type { BookingDetail } from '@/lib/customer/types';

const CARD = 'overflow-hidden rounded-2xl border border-hair bg-raise-1 shadow-e1';
const CARD_HEAD =
  'flex items-center justify-between gap-3 border-b border-hair px-5 py-4';

/**
 * Booking detail + actions (design: haorboat-account-booking.html). Reads
 * GET /booking/:id, and drives cancel (POST /:id/cancel) and pay-balance
 * (gateway initiate on the existing invoice). Reschedule is intentionally not
 * offered here — it is an owner-side action with no customer self-serve path.
 *
 * Cancel copy branches on WHO cancelled: if the departure itself was cancelled
 * (`departure.status === 'cancelled'`) the host cancelled the trip and the
 * customer is entitled to a refund; otherwise a self-cancel forfeits payment and
 * we warn accordingly.
 */
export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, isLoading, mutate } = useSWR<BookingDetail>(
    id ? `/booking/${id}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const [busy, setBusy] = useState<'cancel' | 'pay' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (isLoading) return <p className="text-muted">Loading…</p>;
  if (error || !data)
    return (
      <div className={`${CARD} px-6 py-12 text-center`}>
        <div className="text-4xl">🧭</div>
        <h3 className="mt-3 font-display text-lg font-semibold text-ink">
          Booking not found
        </h3>
        <Link
          href="/account/trips"
          className="mt-4 inline-flex items-center justify-center rounded bg-blue px-5 py-2.5 text-sm font-bold text-white shadow-e1 hover:bg-blue-600"
        >
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
  const boat = data.departure?.package?.houseboat;
  const hostCancelled = data.departure?.status === 'cancelled';

  const cancel = async () => {
    const warning = hostCancelled
      ? 'The host cancelled this trip. Cancel your booking to release it? Any refund you are owed will be added to your wallet.'
      : 'Cancel this booking? You may not get your money back — cancelling may forfeit what you have paid. This cannot be undone.';
    if (!confirm(warning)) return;
    setBusy('cancel');
    setMsg(null);
    try {
      await api.post(`/booking/${id}/cancel`, {});
      await mutate();
      setMsg(
        hostCancelled
          ? 'Booking cancelled. Your refund is now in your wallet.'
          : 'Booking cancelled.',
      );
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
      {/* breadcrumb + header */}
      <div>
        <Link href="/account/trips" className="text-[13px] text-muted hover:text-ink">
          ‹ My trips
        </Link>
        <h1 className="mt-1 font-display text-[26px] font-semibold tracking-[-0.02em] text-ink">
          {boat?.name ?? `Booking ${data.id.slice(0, 8).toUpperCase()}`}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {data.type === 'group' ? 'Full-boat buyout' : 'Cabin booking'}
          {route ? ` · ${route.name}${route.region ? ` · ${route.region}` : ''}` : ''}{' '}
          · <span className="font-semibold text-bodytext">
            {data.id.slice(0, 8).toUpperCase()}
          </span>
        </p>
      </div>

      {/* host-cancelled banner */}
      {hostCancelled && data.status !== 'cancelled' ? (
        <div className="flex items-start gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--amber)_30%,transparent)] bg-[color-mix(in_srgb,var(--amber)_8%,transparent)] px-5 py-4">
          <span className="text-xl">⚑</span>
          <div>
            <div className="font-display text-[15px] font-semibold text-ink">
              The host cancelled this trip
            </div>
            <p className="mt-1 text-[13px] text-bodytext">
              {data.departure?.cancelReason
                ? `Reason: ${data.departure.cancelReason}. `
                : ''}
              You&rsquo;re entitled to a refund. Cancel the booking below and your
              refund lands in your wallet.
            </p>
          </div>
        </div>
      ) : null}

      {data.status === 'cancelled' ? (
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--danger)_6%,transparent)] px-5 py-4 text-sm text-bodytext">
          This booking is cancelled.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1fr_320px] lg:items-start">
        {/* main column */}
        <div className="grid gap-[18px]">
          {/* facts */}
          <div className={`${CARD} p-5`}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Fact
                label="Departure"
                value={data.departure ? formatDate(data.departure.startDate) : '—'}
              />
              <Fact label="Status" value={data.status} plain />
              <Fact label="Paid" value={money(paid)} />
              <Fact
                label="Due at boarding"
                value={due > 0 ? money(due) : 'Nothing due'}
                amber={due > 0}
              />
            </div>
          </div>

          {/* cabins & charges */}
          <div className={CARD}>
            <div className={CARD_HEAD}>
              <h3 className="font-display text-[15px] font-semibold text-ink">
                Cabins &amp; charges
              </h3>
            </div>
            <div className="p-5">
              {data.cabins.length === 0 ? (
                <p className="text-muted">Full-boat buyout — all cabins.</p>
              ) : (
                data.cabins.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between border-b border-hair-2 py-2.5 text-sm last:border-b-0"
                  >
                    <span className="text-bodytext">
                      <b className="text-ink">{c.cabin?.name ?? 'Cabin'}</b> ({c.adults}A
                      {c.children ? ` + ${c.children}C` : ''})
                      {c.isOpenSeat ? ' · shared' : ''}
                    </span>
                    <b className="text-ink">{money(c.roomPrice)}</b>
                  </div>
                ))
              )}
              {inv && Number(inv.discountAmount) > 0 ? (
                <div className="flex items-center justify-between py-2.5 text-sm text-muted">
                  <span>Discount</span>
                  <span>− {money(inv.discountAmount)}</span>
                </div>
              ) : null}
              <div className="mt-1 flex items-center justify-between border-t border-hair pt-3 text-[15px] font-bold text-ink">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* sidebar column */}
        <div className="grid gap-[18px]">
          {/* balance / pay */}
          {data.status !== 'cancelled' && due > 0 ? (
            <div className={CARD}>
              <div className={CARD_HEAD}>
                <h3 className="font-display text-[15px] font-semibold text-ink">
                  Balance due
                </h3>
                <span className="inline-flex rounded-full bg-chip px-2.5 py-1 text-[11px] font-bold text-muted">
                  at boarding
                </span>
              </div>
              <div className="p-5">
                <div className="text-[11px] font-bold uppercase tracking-[0.04em] text-muted">
                  Remaining balance
                </div>
                <div className="mt-1 font-display text-[28px] font-black text-amber-700">
                  {money(due)}
                </div>
                <div className="mt-1 text-xs text-muted">
                  of {money(total)} grand total
                </div>
                <button
                  onClick={payBalance}
                  disabled={busy !== null}
                  className="mt-4 inline-flex w-full items-center justify-center rounded bg-blue px-5 py-2.5 text-sm font-bold text-white shadow-e1 transition-colors hover:bg-blue-600 disabled:opacity-60"
                >
                  {busy === 'pay' ? 'Starting…' : `Pay ${money(due)} now`}
                </button>
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--amber)_30%,transparent)] bg-[color-mix(in_srgb,var(--amber)_8%,transparent)] px-3 py-2.5 text-[12.5px] text-bodytext">
                  <span>💵</span>
                  <div>
                    Prefer cash? You can pay the balance to the boat manager at
                    boarding — no online payment needed.
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* manage booking */}
          {data.status !== 'cancelled' && cancellable ? (
            <div className={CARD}>
              <div className={CARD_HEAD}>
                <h3 className="font-display text-[15px] font-semibold text-ink">
                  Manage booking
                </h3>
              </div>
              <div className="grid gap-2.5 p-5">
                <button
                  onClick={cancel}
                  disabled={busy !== null}
                  className="inline-flex w-full items-center justify-center rounded border border-[color-mix(in_srgb,var(--danger)_40%,transparent)] bg-raise-1 px-5 py-2.5 text-sm font-bold text-danger shadow-e1 transition-colors hover:bg-[color-mix(in_srgb,var(--danger)_6%,transparent)] disabled:opacity-60"
                >
                  {busy === 'cancel' ? 'Cancelling…' : '✕ Cancel booking'}
                </button>
                <div className="flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--blue)_25%,transparent)] bg-[color-mix(in_srgb,var(--blue)_6%,transparent)] px-3 py-2.5 text-[12.5px] text-bodytext">
                  <span>🛡️</span>
                  <div>
                    {hostCancelled
                      ? 'The host cancelled this trip — cancelling your booking returns any refund you are owed to your wallet.'
                      : 'Cancelling may forfeit what you have paid — you may not get your money back. Check the boat’s cancellation policy before you cancel.'}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {msg ? (
        <div className="rounded-2xl border border-hair bg-raise-1 px-5 py-4 text-sm text-bodytext shadow-e1">
          {msg}
        </div>
      ) : null}
    </>
  );
}

function Fact({
  label,
  value,
  plain,
  amber,
}: {
  label: string;
  value: string;
  plain?: boolean;
  amber?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-[0.04em] text-muted">
        {label}
      </div>
      <div
        className={`mt-0.5 text-sm font-bold ${
          amber ? 'text-amber-700' : plain ? 'text-bodytext capitalize' : 'text-ink'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
