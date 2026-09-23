'use client';

import { useEffect, useRef, useState } from 'react';

const COUNTS = [
  { to: 500, unit: '+', label: 'Houseboats listed' },
  { to: 12000, unit: '+', label: 'Trips completed' },
  { to: 38500, unit: '+', label: 'Happy travellers' },
  { to: 14, unit: '', label: 'Haor destinations' },
  // Hidden on mobile (the 2×2 grid takes the first four) — see mobileHidden below.
  { to: 6120, unit: '+', label: 'Trip reviews', mobileHidden: true },
];

/**
 * Compact trust strip with count-up-on-scroll, rebuilt in Tailwind from the
 * design preview (haorboat-home-v2.html lines 204–214, dark 351–355 + 375).
 * Vertical hairline dividers between counts render as a left border on every
 * count after the first (a pseudo-element `before:` matching the preview's
 * `.count + .count::before`), dropped when the row wraps two-up at ≤640px.
 *
 * On mobile (≤640px) the strip becomes a 2×2 grid of the first four counts
 * ("Trip reviews" is hidden), with fonts stepped down again below 380px so the
 * number + label fit side by side on the narrowest phones.
 */
export function TrustCounter() {
  return (
    <section className="border-y border-hair bg-raise-1 dark:border-y-[color-mix(in_srgb,var(--blue)_16%,var(--hair))] dark:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--blue)_7%,var(--raise-1)),var(--raise-1))]">
      <div className="mx-auto max-w-wrap px-6 py-[22px] max-[640px]:px-4">
        <div className="flex flex-wrap items-center justify-center max-[640px]:mx-auto max-[640px]:grid max-[640px]:w-fit max-[640px]:grid-cols-2 max-[640px]:gap-x-3 max-[640px]:gap-y-4">
          {COUNTS.map((c, i) => (
            <div
              key={c.label}
              className={`relative flex min-h-[40px] items-center gap-[10px] px-[22px] max-[640px]:min-h-0 max-[640px]:justify-center max-[640px]:gap-2 max-[640px]:px-0 ${
                c.mobileHidden ? 'max-[640px]:hidden ' : ''
              }${
                i > 0
                  ? "before:absolute before:left-0 before:top-1/2 before:h-8 before:w-px before:-translate-y-1/2 before:bg-hair before:content-[''] max-[640px]:before:hidden"
                  : ''
              }`}
            >
              <Count to={c.to} unit={c.unit} />
              <div className="max-w-[10ch] text-xs font-medium leading-[1.25] text-bodytext max-[380px]:text-[11px]">
                {c.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Count({ to, unit }: { to: number; unit: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [n, setN] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    if (reduce) {
      setN(to);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          const start = performance.now();
          const dur = 1400;
          const step = (t: number) => {
            const p = Math.min((t - start) / dur, 1);
            const e = 1 - Math.pow(1 - p, 3);
            setN(Math.round(to * e));
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to]);

  return (
    <div
      ref={ref}
      className="whitespace-nowrap font-display text-[23px] font-bold leading-none tracking-[-.03em] tabular-nums text-blue max-[640px]:text-[20px] max-[380px]:text-[17px] dark:[text-shadow:0_0_18px_rgba(90,160,255,.35)]"
    >
      {n.toLocaleString('en-US')}
      {unit ? <span className="text-base max-[380px]:text-sm">{unit}</span> : null}
    </div>
  );
}
