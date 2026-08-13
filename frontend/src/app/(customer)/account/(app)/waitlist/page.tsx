'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { formatDate } from '@/lib/owner/format';
import type { WaitlistEntry } from '@/lib/customer/types';

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
      <div className="page-head">
        <h1>Waitlist</h1>
        <p>We’ll text you the moment a cabin frees up on these trips.</p>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : error ? (
        <p style={{ color: 'var(--muted)' }}>Couldn’t load your waitlist.</p>
      ) : entries.length === 0 ? (
        <div className="card empty" style={{ textAlign: 'center' }}>
          <div className="em">⏳</div>
          <h3>You’re not on any waitlist</h3>
          <p>When a trip is fully booked, join its waitlist to get notified.</p>
          <Link className="btn btn-b" href="/search">
            Browse houseboats
          </Link>
        </div>
      ) : (
        entries.map((e) => {
          const boat = e.departure?.package?.houseboat;
          const route = e.departure?.package?.route;
          const freed = (e.departure?.availableCount ?? 0) > 0;
          return (
            <div className="card" key={e.id} style={{ marginBottom: 14 }}>
              <div className="ch">
                <h3>{boat?.name ?? 'Houseboat'}</h3>
                {freed ? (
                  <span className="pill ok">✓ A cabin is free!</span>
                ) : (
                  <span className="pill mut">Waiting</span>
                )}
              </div>
              <div className="route" style={{ marginBottom: 10 }}>
                📍 {route ? `${route.name}${route.region ? ` · ${route.region}` : ''}` : '—'}
              </div>
              <div className="facts">
                <div className="fact">
                  <div className="l">Departure</div>
                  <div className="v">
                    {e.departure ? formatDate(e.departure.startDate) : '—'}
                  </div>
                </div>
                <div className="fact">
                  <div className="l">Party size</div>
                  <div className="v pln">{e.partySize} guests</div>
                </div>
              </div>
              <div className="cta" style={{ marginTop: 12 }}>
                {freed && boat ? (
                  <Link className="btn btn-sm btn-b" href={`/boat/${boat.slug}`}>
                    Book now →
                  </Link>
                ) : null}
                <span className="sp" />
                <button className="btn btn-sm btn-o" onClick={() => leave(e.id)}>
                  Leave waitlist
                </button>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
