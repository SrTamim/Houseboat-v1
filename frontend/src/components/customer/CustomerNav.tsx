'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ThemeToggle } from '@/components/admin/ThemeToggle';

export interface NavUser {
  name: string | null;
  phone: string;
}

/**
 * Glass top bar shared by every customer page. Ported from the design previews
 * (`.nav`), rendered with escaped JSX bindings — never innerHTML. When a session
 * is known (passed from the server layout) it shows the account entry instead of
 * Login / Register.
 */
export function CustomerNav({ user }: { user?: NavUser | null }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="nav">
      <div className="wrap row">
        <Link className="logo" href="/">
          <span className="mark">🛥</span>Haor<span className="b">Boat</span>
        </Link>
        <nav className="menu">
          <Link href="/search">Houseboats</Link>
          <Link href="/#offers">Offers</Link>
          <Link href="/#about">Help</Link>
        </nav>
        <div className="right">
          <ThemeToggle />
          {user ? (
            <Link className="btn btn-o" href="/account/trips">
              👤 {user.name?.split(' ')[0] ?? 'Account'}
            </Link>
          ) : (
            <>
              <Link className="btn btn-o" href="/account/login">
                Login
              </Link>
              <Link className="btn btn-b" href="/account/register">
                Register
              </Link>
            </>
          )}
          <button
            className="burger"
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
