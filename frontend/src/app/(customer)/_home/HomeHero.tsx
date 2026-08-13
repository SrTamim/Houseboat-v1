'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import type { SearchBoat } from '@/lib/customer/types';
import { DestinationPicker, type DestOption } from './DestinationPicker';
import { DatePicker } from './DatePicker';

/** Fallback destinations shown before the live route list resolves. */
const FALLBACK_DESTINATIONS = [
  { label: 'Tanguar Haor', sub: 'Sunamganj' },
  { label: 'Nikli Haor', sub: 'Kishoreganj' },
];

const CHIP_ICONS: Record<string, string> = {
  'Tanguar Haor': '🏝️',
  'Nikli Haor': '🌅',
  'Padma River': '🌊',
  'Boga Lake': '⛰️',
  Sundarban: '🌳',
};

const HERO_TITLE = "Book a houseboat on Bangladesh's haors";

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Wego-style hero + search card, rebuilt in Tailwind from the design preview
 * (haorboat-home-v2.html lines 145–201, 502–560). Destination and route chips
 * are derived from the live search rollup so they only ever point at routes that
 * actually have boats. The card's fields drive a client-side navigation to
 * /search with the chosen filters — the search page is the authoritative result
 * view. Effects (photo zoom, mist, ::after overlay, shimmer headline, conic
 * border) come from the class hooks in home-effects.css.
 */
