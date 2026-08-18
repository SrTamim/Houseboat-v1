'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ThemeToggle } from '@/components/admin/ThemeToggle';
import { NAV_BTN_B as BTN_B, NAV_BTN_O as BTN_O } from '@/lib/customer/boat-card';
import { useAuthModal } from '@/components/customer/AuthModalProvider';

export interface NavUser {
  name: string | null;
  phone: string;
}

/**
 * Glass top bar shared by every customer page. Rebuilt in Tailwind from the
 * design preview (`.nav`, haorboat-home-v2.html lines 117–139 + dark 342–348).
 * When a session is known (from the server layout) it shows the account entry;
 * otherwise Login / Register open the auth modal in place — they are buttons,
 * not links, because customer sign-in is no longer a page.
 * `ThemeToggle` keeps its shared `.theme-btn` CSS.
 */
export function CustomerNav({ user }: { user?: NavUser | null }) {
  const [open, setOpen] = useState(false);
  const { openAuth } = useAuthModal();
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
              <button
                type="button"
                onClick={() => openAuth('login')}
                className={BTN_O}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => openAuth('register')}
                className={`btn-sheen ${BTN_B}`}
              >
                Register
              </button>
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
