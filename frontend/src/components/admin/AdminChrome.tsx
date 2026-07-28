'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sidebar } from './Sidebar';
import { ThemeToggle } from './ThemeToggle';

// The admin shell: sidebar + glass topbar + main content slot.
// Client component so the mobile burger and theme toggle work.
export function AdminChrome({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
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
            <span className="av">RA</span>
            <div>
              <div className="nm">Rafiq Ahmed</div>
              <div className="rl">Finance · Platform</div>
            </div>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
