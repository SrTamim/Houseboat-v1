'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api, clearCsrfToken } from '@/lib/api';

const LINKS = [
  { href: '/account/trips', icon: '🎟️', label: 'My trips' },
  { href: '/account/wallet', icon: '💳', label: 'Wallet & credits' },
  { href: '/account/waitlist', icon: '⏳', label: 'Waitlist' },
  { href: '/account/notifications', icon: '🔔', label: 'Notifications' },
  { href: '/account/profile', icon: '👤', label: 'Profile' },
];

/** Account-area sidebar (design: `.side` in haorboat-account-*.html). */
export function AccountSidebar() {
  const pathname = usePathname();

  const signOut = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {}
    clearCsrfToken();
    window.location.assign('/');
  };

  return (
    <aside className="side">
      <div className="grp">My account</div>
      {LINKS.map((l) => (
        <Link
          key={l.href}
          className={`slink${pathname.startsWith(l.href) ? ' on' : ''}`}
          href={l.href}
        >
          <span className="i">{l.icon}</span> {l.label}
        </Link>
      ))}
      <div className="foot">
        <button className="slink" onClick={signOut} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none' }}>
          <span className="i">↩</span> Sign out
        </button>
      </div>
    </aside>
  );
}
