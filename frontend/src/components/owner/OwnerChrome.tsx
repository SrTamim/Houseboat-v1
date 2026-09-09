'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { api, clearCsrfToken } from '@/lib/api';
import { flushQueue, isOnline } from '@/lib/owner/sync-runner';
import type { OwnerUser } from '@/lib/owner/session';
import { OWNER_LOGIN_PATH } from '@/lib/owner/login-url';
import { OWNER_NAV } from '@/lib/owner/nav';
import { useActiveBoat } from '@/lib/owner/boat-context';
import { initials } from '@/lib/owner/format';
import { ThemeToggle } from '@/components/admin/ThemeToggle';
import { Sidebar } from './Sidebar';
import { ConsolePageGuard } from './ConsolePageGuard';
import { CONTENT, ICON_BTN } from './styles';

/** Page title + subtitle for the topbar, derived from the current route. */
function usePageTitle(): string {
  const pathname = usePathname();
  for (const group of OWNER_NAV) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return item.label;
      }
    }
  }
  return 'Owner console';
}

/**
 * The owner shell: sidebar + glass topbar + content slot.
 *
 * A client component because the mobile burger, theme toggle and boat switcher
 * all need state. The authorization decision already happened in the server
 * layout above it.
 */
export function OwnerChrome({
  user,
  children,
}: {
  user: OwnerUser;
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { boat } = useActiveBoat();
  const title = usePageTitle();

  // Drain the offline capture queue when connectivity returns (and once on
  // load, to clear any backlog left from a previous offline session). This is
  // the single console-wide flush point; flushQueue no-ops when offline/empty,
  // dedupes server-side, and removes only confirmed intents, so it is safe to
  // run alongside the manual "Sync now" on the Offline sync page.
  useEffect(() => {
    const onOnline = () => {
      void flushQueue();
    };
    window.addEventListener('online', onOnline);
    if (isOnline()) void flushQueue();
    return () => window.removeEventListener('online', onOnline);
  }, []);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await api.post('/auth/logout');
    } catch {
      // Even if the call fails, clear local state and leave. The cookies are
      // HttpOnly so only the server can truly revoke them, but stranding the
      // user inside the console is the worse outcome.
    } finally {
      // The hb_sid this CSRF token was minted against is gone.
      clearCsrfToken();
      // Hard navigation, not router.replace(): the console layout is a Server
      // Component that reads the auth cookie, and a client-side navigation can
      // render from the router cache before the cleared cookie takes effect,
      // briefly showing the console to a signed-out user.
      window.location.assign(OWNER_LOGIN_PATH);
    }
  }

  const displayName = user.name ?? user.phone;

  return (
    <div className="grid min-h-screen grid-cols-[var(--sbw)_1fr] max-[1024px]:grid-cols-[1fr]">
      <Sidebar open={navOpen} user={displayName} />
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 flex h-[var(--hh)] items-center gap-3.5 border-b border-hair px-6 [background:color-mix(in_srgb,var(--bg)_72%,transparent)] [backdrop-filter:saturate(180%)_blur(16px)] [-webkit-backdrop-filter:saturate(180%)_blur(16px)] print:hidden">
          <button
            className="hidden h-10 w-10 rounded border border-hair bg-raise-1 text-[17px] text-ink max-[1024px]:grid max-[1024px]:place-items-center"
            onClick={() => setNavOpen((v) => !v)}
            aria-label="Menu"
          >
            ☰
          </button>
          <div>
            <div className="font-display text-[19px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
              {title}
            </div>
            <div className="mt-px text-[12px] font-medium text-muted">{boat.name}</div>
          </div>
          <div className="flex-1" />
          <ThemeToggle />
          <div className="flex items-center gap-2.5 rounded-full border border-hair bg-raise-1 py-[5px] pl-[5px] pr-3 shadow-e1">
            <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[linear-gradient(145deg,var(--blue),var(--blue-700))] text-[12px] font-bold text-white">
              {initials(displayName)}
            </span>
            <div>
              <div className="text-[13px] font-semibold leading-[1.15] text-ink max-[560px]:hidden">
                {displayName}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.05em] text-blue max-[560px]:hidden">
                {boat.role} · {boat.name}
              </div>
            </div>
          </div>
          <button
            className={ICON_BTN}
            onClick={signOut}
            disabled={signingOut}
            aria-label="Sign out"
            title="Sign out"
          >
            ⏻
          </button>
        </header>
        {/* Content slot. `CONTENT` carries the padding, max-width, the ≤560px
            padding rule, the page-load stagger (rise + nth-child delays), and
            the reduced-motion opt-out — all as Tailwind (was owner.css
            `.content` / `.content > *`). */}
        <main className={CONTENT}>
          <ConsolePageGuard>{children}</ConsolePageGuard>
        </main>
      </div>
    </div>
  );
}
