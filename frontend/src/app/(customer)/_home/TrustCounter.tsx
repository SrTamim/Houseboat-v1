'use client';

import { useEffect, useRef, useState } from 'react';

const COUNTS = [
  { to: 500, unit: '+', label: 'Houseboats listed' },
  { to: 12000, unit: '+', label: 'Trips completed' },
  { to: 38500, unit: '+', label: 'Happy travellers' },
  { to: 14, unit: '', label: 'Haor destinations' },
  { to: 6120, unit: '+', label: 'Trip reviews' },
];

/** Compact trust strip with count-up-on-scroll (design: haorboat-home-v2.html). */
export function TrustCounter() {
  return (
    <section className="trust">
      <div className="wrap">
        <div className="counts">
          {COUNTS.map((c) => (
            <div className="count" key={c.label}>
              <Count to={c.to} unit={c.unit} />
              <div className="l">{c.label}</div>
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
    <div className="n" ref={ref}>
      {n.toLocaleString('en-US')}
      {unit ? <span className="u">{unit}</span> : null}
    </div>
  );
}
