'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Offer {
  gradient: string;
  tag: string;
  title: string;
  body: React.ReactNode;
  link: string;
}

/** The three offer cards, gradients from the preview (`.offer.o1/o2/o3`, 257–259). */
const OFFERS: Offer[] = [
  {
    gradient: 'bg-[linear-gradient(135deg,#1560d6,#3b8bff)]',
    tag: 'Eid special',
    title: 'Up to 25% off Tanguar Haor cruises',
    body: 'Book a 2-night monsoon trip and save on every AC cabin.',
    link: 'Grab deal →',
  },
  {
    gradient: 'bg-[linear-gradient(135deg,#0f766e,#14b8a6)]',
    tag: 'Group saver',
    title: 'Charter a full boat, pay for 8',
    body: 'Groups of 10+ get two seats free on Nikli & Padma routes.',
    link: 'See group rates →',
  },
  {
    gradient: 'bg-[linear-gradient(135deg,#b45309,#f6a623)]',
    tag: 'First trip',
    title: '৳500 off your first booking',
    body: (
      <>
        New to HaorBoat? Use code{' '}
        <b className="rounded-[5px] bg-white/[.22] px-[7px] py-px font-display text-[13px] tabular-nums">
          HAOR500
        </b>{' '}
        at checkout.
      </>
    ),
    link: 'Start booking →',
  },
];

// Mobile carousel card width + gap (gap matches the section's `gap-[22px]`).
const CARD_W = 300;
const GAP = 22;
// Subtle coverflow depth: a neighbour one card away → 0.9 scale / 0.6 opacity.
const MIN_SCALE = 0.9;
const MIN_OPACITY = 0.6;
// At/above this width the section is a static grid (no carousel).
const GRID_MIN = 768;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Special offers. Mirrors the Featured Boats treatment:
 *  - < 768px: center-focus coverflow carousel (scroll-driven scale/fade + dots).
 *  - ≥ 768px: static auto-fill grid (offers may grow, so not a fixed 3-up).
 *
 * Static content (no fetch). Each card's soft radial sparkle overlay is the
 * `.offer-fx::after` hook in home-effects.css.
 */
export function HomeOffers() {
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const [active, setActive] = useState(0);
  const [isCarousel, setIsCarousel] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${GRID_MIN - 1}px)`);
    const apply = () => setIsCarousel(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const paint = useCallback(() => {
    const t = trackRef.current;
    if (!t) return;
    const cards = Array.from(t.children) as HTMLElement[];
    const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    const gridMode = !window.matchMedia(`(max-width:${GRID_MIN - 1}px)`).matches;

    if (gridMode || reduce) {
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

  useEffect(() => {
    paint();
    window.addEventListener('resize', paint);
    return () => {
      window.removeEventListener('resize', paint);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [isCarousel, paint]);

  const goTo = (i: number) => {
    const t = trackRef.current;
    if (!t) return;
    const card = t.children[i] as HTMLElement | undefined;
    if (!card) return;
    const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    const left = card.offsetLeft - (t.clientWidth - card.offsetWidth) / 2;
    t.scrollTo({ left, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <section
      id="offers"
      className="border-t border-hair bg-raise-1 dark:border-t-[color-mix(in_srgb,var(--blue)_12%,var(--hair))] dark:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--blue)_6%,transparent),transparent)]"
    >
      <div className="mx-auto max-w-wrap px-6 py-[60px] max-[640px]:py-9">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4 max-[640px]:mb-4">
          <div>
            <span className="text-[13px] font-bold uppercase tracking-[.09em] text-blue dark:[text-shadow:0_0_16px_rgba(90,160,255,.3)]">
              Limited time
            </span>
            <h2 className="mt-2 font-display text-3xl tracking-[-.03em] max-[640px]:mt-1 max-[640px]:text-2xl">
              Special offers
            </h2>
          </div>
          <Link
            className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-blue transition-[gap] duration-dur ease-ease hover:gap-2.5"
            href="/search"
          >
            All offers <span>→</span>
          </Link>
        </div>

        {/* < md: coverflow carousel (snap-center, edge peek, scaled by paint()).
            ≥ md: static grid filling the width, no snap/scroll. */}
        <div
          ref={trackRef}
          onScroll={isCarousel ? onScroll : undefined}
          className="-mx-6 flex snap-x snap-mandatory gap-[22px] overflow-x-auto px-[calc(50%-150px)] py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:grid md:snap-none md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] md:gap-[22px] md:overflow-visible md:px-0 md:py-0"
        >
          {OFFERS.map((o) => (
            <div
              key={o.tag}
              className="flex w-[300px] shrink-0 snap-center [transform-origin:center] [transition:transform_.15s_var(--ease),opacity_.15s_var(--ease)] [will-change:transform] md:w-auto md:shrink"
            >
              <Link
                href="/search"
                className={`offer-fx group relative isolate flex h-full w-full min-h-[210px] flex-col overflow-hidden rounded-2xl px-[26px] pb-6 pt-7 text-white shadow-e2 transition-[transform,box-shadow] duration-[.18s] ease-ease hover:-translate-y-[5px] hover:shadow-e3 ${o.gradient}`}
              >
                <span className="self-start rounded-full border border-white/35 bg-white/[.22] px-[11px] py-[5px] text-[11.5px] font-bold uppercase tracking-[.05em] backdrop-blur-[4px]">
                  {o.tag}
                </span>
                <h3 className="mb-2 mt-4 text-xl leading-[1.25] text-white">{o.title}</h3>
                <p className="text-sm leading-[1.55] text-white/[.92]">{o.body}</p>
                <span className="mt-auto inline-flex gap-1.5 pt-3.5 text-[14.5px] font-bold transition-[gap] duration-dur ease-ease group-hover:gap-[11px]">
                  {o.link}
                </span>
              </Link>
            </div>
          ))}
        </div>

        {OFFERS.length > 1 ? (
          <div className="mt-5 flex justify-center gap-2 md:hidden">
            {OFFERS.map((o, i) => (
              <button
                key={o.tag}
                type="button"
                aria-label={`Go to offer ${i + 1}`}
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
      </div>
    </section>
  );
}
