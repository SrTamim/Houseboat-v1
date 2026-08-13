'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ThemeToggle } from '@/components/admin/ThemeToggle';

export interface NavUser {
  name: string | null;
  phone: string;
}

/** Outlined button (`.btn.btn-o`) — preview lines 106–113. */
const BTN_O =
  'inline-flex items-center gap-2 whitespace-nowrap rounded border border-hair bg-raise-1 px-[22px] py-[11px] text-[14.5px] font-semibold leading-none text-ink shadow-e1 transition-[background,border-color,box-shadow,transform] duration-dur ease-ease hover:border-[color-mix(in_srgb,var(--blue)_45%,var(--hair))] hover:bg-[color-mix(in_srgb,var(--blue)_6%,var(--raise-1))] hover:text-blue active:translate-y-[.5px]';

/** Primary button (`.btn.btn-b`) — preview lines 106–111. */
const BTN_B =
  'inline-flex items-center gap-2 whitespace-nowrap rounded border border-transparent bg-blue px-[22px] py-[11px] text-[14.5px] font-semibold leading-none text-white shadow-[var(--e1),inset_0_1px_0_rgba(255,255,255,.18)] transition-[background,border-color,box-shadow,transform] duration-dur ease-ease hover:bg-blue-600 active:translate-y-[.5px]';

/**
 * Glass top bar shared by every customer page. Rebuilt in Tailwind from the
 * design preview (`.nav`, haorboat-home-v2.html lines 117–139 + dark 342–348).
 * When a session is known (from the server layout) it shows the account entry
 * instead of Login / Register. `ThemeToggle` keeps its shared `.theme-btn` CSS.
 */
export function CustomerNav({ user }: { user?: NavUser | null }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-[60] border-b border-hair bg-[color-mix(in_srgb,var(--bg)_72%,transparent)] backdrop-blur-[16px] backdrop-saturate-[180%] [-webkit-backdrop-filter:saturate(180%)_blur(16px)] dark:border-b-[color-mix(in_srgb,var(--blue)_14%,var(--hair))] dark:bg-[color-mix(in_srgb,var(--bg)_62%,transparent)]">
      <div className="mx-auto flex h-[72px] max-w-wrap items-center gap-6 px-6">
        <Link
          href="/"
          className="flex items-center gap-[11px] font-display text-[22px] font-bold tracking-[-0.03em] text-ink"
        >
          <span className="grid h-[38px] w-[38px] place-items-center rounded-xl bg-[linear-gradient(145deg,var(--blue),var(--blue-700))] text-[17px] text-white shadow-[0_6px_14px_-6px_var(--blue),var(--top-hi)] dark:shadow-[0_6px_18px_-4px_rgba(90,160,255,.55),var(--top-hi)]">
            🛥
          </span>
          Haor<span className="font-bold text-blue">Boat</span>
        </Link>

        <nav className="flex flex-1 justify-center gap-8 text-[14.5px] font-medium text-bodytext max-[940px]:hidden">
          <Link
            href="/about"
            className="inline-flex items-center gap-[5px] py-2 transition-colors duration-dur ease-ease hover:text-blue"
          >
            About
          </Link>
          <Link
            href="/help"
            className="inline-flex items-center gap-[5px] py-2 transition-colors duration-dur ease-ease hover:text-blue"
          >
            Help
          </Link>
          <Link
            href="/owner/signup"
            className="inline-flex items-center gap-[5px] py-2 transition-colors duration-dur ease-ease hover:text-blue"
          >
            Become a host
          </Link>
        </nav>

        <div className="flex items-center gap-3 max-[940px]:ml-auto">
          <ThemeToggle />
          {user ? (
            <Link href="/account/trips" className={BTN_O}>
              👤 {user.name?.split(' ')[0] ?? 'Account'}
            </Link>
          ) : (
            <>
              <Link href="/account/login" className={BTN_O}>
                Login
              </Link>
              <Link href="/account/register" className={`btn-sheen ${BTN_B}`}>
                Register
              </Link>
            </>
          )}
          <button
            className="hidden h-11 w-11 rounded border border-hair bg-raise-1 text-[20px] text-ink shadow-e1 max-[940px]:grid max-[940px]:place-items-center"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            ☰
          </button>
        </div>
      </div>
    </header>
  );
}
