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

  const MENU_ITEM =
    'flex w-full items-center gap-2.5 rounded-sm border-none bg-none px-[11px] py-[9px] text-left text-[13.5px] font-semibold text-ink hover:bg-hover';
  return (
    <div
      className="relative mx-3 mb-1.5 mt-1 rounded-xl border border-hair bg-raise-1 shadow-e1"
      ref={ref}
    >
      <button
        className="flex w-full items-center gap-[11px] rounded-xl border-none bg-none px-[11px] py-[9px] text-left text-bodytext"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-[linear-gradient(145deg,var(--amber),var(--amber-700))] text-[16px] text-[#3a2a00] shadow-top-hi">
          ⛵
        </span>
        <span>
          <span className="block text-[14px] font-semibold leading-[1.15] text-ink">
            {boat.name}
          </span>
          <span className="mt-px block text-[10.5px] font-semibold uppercase tracking-[0.04em] text-muted">
            {boat.role} · {boat.status}
          </span>
        </span>
        <span className="ml-auto text-[12px] text-muted">▾</span>
      </button>

      <div
        role="menu"
        className={`absolute left-0 right-0 top-[calc(100%+6px)] z-[60] overflow-hidden rounded-xl border border-hair bg-raise-2 p-1.5 shadow-e3 ${
          open ? 'block' : 'hidden'
        }`}
      >
        {boats.map((b) => (
          <button
            key={b.houseboatId}
            role="menuitem"
            className={MENU_ITEM}
            onClick={() => {
              setBoatId(b.houseboatId);
              setOpen(false);
            }}
          >
            <span
              className={`h-2 w-2 flex-none rounded-full ${b.status === 'live' ? 'bg-ok' : 'bg-muted'}`}
            />
            {b.name}
            <span className="ml-auto text-[11px] font-semibold text-muted">{b.status}</span>
          </button>
        ))}
        <div className="mx-1 my-1.5 h-px bg-hair" />
        <Link className={`${MENU_ITEM} text-blue`} href="/owner/onboarding" role="menuitem">
          ＋ Add a boat
        </Link>
      </div>
    </div>
  );
}
