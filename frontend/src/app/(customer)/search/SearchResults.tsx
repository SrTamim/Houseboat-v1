'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import type { SearchBoat } from '@/lib/customer/types';
import { BoatCard } from '@/components/customer/BoatCard';

const PAGE_SIZE = 9;

type Ac = 'ac' | 'nonac' | 'both';
type Sort = 'recommended' | 'price_asc' | 'price_desc' | 'rating';

/** Build the /houseboats/search query string from the active filters. */
function buildApiQuery(p: {
  route?: string;
  ac?: Ac;
  maxPrice?: number;
  guests?: number;
  date?: string;
  sort?: Sort;
}): string {
  const q = new URLSearchParams();
  if (p.route) q.set('route', p.route);
  if (p.ac && p.ac !== 'both') q.set('ac', p.ac);
  if (p.maxPrice) q.set('maxPrice', String(p.maxPrice));
  if (p.guests) q.set('guests', String(p.guests));
  if (p.date) q.set('date', p.date);
  if (p.sort && p.sort !== 'recommended') q.set('sort', p.sort);
  return q.toString();
}

export function SearchResults() {
  const router = useRouter();
  const params = useSearchParams();

  const route = params.get('route') ?? undefined;
  const ac = (params.get('ac') as Ac) ?? 'both';
  const guests = params.get('guests') ? Number(params.get('guests')) : undefined;
  const date = params.get('date') ?? undefined;
  const [maxPrice, setMaxPrice] = useState<number>(
    params.get('maxPrice') ? Number(params.get('maxPrice')) : 6000,
  );
  const [sort, setSort] = useState<Sort>('recommended');
  const [page, setPage] = useState(1);

  // Filters that hit the API drive the SWR key; changing them refetches.
  const apiQuery = useMemo(
    () =>
      buildApiQuery({
        route,
        ac,
        guests,
        date,
        maxPrice: maxPrice < 6000 ? maxPrice : undefined,
        sort,
      }),
    [route, ac, guests, date, maxPrice, sort],
  );

  const { data, error, isLoading } = useSWR<SearchBoat[]>(
    `/houseboats/search${apiQuery ? `?${apiQuery}` : ''}`,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  const boats = data ?? [];
  const pageCount = Math.max(1, Math.ceil(boats.length / PAGE_SIZE));
  const pageBoats = boats.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const setUrl = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null) next.delete(k);
      else next.set(k, v);
    }
    router.push(`/search${next.toString() ? `?${next}` : ''}`);
    setPage(1);
  };

  return (
    <>
      {/* sticky search bar */}
      <section className="searchbar">
        <div className="wrap">
          <div className="sform">
            <div className="field act">
              <label>📍 Destination</label>
              <div className="val">{route ?? 'All haors'}</div>
            </div>
            <div className="field">
              <label>📅 Departure</label>
              <div className="val">{date ?? 'Any date'}</div>
            </div>
            <div className="field">
              <label>👤 Guests</label>
              <div className="val">
                {guests ? `${guests} ${guests === 1 ? 'guest' : 'guests'}` : 'Any size'}
              </div>
            </div>
            <div className="seg" role="group" aria-label="Cabin type">
              {(['ac', 'nonac', 'both'] as Ac[]).map((a) => (
                <button
                  key={a}
                  className={`seg-b${ac === a ? ' on' : ''}`}
                  onClick={() => setUrl({ ac: a === 'both' ? null : a })}
                >
                  {a === 'ac' ? 'AC' : a === 'nonac' ? 'Non-AC' : 'Both'}
                </button>
              ))}
            </div>
            <div className="go">
              <button className="btn btn-b">🔍 Search</button>
            </div>
          </div>
        </div>
      </section>

      <section className="listing">
        <div className="wrap">
          {/* toolbar: count + active filter pills + sort */}
          <div className="toolbar">
            <span className="tb-count">
              <b>{boats.length}</b> boat{boats.length === 1 ? '' : 's'}
              {route ? ` · ${route}` : ''}
            </span>
            {route ? (
              <span className="fpill">
                {route}
                <button aria-label="Remove" onClick={() => setUrl({ route: null })}>
                  ✕
                </button>
              </span>
            ) : null}
            {ac !== 'both' ? (
              <span className="fpill">
                {ac === 'ac' ? 'AC cabins' : 'Non-AC'}
                <button aria-label="Remove" onClick={() => setUrl({ ac: null })}>
                  ✕
                </button>
              </span>
            ) : null}
            {maxPrice < 6000 ? (
              <span className="fpill">
                Under ৳{maxPrice.toLocaleString('en-US')}
                <button aria-label="Remove" onClick={() => setMaxPrice(6000)}>
                  ✕
                </button>
              </span>
            ) : null}
            {(route || ac !== 'both' || maxPrice < 6000) && (
              <button
                className="fclear"
                onClick={() => {
                  setMaxPrice(6000);
                  router.push('/search');
                }}
              >
                Clear
              </button>
            )}
            <div className="tb-right">
              <select
                className="select"
                aria-label="Sort by"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
              >
                <option value="recommended">Sort: Recommended</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="rating">Top rated</option>
              </select>
            </div>
          </div>

          {/* filters sidebar */}
          <aside className="filters">
            <div className="fgroup">
              <h4>Cabin type</h4>
              {(['ac', 'nonac', 'both'] as Ac[]).map((a) => (
                <label className="fopt radio" key={a}>
                  <input
                    type="radio"
                    name="ac"
                    checked={ac === a}
                    onChange={() => setUrl({ ac: a === 'both' ? null : a })}
                  />
                  <span className="box" />{' '}
                  {a === 'ac' ? 'AC only' : a === 'nonac' ? 'Non-AC only' : 'Both'}
                </label>
              ))}
            </div>
            <div className="fgroup">
              <h4>Price / person / cabin</h4>
              <div className="price-range">
                <input
                  type="range"
                  min={1500}
                  max={6000}
                  step={100}
                  value={maxPrice}
                  onChange={(e) => {
                    setMaxPrice(Number(e.target.value));
                    setPage(1);
                  }}
                />
                <div className="price-vals">
                  <span>৳1,500</span>
                  <span>৳{maxPrice.toLocaleString('en-US')}</span>
                </div>
              </div>
            </div>
            <div className="fgroup">
              <h4>Rating</h4>
              <label className="fopt radio">
                <input
                  type="radio"
                  name="rate"
                  checked={sort === 'rating'}
                  onChange={() => setSort('rating')}
                />
                <span className="box" />{' '}
                <span className="stars-f">
                  <i>★</i> Top rated first
                </span>
              </label>
              <label className="fopt radio">
                <input
                  type="radio"
                  name="rate"
                  checked={sort !== 'rating'}
                  onChange={() => setSort('recommended')}
                />
                <span className="box" /> Any rating
              </label>
            </div>
          </aside>

          {/* results */}
          <div className="results">
            {isLoading && boats.length === 0 ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card" style={{ minHeight: 320, opacity: 0.5 }} />
              ))
            ) : error ? (
              <p style={{ color: 'var(--muted)' }}>Couldn’t load results.</p>
            ) : pageBoats.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>
                No boats match these filters. Try widening your search.
              </p>
            ) : (
              pageBoats.map((b) => <BoatCard key={b.id} boat={b} />)
            )}
          </div>

          {pageCount > 1 && (
            <nav className="pager" aria-label="Pagination">
              <a
                className={page === 1 ? 'dis' : ''}
                onClick={() => page > 1 && setPage(page - 1)}
              >
                ‹ Prev
              </a>
              {Array.from({ length: pageCount }).map((_, i) => (
                <a
                  key={i}
                  className={page === i + 1 ? 'on' : ''}
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </a>
              ))}
              <a
                className={page === pageCount ? 'dis' : ''}
                onClick={() => page < pageCount && setPage(page + 1)}
              >
                Next ›
              </a>
            </nav>
          )}
        </div>
      </section>
    </>
  );
}
