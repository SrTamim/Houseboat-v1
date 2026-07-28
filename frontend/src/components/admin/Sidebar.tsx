'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV } from '@/lib/admin/nav';

export function Sidebar({ open }: { open: boolean }) {
  const pathname = usePathname();
  return (
    <aside className={`sidebar${open ? ' open' : ''}`} id="sidebar">
      <div className="sb-logo">
        <span className="mark">⚓</span> Haor<span className="b">Boat</span>{' '}
        <span className="tag">Platform</span>
      </div>
      <nav className="sb-nav">
        {NAV.map((grp) => (
          <div key={grp.group}>
            <div className="sb-group">{grp.group}</div>
            {grp.items.map((it) => {
              const active = pathname === it.href || pathname.startsWith(it.href + '/');
              return (
                <Link key={it.key} href={it.href} className={`sb-link${active ? ' on' : ''}`}>
                  <span className="ic">{it.icon}</span> {it.label}
                  {it.count ? (
                    <span className={`ct${it.countWarn ? ' warn' : ''}`}>{it.count}</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="sb-foot">Signed in as platform staff · UTC+6 (BST)</div>
    </aside>
  );
}