export function HomeHero() {
  const router = useRouter();
  const { data } = useSWR<SearchBoat[]>('/houseboats/search', fetcher, {
    revalidateOnFocus: false,
  });

  // Distinct route names that currently have boats, preserving first-seen order.
  const destinations = useMemo(() => {
    const seen = new Map<string, { label: string; sub: string }>();
    for (const b of data ?? []) {
      for (const r of b.routes ?? []) {
        const name = r.route?.name;
        if (name && !seen.has(name)) {
          seen.set(name, { label: name, sub: r.route?.region ?? '' });
        }
      }
    }
    return seen.size ? Array.from(seen.values()) : FALLBACK_DESTINATIONS;
  }, [data]);

  const destOptions = useMemo<DestOption[]>(() => destinations, [destinations]);

  const [dest, setDest] = useState('');
  const [date, setDate] = useState(todayIso);
  const [guests, setGuests] = useState('');
  const [ac, setAc] = useState<'ac' | 'nonac' | 'both'>('ac');

  // Cabins sub-line (mirrors the preview's "2 cabins" hint). Estimated from
  // guests at ~2 per cabin; falls back to a neutral hint before any input.
  const cabinsHint = (() => {
    const g = Number(guests);
    if (!Number.isFinite(g) || g <= 0) return 'Add guests to size cabins';
    const cabins = Math.max(1, Math.ceil(g / 2));
    return `~${cabins} ${cabins === 1 ? 'cabin' : 'cabins'}`;
  })();

  // Default the destination to the first real location once routes resolve.
  const firstDest = destinations[0]?.label ?? '';
  useEffect(() => {
    if (!dest && firstDest) setDest(firstDest);
  }, [firstDest, dest]);

  // Headline word-by-word rise (mirrors the preview's [data-split] effect).
  // Skipped under reduced-motion; the shimmer still applies via .hero-title.
  const [words, setWords] = useState<string[] | null>(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    setWords(HERO_TITLE.split(' '));
  }, []);

  const search = () => {
    const params = new URLSearchParams();
    if (dest) params.set('route', dest);
    if (date) params.set('date', date);
    const g = Number(guests);
    if (Number.isFinite(g) && g > 0) params.set('guests', String(Math.floor(g)));
    if (ac !== 'both') params.set('ac', ac);
    const qs = params.toString();
    router.push(qs ? `/search?${qs}` : '/search');
  };

  return (
    // No `overflow-hidden` on this section on purpose: the date/destination
    // popovers render inline (absolute children of their field) so the browser
    // keeps them glued to the trigger while scrolling, and a clip here would cut
    // them off. The layers that actually overflow — the zooming photo and the
    // two mist sheets — are clipped by their own wrappers instead.
    // `isolate` keeps those negative-z layers inside the hero; `z-10` then lifts
    // the whole hero (and the popovers it now contains) above the sections that
    // follow, which would otherwise paint over the open calendar.
    <section className="hero-overlay relative isolate z-10 px-0 pb-[150px] pt-12 text-white max-[640px]:pb-[120px] max-[640px]:pt-8">
      <div className="absolute inset-0 z-[-2] overflow-hidden" aria-hidden="true">
        <img
          className="hero-photo h-full w-full object-cover"
          alt="Sunrise mist over a Bangladesh haor wetland"
          src="https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1920&q=70"
        />
      </div>
      <div className="absolute inset-0 z-[-1] overflow-hidden" aria-hidden="true">
        <div className="mist" />
        <div className="mist m2" />
      </div>

      <div className="mx-auto max-w-wrap px-6">
        <div className="mx-auto mb-[30px] max-w-[44ch] text-center">
          <h1 className="hero-title mt-[18px] font-display text-[44px] font-semibold leading-[1.15] tracking-[-0.03em] max-[640px]:text-[32px]">
            {words
              ? words.map((w, i) => (
                  <span
                    key={i}
                    className="w"
                    style={{ '--d': `${(0.15 + i * 0.075).toFixed(3)}s` } as React.CSSProperties}
                  >
                    {w}
                    {i < words.length - 1 ? ' ' : ''}
                  </span>
                ))
              : HERO_TITLE}
          </h1>
        </div>

        <div className="relative mx-auto mb-[-100px] max-w-[1060px] max-[640px]:mb-[-80px]">
          {/* pill tabs straddling the top edge of the card */}
          <div className="relative z-[3] mb-[-26px] flex justify-center gap-2 px-3 max-[640px]:mb-[-24px] max-[640px]:flex-wrap max-[640px]:gap-y-0">
            <div className="flex items-center gap-2 rounded-t-2xl border border-raise-1 bg-raise-1 px-[22px] pb-[30px] pt-3 text-[14.5px] font-semibold text-blue shadow-[0_-6px_20px_rgba(0,0,0,.10)] max-[640px]:px-[15px] max-[640px]:pb-7 max-[640px]:pt-[11px] max-[640px]:text-[13px]">
              🛥️ Houseboats
            </div>
            <div className="flex cursor-not-allowed items-center gap-2 rounded-t-2xl border border-white/[.26] bg-white/[.16] px-[22px] pb-[30px] pt-3 text-[14.5px] font-semibold text-white opacity-[.72] backdrop-blur-[6px] max-[640px]:px-[15px] max-[640px]:pb-7 max-[640px]:pt-[11px] max-[640px]:text-[13px]">
              🚌 Bus{' '}
              <span className="rounded-[5px] border border-white/40 bg-white/[.28] px-[6px] py-[2px] text-[9px] font-bold uppercase tracking-[.04em] text-white">
                Soon
              </span>
            </div>
          </div>

          {/* search card — conic border via .searchcard-ring (home-effects.css) */}
          <div className="searchcard-ring relative z-[4] rounded-2xl border border-hair bg-raise-1 p-6 shadow-[var(--e3),var(--top-hi)] dark:border-[color-mix(in_srgb,var(--blue)_12%,var(--hair))] dark:bg-[linear-gradient(160deg,color-mix(in_srgb,var(--blue)_8%,var(--raise-1)),var(--raise-1)_62%)]">
            <div className="grid gap-3 [grid-template-columns:1.5fr_1.2fr_1fr] max-[640px]:[grid-template-columns:1fr]">
              <DestinationPicker options={destOptions} value={dest} onChange={setDest} />
              <DatePicker value={date} onChange={setDate} min={todayIso()} />
              <label className="relative block cursor-pointer rounded border border-hair bg-field px-4 py-3 transition-[border-color,box-shadow] duration-dur ease-ease hover:border-[color-mix(in_srgb,var(--blue)_30%,var(--hair))] focus-within:border-blue focus-within:shadow-ring">
                <span className="flex items-center gap-[6px] text-[11.5px] font-bold uppercase tracking-[.05em] text-muted">
                  👤 Guests &amp; cabins
                </span>
                <input
                  className="mt-[3px] w-full border-none bg-transparent p-0 font-display text-[17px] font-semibold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  placeholder="Any"
                  value={guests}
                  onChange={(e) => setGuests(e.target.value)}
                />
                <span className="mt-px block text-[12.5px] font-medium text-muted">
                  {cabinsHint}
                </span>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-[14px] max-[640px]:flex-col max-[640px]:items-stretch">
              <div className="flex flex-wrap items-center gap-5">
                <span className="text-[13.5px] font-semibold text-bodytext">Cabin type:</span>
                <div className="inline-flex rounded border border-hair bg-chip p-[3px]">
                  {(
                    [
                      ['ac', 'AC'],
                      ['nonac', 'Non-AC'],
                      ['both', 'Both'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      className={`rounded-sm border-none px-4 py-[7px] text-[13.5px] font-semibold transition-all duration-dur ease-ease ${
                        ac === val
                          ? 'bg-raise-1 text-blue shadow-e1 dark:bg-[color-mix(in_srgb,var(--blue)_16%,var(--raise-1))] dark:shadow-[var(--e1),0_0_0_1px_color-mix(in_srgb,var(--blue)_22%,transparent)]'
                          : 'bg-transparent text-bodytext hover:text-blue'
                      }`}
                      onClick={() => setAc(val)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="btn-sheen inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-transparent bg-blue px-7 py-[14px] text-[15.5px] font-semibold leading-none text-white shadow-[var(--e1),inset_0_1px_0_rgba(255,255,255,.18),0_10px_30px_-8px_color-mix(in_srgb,var(--blue)_70%,transparent)] transition-[background,transform] duration-dur ease-ease hover:bg-blue-600 active:translate-y-[.5px] max-[640px]:w-full"
                onClick={search}
              >
                🔍 Search boats
              </button>
            </div>
          </div>

          <div className="mt-[22px] flex flex-wrap justify-center gap-3">
            {destinations.map((d) => (
              <Link
                key={d.label}
                href={`/search?route=${encodeURIComponent(d.label)}`}
                className="relative flex items-center gap-[9px] rounded border border-hair bg-raise-1 px-[18px] py-3 text-[14px] font-semibold text-ink shadow-e1 transition-[transform,box-shadow] duration-dur ease-ease hover:-translate-y-[2px] hover:shadow-e2 dark:border-[color-mix(in_srgb,var(--blue)_12%,var(--hair))] dark:bg-[linear-gradient(160deg,color-mix(in_srgb,var(--blue)_8%,var(--raise-1)),var(--raise-1))] dark:hover:border-[color-mix(in_srgb,var(--blue)_30%,var(--hair))]"
              >
                {CHIP_ICONS[d.label] ?? '📍'} {d.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
