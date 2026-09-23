'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import type { SearchBoat, SearchResultsPage } from '@/lib/customer/types';
import { SearchBoatCard } from '@/components/customer/SearchBoatCard';
import { Toast } from '@/components/customer/Toast';
import { formatDate } from '@/lib/owner/format';
import { SearchBar } from './SearchBar';
import { FilterSidebar } from './FilterSidebar';
import {
  AMENITIES,
  PAGE_SIZE,
  SIZE_BUCKETS,
  type SearchFilters,
  type SizeKey,
  type Sort,
  applyFilters,
  destinationFacets,
  filtersFromParams,
  priceBounds,
} from './filters';

/**
 * Search results (design: haorboat-search.html lines 400–509).
 *
 * Two fetches, by design:
 *   - the paginated GRID comes from GET /houseboats/search/results (filtered,
 *     sorted and paged in the DB), so the grid scales past the catalogue size;
 *   - the SIDEBAR facet counts (size/amenity/destination counts, price bounds)
 *     still need the whole live set, so they keep reading the bare
 *     /houseboats/search flat array and computing counts client-side.
 * The URL carries the full filter state so results stay shareable, the back
 * button works, and the home hero's /search?route&date&guests&ac handoff lands.
 */

/** Build the /houseboats/search/results query string from the filter model. */
function resultsQuery(f: SearchFilters, page: number): string {
  const q = new URLSearchParams();
  if (f.route) q.set('route', f.route);
  if (f.date) q.set('date', f.date);
  if (f.guests) q.set('guests', String(f.guests));
  if (f.ac !== 'both') q.set('ac', f.ac);
  if (f.maxPrice != null) q.set('maxPrice', String(f.maxPrice));
  if (f.rating != null) q.set('rating', String(f.rating));
  for (const s of f.sizes) q.append('sizes', s);
  for (const a of f.amenities) q.append('amenities', a);
  if (f.sort !== 'recommended') q.set('sort', f.sort);
  q.set('page', String(page));
  q.set('pageSize', String(PAGE_SIZE));
  return q.toString();
}

const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: 'recommended', label: 'Sort: Recommended' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
  { value: 'reviews', label: 'Most reviewed' },
];

const PILL =
  'inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--blue)_16%,var(--raise-1))] bg-[color-mix(in_srgb,var(--blue)_8%,var(--raise-1))] px-2.5 py-[5px] text-[12.5px] font-bold text-blue';

