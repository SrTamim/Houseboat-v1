'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api, clearCsrfToken } from '@/lib/api';
import type { AdminUser } from '@/lib/admin/session';
import { LOGIN_PATH } from '@/lib/admin/login-url';
import { Sidebar } from './Sidebar';
import { ThemeToggle } from './ThemeToggle';

/** "Rafiq Ahmed" → "RA". Falls back to the phone when there's no name. */
function initials(user: AdminUser): string {
  const source = user.name?.trim() || user.phone;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

// The admin shell: sidebar + glass topbar + main content slot.
// Client component so the mobile burger and theme toggle work.
export function AdminChrome({
  user,
  children,
}: {
  user: AdminUser;
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await api.post('/auth/logout');
    } catch {
      // Even if the call fails, clear local state and leave — the cookies are
      // HttpOnly, so the server is the only thing that can truly revoke them,
      // but stranding the user in the console is worse.
    } finally {
      // The hb_sid this token was minted against is gone.
      clearCsrfToken();
      // Hard navigation, not router.replace(). The console layout is a Server
      // Component that reads the auth cookie; a client-side navigation can
      // render from the router cache before the cleared cookie takes effect,
      // briefly showing the console to a signed-out user. Same reasoning as the
      // post-login navigation in app/admin/login/page.tsx.
      window.location.assign(LOGIN_PATH);
    }
  }

  return (
    <div className="app">
      <Sidebar open={navOpen} />
      <div className="main">
        <header className="topbar">
          <button className="burger" onClick={() => setNavOpen((v) => !v)} aria-label="Menu">
            ☰
          </button>
          <div className="sp" />
          <Link className="icon-btn" href="/admin/notifications" aria-label="Notifications">
            🔔<span className="dot" />
          </Link>
          <ThemeToggle />
          <div className="whoami">
            <span className="av">{initials(user)}</span>
            <div>
              <div className="nm">{user.name ?? user.phone}</div>
              <div className="rl">Platform</div>
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
