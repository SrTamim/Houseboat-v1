'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import type { SearchBoat } from '@/lib/customer/types';
import { BoatCard } from '@/components/customer/BoatCard';

/**
 * Featured houseboats grid, rebuilt in Tailwind from the design preview
 * (haorboat-home-v2.html lines 217–246, dark 350 + 376, markup 574–580). Pulls
 * the public search rollup (which carries the price-from / rating / AC summary
 * the card needs — plain /houseboats does not) and shows the first eight. The
 * section and its cards fade/slide in on scroll via `.reveal` / `.card-reveal`
 * (home-effects.css); a small IntersectionObserver toggles the `.in` class with
 * a staggered per-card delay, matching the preview's scroll-reveal.
 */
export function FeaturedBoats() {
  const { data, error, isLoading } = useSWR<SearchBoat[]>(
    '/houseboats/search',
    fetcher,
    { revalidateOnFocus: false },
  );

  const all = data ?? [];
  const boats = all.slice(0, 8);
  const gridRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    const targets: Element[] = [];
    if (headRef.current) targets.push(headRef.current);
    if (gridRef.current) targets.push(...Array.from(gridRef.current.children));
    if (reduce) {
      targets.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          const el = en.target as HTMLElement;
          const idx = Array.prototype.indexOf.call(el.parentNode?.children ?? [], el);
          if (el.classList.contains('card-reveal')) {
            el.style.transitionDelay = `${(idx % 4) * 0.08}s`;
          }
          el.classList.add('in');
        });
      },
      { threshold: 0.12 },
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [boats.length]);

  // Don't render anything while the request is in flight or errored — those
  // states would only flash a placeholder band.
  if (isLoading || error) return null;

  const empty = boats.length === 0;

  return (
    <section className="bg-bg dark:bg-transparent">
      <div className={`mx-auto max-w-wrap px-6 ${empty ? 'py-7' : 'py-[60px]'}`}>
        <div
          ref={headRef}
          className={`reveal flex flex-wrap items-end justify-between gap-4 ${empty ? 'mb-2.5' : 'mb-7'}`}
        >
          <div>
            <span className="text-[13px] font-bold uppercase tracking-[.09em] text-blue dark:[text-shadow:0_0_16px_rgba(90,160,255,.3)]">
              Popular cruises
            </span>
            <h2 className="mt-2 font-display text-3xl tracking-[-.03em]">
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
          <div
            ref={gridRef}
            className="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(272px,1fr))]"
          >
            {boats.map((b) => (
              <div key={b.id} className="card-reveal">
                <BoatCard boat={b} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
