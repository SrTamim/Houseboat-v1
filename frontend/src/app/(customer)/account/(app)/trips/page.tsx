'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { money, formatDate } from '@/lib/owner/format';
import { photoFor } from '@/lib/customer/boat-card';
import type { TripListItem } from '@/lib/customer/types';

type Filter = 'all' | 'upcoming' | 'completed' | 'cancelled';

/** Status pill: [tailwind bg/text classes, label]. */
const STATUS_PILL: Record<string, [string, string]> = {
  confirmed: ['bg-[color-mix(in_srgb,var(--ok)_12%,transparent)] text-ok', '✓ Confirmed'],
  rescheduled: ['bg-[color-mix(in_srgb,var(--blue)_12%,transparent)] text-blue', '↻ Rescheduled'],
  completed: ['bg-[color-mix(in_srgb,var(--blue)_12%,transparent)] text-blue', '✓ Completed'],
  cancelled: ['bg-chip text-muted', '✕ Cancelled'],
  not_arrived: ['bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-danger', '⚑ No-show'],
};

/** Bucket a booking into the filter tabs by status + departure date. */
function bucketOf(t: TripListItem): Exclude<Filter, 'all'> {
  if (t.status === 'cancelled') return 'cancelled';
  if (t.status === 'completed') return 'completed';
  const start = t.departure ? new Date(t.departure.startDate) : null;
  if (start && start.getTime() < Date.now()) return 'completed';
  return 'upcoming';
}

const BTN_B =
  'inline-flex items-center justify-center gap-1.5 rounded bg-blue px-3.5 py-2 text-[13px] font-bold text-white shadow-e1 transition-colors hover:bg-blue-600';
const BTN_O =
  'inline-flex items-center justify-center gap-1.5 rounded border border-hair bg-raise-1 px-3.5 py-2 text-[13px] font-bold text-ink shadow-e1 transition-colors hover:border-blue hover:text-blue';

export default function TripsPage() {
  const { data, error, isLoading } = useSWR<TripListItem[]>('/booking', fetcher, {
    revalidateOnFocus: false,
  });
  const [filter, setFilter] = useState<Filter>('all');

  const trips = data ?? [];
  const counts: Record<Filter, number> = {
    all: trips.length,
    upcoming: trips.filter((t) => bucketOf(t) === 'upcoming').length,
    completed: trips.filter((t) => bucketOf(t) === 'completed').length,
    cancelled: trips.filter((t) => bucketOf(t) === 'cancelled').length,
  };
  const shown = filter === 'all' ? trips : trips.filter((t) => bucketOf(t) === filter);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-display text-[26px] font-semibold tracking-[-0.02em] text-ink">
            My trips
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Everything you&rsquo;ve booked &mdash; upcoming, past and cancelled.
          </p>
        </div>
        <Link href="/search" className={`ml-auto ${BTN_B}`}>
          ＋ Book a new trip
        </Link>
      </div>

      {/* filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {(['all', 'upcoming', 'completed', 'cancelled'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13.5px] font-semibold transition-colors ${
              filter === f
                ? 'border-blue bg-[color-mix(in_srgb,var(--blue)_10%,transparent)] text-blue'
                : 'border-hair bg-raise-1 text-bodytext hover:text-ink'
            }`}
          >
            {f[0].toUpperCase() + f.slice(1)}
            <span
              className={`grid h-5 min-w-[20px] place-items-center rounded-full px-1.5 text-[11px] font-extrabold ${
                filter === f ? 'bg-blue text-white' : 'bg-chip text-muted'
              }`}
            >
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted">Loading your trips…</p>
      ) : error ? (
        <p className="text-muted">Couldn&rsquo;t load your trips.</p>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-hair bg-raise-1 px-6 py-12 text-center shadow-e1">
          <div className="text-4xl">🧭</div>
          <h3 className="mt-3 font-display text-lg font-semibold text-ink">
            Nothing here yet
          </h3>
          <p className="mx-auto mt-1.5 max-w-[40ch] text-sm text-muted">
            No trips match this filter. Ready for your next haor cruise?
          </p>
          <Link href="/search" className={`mt-4 ${BTN_B}`}>
            Browse houseboats
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {shown.map((t) => {
            const paid = t.invoice ? Number(t.invoice.amountPaid) : 0;
            const total = t.invoice ? Number(t.invoice.displayTotal) : 0;
            const due = Math.max(total - paid, 0);
            const pill = STATUS_PILL[t.status] ?? ['bg-chip text-muted', t.status];
            const showPay = due > 0 && t.status === 'confirmed';
            return (
              <article
                key={t.id}
                className="grid grid-cols-1 overflow-hidden rounded-2xl border border-hair bg-raise-1 shadow-e1 sm:grid-cols-[220px_1fr]"
              >
                <div className="relative min-h-[160px]">
                  <img
                    alt="Trip"
                    src={photoFor(t.id)}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute left-3 top-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11.5px] font-bold ${pill[0]}`}
                    >
                      {pill[1]}
                    </span>
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="font-display text-[17px] font-semibold text-ink">
                    Booking {t.id.slice(0, 8).toUpperCase()}
                  </h3>
                  <div className="mt-1 text-[13px] text-muted">
                    {t.referenceName ? `📍 ${t.referenceName} · ` : ''}
                    <span className="font-semibold text-bodytext">
                      {t.type === 'group' ? 'Full boat' : 'Cabin booking'}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Fact label="Dates" value={t.departure ? formatDate(t.departure.startDate) : '—'} />
                    <Fact label="Guests" value={`${t.headcount ?? '—'} guests`} plain />
                    <Fact label="Paid" value={money(paid)} />
                    {due > 0 ? (
                      <Fact label="Due at boarding" value={money(due)} amber />
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2.5">
                    {due > 0 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--amber)_12%,transparent)] px-3 py-1.5 text-[13px] font-semibold text-amber-700">
                        ⏳ {money(due)} due at boarding
                      </span>
                    ) : (
                      <span className="text-[13px] text-muted">
                        {t.status === 'completed' ? 'Trip completed' : 'Fully paid'}
                      </span>
                    )}
                    <span className="flex-1" />
                    <Link href={`/account/booking/${t.id}`} className={BTN_O}>
                      View details
                    </Link>
                    {showPay ? (
                      <Link href={`/account/booking/${t.id}`} className={BTN_B}>
                        Pay balance
                      </Link>
                    ) : null}
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
          amber ? 'text-amber-700' : plain ? 'text-bodytext' : 'text-ink'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
