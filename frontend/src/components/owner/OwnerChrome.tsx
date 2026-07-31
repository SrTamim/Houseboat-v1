'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api, clearCsrfToken } from '@/lib/api';
import type { OwnerUser } from '@/lib/owner/session';
import { OWNER_LOGIN_PATH } from '@/lib/owner/login-url';
import { OWNER_NAV } from '@/lib/owner/nav';
import { useActiveBoat } from '@/lib/owner/boat-context';
import { initials } from '@/lib/owner/format';
import { ThemeToggle } from '@/components/admin/ThemeToggle';
import { Sidebar } from './Sidebar';

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
    <div className="app">
      <Sidebar open={navOpen} user={displayName} />
      <div className="main">
        <header className="topbar">
          <button
            className="burger"
            onClick={() => setNavOpen((v) => !v)}
            aria-label="Menu"
          >
            ☰
          </button>
          <div>
            <div className="pt">{title}</div>
            <div className="crumb">{boat.name}</div>
          </div>
          <div className="sp" />
          <Link className="icon-btn" href="/owner/notifications" aria-label="Notifications">
            🔔
          </Link>
          <ThemeToggle />
          <div className="whoami">
            <span className="av">{initials(displayName)}</span>
            <div>
              <div className="nm">{displayName}</div>
              <div className="rl">
                {boat.role} · {boat.name}
              </div>
            </div>
          </div>
          <button
            className="icon-btn"
            onClick={signOut}
            disabled={signingOut}
            aria-label="Sign out"
            title="Sign out"
          >
            ⏻
          </button>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
