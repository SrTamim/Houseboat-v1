'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import type { SearchBoat } from '@/lib/customer/types';
import { BoatCard } from '@/components/customer/BoatCard';

/**
 * Featured houseboats grid. Pulls the public search rollup (which carries the
 * price-from / rating / AC summary the card needs — plain /houseboats does not)
 * and shows the first eight.
 */
export function FeaturedBoats() {
  const { data, error, isLoading } = useSWR<SearchBoat[]>(
    '/houseboats/search',
    fetcher,
    { revalidateOnFocus: false },
  );

  const boats = (data ?? []).slice(0, 8);

  return (
    <section className="feat-sec">
      <div className="wrap">
        <div className="row-head">
          <div>
            <span className="eb">Popular cruises</span>
            <h2>Featured houseboats</h2>
          </div>
          <Link className="more" href="/search">
            View all <span>→</span>
          </Link>
        </div>

        {isLoading ? (
          <div className="grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card" style={{ minHeight: 320, opacity: 0.5 }} />
            ))}
          </div>
        ) : error ? (
          <p style={{ color: 'var(--muted)' }}>
            Couldn’t load boats right now. Please try again.
          </p>
        ) : boats.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No houseboats listed yet.</p>
        ) : (
          <div className="grid">
            {boats.map((b) => (
              <BoatCard key={b.id} boat={b} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
