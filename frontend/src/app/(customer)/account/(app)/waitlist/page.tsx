'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { formatDate } from '@/lib/owner/format';
import type { WaitlistEntry } from '@/lib/customer/types';

const BTN_B =
  'inline-flex items-center justify-center gap-1.5 rounded bg-blue px-3.5 py-2 text-[13px] font-bold text-white shadow-e1 transition-colors hover:bg-blue-600';
const BTN_O =
  'inline-flex items-center justify-center gap-1.5 rounded border border-hair bg-raise-1 px-3.5 py-2 text-[13px] font-bold text-ink shadow-e1 transition-colors hover:border-blue hover:text-blue';

/** Waitlist (design: haorboat-account-waitlist.html). Reads /booking/waitlist. */
export default function WaitlistPage() {
  const { data, error, isLoading, mutate } = useSWR<WaitlistEntry[]>(
    '/booking/waitlist',
    fetcher,
    { revalidateOnFocus: false },
  );

  const entries = data ?? [];

  const leave = async (id: string) => {
    mutate(entries.filter((e) => e.id !== id), false);
    try {
      await api.post(`/booking/waitlist/${id}/leave`, {});
    } finally {
      mutate();
    }
  };

  return (
    <>
      <div>
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.02em] text-ink">
          Waitlist
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          We&rsquo;ll text you the moment a cabin frees up on these trips.
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : error ? (
        <p className="text-muted">Couldn&rsquo;t load your waitlist.</p>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-hair bg-raise-1 px-6 py-12 text-center shadow-e1">
          <div className="text-4xl">⏳</div>
          <h3 className="mt-3 font-display text-lg font-semibold text-ink">
            You&rsquo;re not on any waitlist
          </h3>
          <p className="mx-auto mt-1.5 max-w-[40ch] text-sm text-muted">
            When a trip is fully booked, join its waitlist to get notified.
          </p>
          <Link href="/search" className={`mt-4 ${BTN_B}`}>
            Browse houseboats
          </Link>
        </div>
      ) : (
        <div className="grid gap-3.5">
          {entries.map((e) => {
            const dep = e.departure;
            const boat = dep?.package?.houseboat;
            const route = dep?.package?.route;
            const spotsOpen = dep?.availableCount ?? 0;
            // A cabin-specific entry must report on ITS cabin: the trip-wide
            // count would announce good news about a cabin this customer never
            // asked for. Falls back to the trip for older, cabin-less entries.
            const freed = e.cabinFree ?? spotsOpen > 0;
            const cabinLabel = e.cabin
              ? `${e.cabin.name}${e.cabin.deck ? ` · ${e.cabin.deck.name}` : ''}`
              : null;
            const dates =
              dep?.startDate
                ? `${formatDate(dep.startDate)}${dep.endDate ? ` → ${formatDate(dep.endDate)}` : ''}`
                : '—';
            return (
              <div
                key={e.id}
                className="overflow-hidden rounded-2xl border border-hair bg-raise-1 p-5 shadow-e1"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-[15px] font-semibold text-ink">
                      {boat?.name ?? 'Houseboat'}
                    </h3>
                    {cabinLabel ? (
                      <div className="mt-0.5 text-[12.5px] font-semibold text-muted">
                        🛏️ {cabinLabel}
                      </div>
                    ) : null}
                  </div>
                  {freed ? (
                    <span className="inline-flex shrink-0 rounded-full bg-[color-mix(in_srgb,var(--ok)_12%,transparent)] px-2.5 py-1 text-[11.5px] font-bold text-ok">
                      {cabinLabel ? '✓ Your cabin is free' : '✓ A cabin just opened'}
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 rounded-full bg-[color-mix(in_srgb,var(--amber)_12%,transparent)] px-2.5 py-1 text-[11.5px] font-bold text-amber-700">
                      {cabinLabel ? '⏳ Waiting — cabin taken' : '⏳ Waiting — trip full'}
                    </span>
                  )}
                </div>
                <div className="mt-2.5 text-[13px] text-muted">
                  📍{' '}
                  {route
                    ? `${route.name}${route.region ? ` · ${route.region}` : ''}`
                    : '—'}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <WlFact label="Trip dates" value={dates} />
                  <WlFact
                    label="Duration"
                    value={dep?.package?.durationLabel ?? '—'}
                  />
                  <WlFact label="Party size" value={`${e.partySize} guests`} plain />
                  <WlFact
                    label="Spots open now"
                    value={freed ? `${spotsOpen}` : 'None yet'}
                    ok={freed}
                  />
                </div>
                {freed ? (
                  <p className="mt-3 rounded-lg border border-[color-mix(in_srgb,var(--ok)_25%,transparent)] bg-[color-mix(in_srgb,var(--ok)_8%,transparent)] px-3 py-2 text-[12.5px] text-bodytext">
                    {cabinLabel
                      ? `${e.cabin!.name} is free right now — first to book gets it, so grab it now.`
                      : 'A place freed up on this trip — first to book gets it, so grab it now.'}
                  </p>
                ) : (
                  <p className="mt-3 text-[12.5px] text-muted">
                    {cabinLabel
                      ? `${e.cabin!.name} is taken right now. We’ll text you the moment it frees up.`
                      : 'This trip is fully booked. We’ll text you the moment a cabin frees up.'}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2.5">
                  {freed && boat ? (
                    <Link href={`/boat/${boat.slug}`} className={BTN_B}>
                      Book now &rarr;
                    </Link>
                  ) : null}
                  <span className="flex-1" />
                  <button onClick={() => leave(e.id)} className={BTN_O}>
                    Leave waitlist
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function WlFact({
  label,
  value,
  plain,
  ok,
}: {
  label: string;
  value: string;
  plain?: boolean;
  ok?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-[0.04em] text-muted">
        {label}
      </div>
      <div
        className={`mt-0.5 text-sm font-bold ${
          ok ? 'text-ok' : plain ? 'text-bodytext' : 'text-ink'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
