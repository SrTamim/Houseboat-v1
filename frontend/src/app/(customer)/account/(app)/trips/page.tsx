'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { money, formatDate } from '@/lib/owner/format';
import type { TripListItem } from '@/lib/customer/types';

type Filter = 'all' | 'upcoming' | 'completed' | 'cancelled';

const STATUS_PILL: Record<string, [string, string]> = {
  confirmed: ['ok', '✓ Confirmed'],
  rescheduled: ['blue', '↻ Rescheduled'],
  completed: ['blue', '✓ Completed'],
  cancelled: ['mut', '✕ Cancelled'],
  not_arrived: ['danger', '⚑ No-show'],
};

/** Bucket a booking into the filter tabs by status + departure date. */
function bucketOf(t: TripListItem): Exclude<Filter, 'all'> {
  if (t.status === 'cancelled') return 'cancelled';
  if (t.status === 'completed') return 'completed';
  const start = t.departure ? new Date(t.departure.startDate) : null;
  if (start && start.getTime() < Date.now()) return 'completed';
  return 'upcoming';
}

export default function TripsPage() {
  const { data, error, isLoading } = useSWR<TripListItem[]>('/booking', fetcher, {
    revalidateOnFocus: false,
  });
  const [filter, setFilter] = useState<Filter>('all');

  const trips = data ?? [];
  const shown = filter === 'all' ? trips : trips.filter((t) => bucketOf(t) === filter);

  return (
    <>
      <div className="page-head">
        <h1>My trips</h1>
        <p>Your bookings, vouchers and boarding balances.</p>
      </div>

      <div className="seg" style={{ marginBottom: 18 }}>
        {(['all', 'upcoming', 'completed', 'cancelled'] as Filter[]).map((f) => (
          <button
            key={f}
            className={`seg-b${filter === f ? ' on' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--muted)' }}>Loading your trips…</p>
      ) : error ? (
        <p style={{ color: 'var(--muted)' }}>Couldn’t load your trips.</p>
      ) : shown.length === 0 ? (
        <div className="empty" style={{ display: 'block' }}>
          <div className="em">🧭</div>
          <h3>Nothing here yet</h3>
          <p>No trips match this filter. Ready for your next haor cruise?</p>
          <Link className="btn btn-b" href="/search">
            Browse houseboats
          </Link>
        </div>
      ) : (
        <div className="trips">
          {shown.map((t) => {
            const paid = t.invoice ? Number(t.invoice.amountPaid) : 0;
            const total = t.invoice ? Number(t.invoice.displayTotal) : 0;
            const due = Math.max(total - paid, 0);
            const pill = STATUS_PILL[t.status] ?? ['mut', t.status];
            return (
              <article className="trip" key={t.id}>
                <div className="ph">
                  <img
                    alt="Trip"
                    src="https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=320&q=60"
                  />
                  <span className="st">
                    <span className={`pill ${pill[0]}`}>{pill[1]}</span>
                  </span>
                </div>
                <div className="bd">
                  <div className="toprow">
                    <div>
                      <h3>Booking {t.id.slice(0, 8).toUpperCase()}</h3>
                      <div className="route">
                        {t.referenceName ? `📍 ${t.referenceName} · ` : ''}
                        <span className="ref">
                          {t.type === 'group' ? 'Full boat' : 'Cabin booking'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="facts">
                    <div className="fact">
                      <div className="l">Dates</div>
                      <div className="v">
                        {t.departure ? formatDate(t.departure.startDate) : '—'}
                      </div>
                    </div>
                    <div className="fact">
                      <div className="l">Guests</div>
                      <div className="v pln">{t.headcount ?? '—'} guests</div>
                    </div>
                    <div className="fact">
                      <div className="l">Paid</div>
                      <div className="v">৳ {money(paid)}</div>
                    </div>
                    {due > 0 ? (
                      <div className="fact">
                        <div className="l">Due at boarding</div>
                        <div className="v" style={{ color: 'var(--amber)' }}>
                          ৳ {money(due)}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="cta">
                    {due > 0 ? (
                      <span className="due-note">⏳ ৳ {money(due)} due at boarding</span>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                        {t.status === 'completed' ? 'Trip completed' : 'Fully paid'}
                      </span>
                    )}
                    <span className="sp" />
                    <Link className="btn btn-sm btn-o" href={`/account/booking/${t.id}`}>
                      View details
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
