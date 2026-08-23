'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api, clearCsrfToken } from '@/lib/api';
import type { AdminUser } from '@/lib/admin/session';
import { LOGIN_PATH } from '@/lib/admin/login-url';
import { Sidebar } from './Sidebar';
import { ThemeToggle } from './ThemeToggle';
import { ICON_BTN } from './styles';

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
    <div className="grid min-h-screen grid-cols-[var(--sbw)_1fr] max-[1024px]:grid-cols-[1fr]">
      <Sidebar open={navOpen} />
      <div className="flex min-w-0 flex-col">
        {/* Glass topbar (was `.topbar`). Hidden in print so an open drawer prints alone. */}
        <header className="sticky top-0 z-40 flex h-[var(--hh)] items-center gap-[14px] border-b border-hair bg-[color-mix(in_srgb,var(--bg)_72%,transparent)] px-6 backdrop-blur-[16px] [backdrop-filter:saturate(180%)_blur(16px)] print:hidden">
          {/* Burger only on mobile (was `.burger` display:none / grid ≤1024px). */}
          <button
            className="hidden h-10 w-10 place-items-center rounded border border-hair bg-raise-1 text-[17px] text-ink max-[1024px]:grid"
            onClick={() => setNavOpen((v) => !v)}
            aria-label="Menu"
          >
            ☰
          </button>
          <div className="flex-1" />
          <Link className={ICON_BTN} href="/admin/notifications" aria-label="Notifications">
            🔔
            {/* Unread dot (was `.icon-btn .dot`). */}
            <span className="absolute right-[9px] top-2 h-2 w-2 rounded-full border-2 border-bg bg-danger" />
          </Link>
          <ThemeToggle />
          {/* Signed-in chip (was `.whoami`). */}
          <div className="flex items-center gap-2.5 rounded-full border border-hair bg-raise-1 py-[5px] pl-[5px] pr-3 shadow-e1">
            <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[linear-gradient(145deg,var(--blue),var(--blue-700))] text-[12px] font-bold text-white">
              {initials(user)}
            </span>
            <div className="max-[560px]:hidden">
              <div className="text-[13px] font-semibold leading-[1.15] text-ink">
                {user.name ?? user.phone}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.05em] text-blue">
                Platform
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
        {/* Content well + staggered load-in (was `.content` + `.content > *` rise). */}
        <main className="w-full max-w-[1360px] px-6 py-7 max-[560px]:px-4 max-[560px]:py-[18px] [&>*]:motion-safe:animate-rise [&>*:nth-child(2)]:[animation-delay:0.04s] [&>*:nth-child(3)]:[animation-delay:0.08s] [&>*:nth-child(4)]:[animation-delay:0.12s] [&>*:nth-child(5)]:[animation-delay:0.16s]">
          {children}
        </main>
      </div>
    </div>
  );
}
