'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const DESTINATIONS = [
  { label: 'Tanguar Haor', sub: 'Sunamganj, Sylhet' },
  { label: 'Nikli Haor', sub: 'Kishoreganj' },
  { label: 'Padma River', sub: 'Rajshahi' },
  { label: 'Boga Lake', sub: 'Bandarban' },
];

const CHIPS = [
  { icon: '🏝️', label: 'Tanguar Haor' },
  { icon: '🌅', label: 'Nikli Haor' },
  { icon: '🌊', label: 'Padma River' },
  { icon: '⛰️', label: 'Boga Lake' },
  { icon: '🌳', label: 'Sundarban' },
];

/**
 * Wego-style hero + search card (design: haorboat-home-v2.html). The card's
 * fields drive a client-side navigation to /search with the chosen filters as
 * query params — the search page is the authoritative result view.
 */
export function HomeHero() {
  const router = useRouter();
  const [dest, setDest] = useState(0);
  const [ac, setAc] = useState<'ac' | 'nonac' | 'both'>('ac');

  const search = () => {
    const params = new URLSearchParams();
    params.set('route', DESTINATIONS[dest].label);
    if (ac !== 'both') params.set('ac', ac);
    router.push(`/search?${params.toString()}`);
  };

  return (
    <section className="hero">
      <div className="hbg">
        <img
          alt="Sunrise mist over a Bangladesh haor wetland"
          src="https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1920&q=70"
        />
      </div>
      <div className="mist" aria-hidden="true" />
      <div className="mist m2" aria-hidden="true" />
      <div className="wrap">
        <div className="htop">
          <h1>Book a houseboat on Bangladesh&apos;s haors</h1>
        </div>

        <div className="searchzone">
          <div className="stabs">
            <div className="stab on">🛥️ Houseboats</div>
            <div className="stab soon">
              🚌 Bus <span className="nw soon-tag">Soon</span>
            </div>
          </div>

          <div className="searchcard">
            <div className="sgrid">
              <button
                type="button"
                className="field act"
                onClick={() => setDest((d) => (d + 1) % DESTINATIONS.length)}
              >
                <label>📍 Destination</label>
                <div className="val">{DESTINATIONS[dest].label}</div>
                <div className="sub">{DESTINATIONS[dest].sub}</div>
              </button>
              <div className="field">
                <label>📅 Departure</label>
                <div className="val">Pick a date</div>
                <div className="sub">Flexible</div>
              </div>
              <div className="field">
                <label>👤 Guests &amp; cabins</label>
                <div className="val">4 guests</div>
                <div className="sub">2 cabins</div>
              </div>
            </div>
            <div className="srow2">
              <div className="opts">
                <span className="opt-label">Cabin type:</span>
                <div className="seg">
                  <button
                    className={`seg-b${ac === 'ac' ? ' on' : ''}`}
                    onClick={() => setAc('ac')}
                  >
                    AC
                  </button>
                  <button
                    className={`seg-b${ac === 'nonac' ? ' on' : ''}`}
                    onClick={() => setAc('nonac')}
                  >
                    Non-AC
                  </button>
                  <button
                    className={`seg-b${ac === 'both' ? ' on' : ''}`}
                    onClick={() => setAc('both')}
                  >
                    Both
                  </button>
                </div>
              </div>
              <button className="btn btn-b btn-lg" onClick={search}>
                🔍 Search boats
              </button>
            </div>
          </div>

          <div className="chips">
            {CHIPS.map((c) => (
              <a
                key={c.label}
                className="chip"
                href={`/search?route=${encodeURIComponent(c.label)}`}
              >
                {c.icon} {c.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
