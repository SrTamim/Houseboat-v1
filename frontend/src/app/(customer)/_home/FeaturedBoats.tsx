'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import type { SearchBoat } from '@/lib/customer/types';
import { BoatCard } from '@/components/customer/BoatCard';

// Card width + inter-card gap in px for the mobile carousel. The gap matches the
// Tailwind `gap-6` (1.5rem = 24px) — both feed the coverflow scroll math.
const CARD_W = 272;
const GAP = 24;
// Subtle coverflow depth: a neighbour one card away shrinks to 0.9 and fades to
// 0.6; the centred card stays 1 / 1.
const MIN_SCALE = 0.9;
const MIN_OPACITY = 0.6;
// At/above this width the section is a static multi-card grid (no carousel).
const GRID_MIN = 768;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Featured houseboats. Two layouts share one card list:
 *  - < 768px: a center-focus (coverflow) carousel — the card nearest the track
 *    centre is full size/opaque, neighbours scale down and fade; smooth because
 *    the scaling is driven continuously by scroll position. Dots below.
 *  - ≥ 768px: a static multi-column grid (3–4 full-size cards filling the width,
 *    no scaling, no dots) — desktops have the room and the coverflow only wasted
 *    it.
 *
 * Data: the public search rollup (carries price-from / rating / AC summary the
 * card needs — plain /houseboats does not); first eight boats.
 */
export function FeaturedBoats() {
  const { data, error, isLoading } = useSWR<SearchBoat[]>(
    '/houseboats/search',
    fetcher,
    { revalidateOnFocus: false },
  );

  const all = data ?? [];
  const boats = all.slice(0, 8);
  const headRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const [active, setActive] = useState(0);
  // Which layout is live. Starts false (grid) to match SSR; corrected on mount.
  const [isCarousel, setIsCarousel] = useState(false);

  // Track the layout breakpoint.
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${GRID_MIN - 1}px)`);
    const apply = () => setIsCarousel(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Heading fade-in on scroll — guaranteed to reveal even if the observer never
  // fires (a previous version left the title stuck at opacity:0 on desktop).
  useEffect(() => {
    const el = headRef.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    if (reduce) {
      el.classList.add('in');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          en.target.classList.add('in');
        });
      },
      { threshold: 0, rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(el);
    // Safety net: the observer occasionally never delivers a tick for this
    // section (title was once left stuck at opacity:0 on desktop). Reveal
    // unconditionally after a short beat so the heading is guaranteed visible —
    // the fade still plays for anyone who scrolls to it first.
    const timer = window.setTimeout(() => el.classList.add('in'), 1200);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
    // Depends on isLoading: while the SWR request is in flight the component
    // returns null, so headRef is unattached and this effect no-ops. Re-running
    // once the heading actually mounts is what makes the reveal fire at all.
  }, [isLoading]);

  // Coverflow transform, carousel mode only. One read/write pass per rAF.
  const paint = useCallback(() => {
    const t = trackRef.current;
    if (!t) return;
    const cards = Array.from(t.children) as HTMLElement[];
    const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    const gridMode = !window.matchMedia(`(max-width:${GRID_MIN - 1}px)`).matches;

    if (gridMode || reduce) {
      // Grid (or reduced motion): full-size cards, no leftover inline transform.
      cards.forEach((card) => {
        card.style.transform = '';
        card.style.opacity = '';
      });
      return;
    }

    const trackCenter = t.scrollLeft + t.clientWidth / 2;
    let nearest = 0;
    let nearestDist = Infinity;
    cards.forEach((card, i) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const dist = clamp01(Math.abs(trackCenter - cardCenter) / (CARD_W + GAP));
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
      card.style.transform = `scale(${(1 - dist * (1 - MIN_SCALE)).toFixed(3)})`;
      card.style.opacity = `${(1 - dist * (1 - MIN_OPACITY)).toFixed(3)}`;
    });
    setActive(nearest);
  }, []);

  const onScroll = () => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      paint();
    });
  };

  // Initial paint + keep geometry correct on resize (also clears stale scale
  // when the window is widened across the breakpoint into grid mode).
  useEffect(() => {
    if (boats.length === 0) return;
    paint();
    window.addEventListener('resize', paint);
    return () => {
      window.removeEventListener('resize', paint);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [boats.length, isCarousel, paint]);

  const goTo = (i: number) => {
    const t = trackRef.current;
    if (!t) return;
    const card = t.children[i] as HTMLElement | undefined;
    if (!card) return;
    const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    const left = card.offsetLeft - (t.clientWidth - card.offsetWidth) / 2;
    t.scrollTo({ left, behavior: reduce ? 'auto' : 'smooth' });
  };

  // Don't render anything while the request is in flight or errored — those
  // states would only flash a placeholder band.
  if (isLoading || error) return null;

  const empty = boats.length === 0;

  return (
    <section className="bg-bg dark:bg-transparent">
      <div className={`mx-auto max-w-wrap px-6 ${empty ? 'py-7' : 'py-[60px] max-[640px]:pb-9 max-[640px]:pt-7'}`}>
        <div
          ref={headRef}
          className={`reveal flex flex-wrap items-end justify-between gap-4 ${empty ? 'mb-2.5' : 'mb-7 max-[640px]:mb-4'}`}
        >
          <div>
            <span className="text-[13px] font-bold uppercase tracking-[.09em] text-blue dark:[text-shadow:0_0_16px_rgba(90,160,255,.3)]">
              Popular cruises
            </span>
            <h2 className="mt-2 font-display text-3xl tracking-[-.03em] max-[640px]:mt-1 max-[640px]:text-2xl">
              Featured houseboats
            </h2>
          </div>
          <Link
            className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-blue transition-[gap] duration-dur ease-ease hover:gap-2.5"
            href="/search"
          >
            View all {all.length} <span>→</span>
          </Link>
        </div>

        {empty ? (
          <p className="m-0 text-sm text-muted">
            No featured houseboats yet — check back soon.
          </p>
        ) : (
          <>
            {/* < md: coverflow carousel (snap-center, edge peek, scaled by
                paint()). ≥ md: static grid filling the width, no snap/scroll,
                cards grow via minmax(300px,1fr). */}
            <div
              ref={trackRef}
              onScroll={isCarousel ? onScroll : undefined}
              className="-mx-6 flex snap-x snap-mandatory gap-6 overflow-x-auto px-[calc(50%-136px)] py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:grid md:snap-none md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] md:overflow-visible md:px-0 md:py-0"
            >
              {boats.map((b) => (
                <div
                  key={b.id}
                  className="flex w-[272px] shrink-0 snap-center [transform-origin:center] [transition:transform_.15s_var(--ease),opacity_.15s_var(--ease)] [will-change:transform] md:w-auto md:shrink"
                >
                  <BoatCard boat={b} />
                </div>
              ))}
            </div>

            {boats.length > 1 ? (
              <div className="mt-5 flex justify-center gap-2 md:hidden">
                {boats.map((b, i) => (
                  <button
                    key={b.id}
                    type="button"
                    aria-label={`Go to featured boat ${i + 1}`}
                    aria-current={i === active}
                    onClick={() => goTo(i)}
                    className={`h-2 rounded-full transition-all duration-dur ease-ease ${
                      i === active
                        ? 'w-6 bg-blue'
                        : 'w-2 bg-hair hover:bg-[color-mix(in_srgb,var(--blue)_45%,var(--hair))]'
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
