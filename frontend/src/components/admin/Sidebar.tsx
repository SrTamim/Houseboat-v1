'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { NAV } from '@/lib/admin/nav';

interface Overview {
  pendingBoats: number;
  liveBoats: number;
  invoicesToVerify: number;
  readyForPayout: number;
  refundsInFlight: number;
  waitlisted: number;
}

export function Sidebar({ open }: { open: boolean }) {
  const pathname = usePathname();

  // Live queue counts. Badges simply don't render until the endpoint answers —
  // a stale-looking fake number is worse than no badge.
  const { data: overview } = useSWR<Overview>('/platform/ops/overview', fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 60_000,
  });

  // nav key → live queue size. Only queues that demand human action get a badge.
  const badges: Record<string, { count: number; warn: boolean } | undefined> =
    overview
      ? {
          boats: { count: overview.pendingBoats, warn: true },
          verify: { count: overview.invoicesToVerify, warn: true },
          payouts: { count: overview.readyForPayout, warn: false },
          refunds: { count: overview.refundsInFlight, warn: false },
          waitlist: { count: overview.waitlisted, warn: false },
        }
      : {};

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
              const badge = badges[it.key];
              return (
                <Link key={it.key} href={it.href} className={`sb-link${active ? ' on' : ''}`}>
                  <span className="ic">{it.icon}</span> {it.label}
                  {badge && badge.count > 0 ? (
                    <span className={`ct${badge.warn ? ' warn' : ''}`}>{badge.count}</span>
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