export function SearchResults() {
  const router = useRouter();
  const params = useSearchParams();
  const filters = useMemo(() => filtersFromParams(new URLSearchParams(params.toString())), [params]);

  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Sidebar facets need the whole live set — bare fetch (same key HomeHero uses,
  // so it dedupes). Used ONLY for the price bounds + facet counts, never the grid.
  const { data: allData } = useSWR<SearchBoat[]>('/houseboats/search', fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
  const all = useMemo(() => allData ?? [], [allData]);

  const bounds = useMemo(() => priceBounds(all), [all]);
  const destinations = useMemo(() => destinationFacets(all), [all]);

  // Slider position while dragging; committed to the URL on release.
  const [priceDraft, setPriceDraft] = useState<number | null>(null);
  const effectivePrice = priceDraft ?? filters.maxPrice ?? bounds.max;

  // The grid itself is filtered/sorted/paginated in the DB.
  const {
    data: results,
    error,
    isLoading,
  } = useSWR<SearchResultsPage>(
    `/houseboats/search/results?${resultsQuery(filters, page)}`,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  const pageBoats = results?.items ?? [];
  const total = results?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);

  // Any filter change puts you back on page 1.
  useEffect(() => setPage(1), [params]);

  /** Facet counts ignore the group they belong to, so options never read "0"
   *  merely because that same group is already narrowing the list. */
  const sizeCounts = useMemo(() => {
    const base = applyFilters(all, { ...filters, sizes: [] });
    const out = { small: 0, medium: 0, large: 0 } as Record<SizeKey, number>;
    for (const b of base) {
      for (const bucket of SIZE_BUCKETS) {
        if (b.maxCapacity >= bucket.min && b.maxCapacity <= bucket.max) out[bucket.key] += 1;
      }
    }
    return out;
  }, [all, filters]);

  const amenityCounts = useMemo(() => {
    const base = applyFilters(all, { ...filters, amenities: [] });
    const out: Record<string, number> = {};
    for (const a of AMENITIES) {
      out[a.key] = base.filter((b) =>
        a.match.some((m) => (b.facilities ?? []).join(' ').toLowerCase().includes(m)),
      ).length;
    }
    return out;
  }, [all, filters]);

  /** Write a filter patch into the URL — the single source of truth. */
  const patch = useCallback(
    (next: Partial<SearchFilters>) => {
      const merged = { ...filters, ...next };
      const q = new URLSearchParams();
      if (merged.route) q.set('route', merged.route);
      if (merged.date) q.set('date', merged.date);
      if (merged.guests) q.set('guests', String(merged.guests));
      if (merged.ac !== 'both') q.set('ac', merged.ac);
      if (merged.maxPrice != null) q.set('maxPrice', String(merged.maxPrice));
      if (merged.rating != null) q.set('rating', String(merged.rating));
      if (merged.sizes.length) q.set('size', merged.sizes.join(','));
      if (merged.amenities.length) q.set('amenities', merged.amenities.join(','));
      if (merged.sort !== 'recommended') q.set('sort', merged.sort);
      const qs = q.toString();
      router.push(qs ? `/search?${qs}` : '/search', { scroll: false });
    },
    [filters, router],
  );

  const clearAll = () => {
    setPriceDraft(null);
    router.push('/search', { scroll: false });
  };

  // Scroll-reveal, mirroring _home/FeaturedBoats. Keyed on the rendered ids
  // rather than the array identity so it only re-runs when the grid's contents
  // actually change — `pageBoats` is a fresh array on every render.
  const pageKey = pageBoats.map((b) => b.id).join(',');
  useEffect(() => {
    const root = gridRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>('.card-reveal'));
    const revealAll = () => items.forEach((el) => el.classList.add('in'));

    if (
      window.matchMedia('(prefers-reduced-motion:reduce)').matches ||
      typeof IntersectionObserver === 'undefined'
    ) {
      revealAll();
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const el = en.target as HTMLElement;
          el.style.transitionDelay = `${(items.indexOf(el) % 3) * 0.08}s`;
          el.classList.add('in');
          obs.unobserve(el);
        });
      },
      { threshold: 0.12 },
    );
    items.forEach((el) => obs.observe(el));

    // Safety net: results must never be left invisible if the observer never
    // fires (element already past the viewport, tab restored from bg, etc.).
    const failsafe = window.setTimeout(revealAll, 1200);
    return () => {
      window.clearTimeout(failsafe);
      obs.disconnect();
    };
  }, [pageKey]);

  // Tell the user when their chosen date has no departures. The grid falls back
  // to on/after-date boats (backend `gte`), which is otherwise silent. Keyed on
  // the loaded flag + date so it fires once per result and re-shows when the
  // date changes; cleared (no toast) when the date has departures or is unset.
  const dateExactEmpty = results?.dateExactEmpty ?? false;
  const closeToast = useCallback(() => setToast(null), []);
  useEffect(() => {
    if (isLoading) return; // wait for this date's real result, not stale data
    if (filters.date && dateExactEmpty) {
      const pretty = formatDate(filters.date);
      setToast(
        total > 0
          ? `No boats depart on ${pretty}. Showing the next available dates.`
          : `No boats available on or after ${pretty}. Try another date.`,
      );
    } else {
      setToast(null);
    }
    // total is intentionally read but not a dep: it settles with `results`, and
    // dateExactEmpty already changes identity when a new result lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateExactEmpty, filters.date, isLoading]);

  const hasFilters =
    !!filters.route ||
    !!filters.date ||
    filters.guests != null ||
    filters.ac !== 'both' ||
    filters.maxPrice != null ||
    filters.rating != null ||
    filters.sizes.length > 0 ||
    filters.amenities.length > 0;

  return (
    <>
      {toast && <Toast message={toast} onClose={closeToast} />}
      <SearchBar
        destinations={destinations}
        route={filters.route ?? ''}
        date={filters.date ?? ''}
        guests={filters.guests ? String(filters.guests) : ''}
        ac={filters.ac}
        onSearch={({ route, date, guests, ac }) => {
          const g = Number(guests);
          patch({
            route: route || undefined,
            date: date || undefined,
            guests: Number.isFinite(g) && g > 0 ? Math.floor(g) : undefined,
            ac,
          });
        }}
      />

      <section>
        <div className="mx-auto grid max-w-wrap items-start gap-7 px-6 pb-[60px] pt-[26px] [grid-template-columns:270px_1fr] max-[1040px]:[grid-template-columns:1fr]">
          {/* toolbar */}
          <div className="col-[1/-1] mb-[2px] flex flex-wrap items-center gap-2.5">
            <span className="text-sm font-semibold text-bodytext">
              <b className="font-extrabold text-ink">{total}</b>{' '}
              {total === 1 ? 'boat' : 'boats'}
              {filters.route ? ` · ${filters.route}` : ''}
            </span>

            {filters.route && (
              <span className={PILL}>
                {filters.route}
                <button aria-label="Remove destination filter" onClick={() => patch({ route: undefined })}>
                  ✕
                </button>
              </span>
            )}
            {filters.ac !== 'both' && (
              <span className={PILL}>
                {filters.ac === 'ac' ? 'AC cabins' : 'Non-AC'}
                <button aria-label="Remove cabin type filter" onClick={() => patch({ ac: 'both' })}>
                  ✕
                </button>
              </span>
            )}
            {filters.maxPrice != null && (
              <span className={PILL}>
                Under ৳{filters.maxPrice.toLocaleString('en-US')}
                <button
                  aria-label="Remove price filter"
                  onClick={() => {
                    setPriceDraft(null);
                    patch({ maxPrice: undefined });
                  }}
                >
                  ✕
                </button>
              </span>
            )}
            {filters.rating != null && (
              <span className={PILL}>
                ★ {filters.rating.toFixed(1)} &amp; up
                <button aria-label="Remove rating filter" onClick={() => patch({ rating: undefined })}>
                  ✕
                </button>
              </span>
            )}
            {filters.guests != null && (
              <span className={PILL}>
                {filters.guests} guests
                <button aria-label="Remove guests filter" onClick={() => patch({ guests: undefined })}>
                  ✕
                </button>
              </span>
            )}
            {filters.sizes.map((s) => (
              <span key={s} className={PILL}>
                {SIZE_BUCKETS.find((b) => b.key === s)?.label}
                <button
                  aria-label={`Remove ${s} size filter`}
                  onClick={() => patch({ sizes: filters.sizes.filter((x) => x !== s) })}
                >
                  ✕
                </button>
              </span>
            ))}
            {filters.amenities.map((a) => (
              <span key={a} className={PILL}>
                {AMENITIES.find((x) => x.key === a)?.label}
                <button
                  aria-label={`Remove ${a} filter`}
                  onClick={() => patch({ amenities: filters.amenities.filter((x) => x !== a) })}
                >
                  ✕
                </button>
              </span>
            ))}

            {hasFilters && (
              <button
                onClick={clearAll}
                className="text-[12.5px] font-bold text-muted underline hover:text-blue"
              >
                Clear
              </button>
            )}

            <div className="ml-auto flex items-center gap-2.5 max-[560px]:ml-0 max-[560px]:w-full">
              <button
                type="button"
                onClick={() => setDrawer(true)}
                className="hidden items-center gap-2 rounded border border-hair bg-raise-1 px-4 py-2 text-[13.5px] font-bold text-ink shadow-e1 hover:border-[color-mix(in_srgb,var(--blue)_45%,var(--hair))] hover:text-blue max-[1040px]:inline-flex"
              >
                ⚙️ Filters
              </button>
              <select
                aria-label="Sort by"
                value={filters.sort}
                onChange={(e) => patch({ sort: e.target.value as Sort })}
                className="rounded border border-hair bg-raise-1 px-3 py-2 text-[13.5px] font-bold text-ink max-[560px]:flex-1"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <FilterSidebar
            filters={filters}
            destinations={destinations}
            sizeCounts={sizeCounts}
            amenityCounts={amenityCounts}
            priceMin={bounds.min}
            priceMax={bounds.max}
            priceDraft={effectivePrice}
            open={drawer}
            onClose={() => setDrawer(false)}
            onPatch={patch}
            onPriceDraft={setPriceDraft}
            onPriceCommit={(v) => {
              setPriceDraft(null);
              patch({ maxPrice: v >= bounds.max ? undefined : v });
            }}
          />

          {/* results */}
          <div
            ref={gridRef}
            className="grid gap-[18px] [grid-template-columns:repeat(3,1fr)] max-[820px]:[grid-template-columns:repeat(2,1fr)] max-[560px]:[grid-template-columns:1fr]"
          >
            {isLoading && !results ? (
              Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <div
                  key={i}
                  className="h-[320px] animate-pulse rounded-2xl border border-hair bg-raise-1"
                />
              ))
            ) : error ? (
              <p className="col-[1/-1] m-0 text-sm text-muted">
                Couldn’t load results. Please try again.
              </p>
            ) : pageBoats.length === 0 ? (
              <div className="col-[1/-1] rounded-2xl border border-hair bg-raise-1 px-6 py-12 text-center">
                <p className="m-0 font-display text-[17px] font-semibold text-ink">
                  No boats match these filters
                </p>
                <p className="mx-auto mt-2 max-w-[42ch] text-sm text-muted">
                  Try widening your search — fewer amenities, a larger price range, or any location.
                </p>
                {hasFilters && (
                  <button
                    onClick={clearAll}
                    className="mt-4 rounded border border-hair bg-raise-1 px-5 py-2.5 text-sm font-bold text-ink shadow-e1 hover:border-[color-mix(in_srgb,var(--blue)_45%,var(--hair))] hover:text-blue"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              pageBoats.map((b) => (
                <div key={b.id} className="card-reveal">
                  <SearchBoatCard boat={b} />
                </div>
              ))
            )}
          </div>

          {pageCount > 1 && (
            <nav
              aria-label="Pagination"
              className="col-[1/-1] mt-10 flex justify-center gap-2"
            >
              <PagerBtn disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>
                ‹ Prev
              </PagerBtn>
              {Array.from({ length: pageCount }).map((_, i) => (
                <PagerBtn
                  key={i}
                  active={safePage === i + 1}
                  aria-current={safePage === i + 1 ? 'page' : undefined}
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </PagerBtn>
              ))}
              <PagerBtn disabled={safePage === pageCount} onClick={() => setPage(safePage + 1)}>
                Next ›
              </PagerBtn>
            </nav>
          )}
        </div>
      </section>
    </>
  );
}

function PagerBtn({
  children,
  active,
  disabled,
  onClick,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`grid h-10 min-w-10 place-items-center rounded-[10px] border px-3 text-sm font-bold transition-all duration-dur ease-ease disabled:pointer-events-none disabled:opacity-45 ${
        active
          ? 'border-blue bg-blue text-white'
          : 'border-hair bg-raise-1 text-ink hover:border-blue hover:text-blue'
      }`}
      {...rest}
    >
      {children}
    </button>
  );
}
