'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useActiveBoat } from '@/lib/owner/boat-context';

/**
 * Sidebar boat switcher. A person can own one boat and manage another, so the
 * console is always scoped to exactly one and this is how they move between.
 *
 * Switching only changes context — every owner API path already embeds the boat
 * id, so the SWR keys re-key themselves and the whole console refetches.
 */
export function BoatSwitcher() {
  const { boats, boat, setBoatId } = useActiveBoat();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on any outside click. Registered on the document rather than a scrim
  // so the menu doesn't trap clicks aimed at the nav beneath it.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div className={`boatsw${open ? ' open' : ''}`} ref={ref}>
      <button
        className="boatsw-btn"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="bav">⛵</span>
        <span>
          <span className="bn">{boat.name}</span>
          <span className="bm">
            {boat.role} · {boat.status}
          </span>
        </span>
        <span className="cv">▾</span>
      </button>

      <div className="boatsw-menu" role="menu">
        {boats.map((b) => (
          <button
            key={b.houseboatId}
            role="menuitem"
            onClick={() => {
              setBoatId(b.houseboatId);
              setOpen(false);
            }}
          >
            <span className={`dot${b.status === 'live' ? '' : ' mut'}`} />
            {b.name}
            <span className="sub">{b.status}</span>
          </button>
        ))}
        <div className="sep" />
        <Link className="add" href="/owner/onboarding" role="menuitem">
          ＋ Add a boat
        </Link>
      </div>
    </div>
  );
}
