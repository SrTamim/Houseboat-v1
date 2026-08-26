'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { NAV } from '@/lib/admin/nav';
import type { NavItem } from '@/lib/admin/nav';

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

  // One nav link. Shared by flat groups and subgrouped ones (Finance) so
  // active-state, badges and icon rendering stay identical across both.
  const renderItem = (it: NavItem) => {
    const active = pathname === it.href || pathname.startsWith(it.href + '/');
    const badge = badges[it.key];
    return (
      <Link
        key={it.key}
        href={it.href}
        className={`relative flex items-center gap-[11px] rounded px-3 py-2 text-[13.5px] transition-[background,color] duration-dur ease-ease ${
          active
            ? "font-semibold bg-[color-mix(in_srgb,var(--blue)_10%,transparent)] text-blue before:absolute before:-left-3 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-[0_3px_3px_0] before:bg-blue before:content-['']"
            : 'font-medium text-bodytext hover:bg-hover hover:text-ink'
        }`}
      >
        <span
          className={`grid h-5 w-5 flex-none place-items-center text-[14px] ${
            active ? 'opacity-100' : 'opacity-[0.72] grayscale-[0.35]'
          }`}
        >
          {it.icon}
        </span>{' '}
        {it.label}
        {badge && badge.count > 0 ? (
          <span
            className={`ml-auto rounded-full px-2 py-px text-[11px] font-bold tabular-nums ${
              badge.warn
                ? 'bg-[color-mix(in_srgb,var(--amber)_20%,transparent)] text-amber-700 dark:text-amber'
                : active
                  ? 'bg-[color-mix(in_srgb,var(--blue)_18%,transparent)] text-blue'
                  : 'bg-chip text-bodytext'
            }`}
          >
            {badge.count}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <aside
      id="sidebar"
      className={`sticky top-0 flex h-screen flex-col overflow-y-auto border-r border-hair bg-bg text-bodytext [scrollbar-width:thin] print:hidden max-[1024px]:fixed max-[1024px]:left-0 max-[1024px]:top-0 max-[1024px]:z-[70] max-[1024px]:w-[var(--sbw)] max-[1024px]:shadow-e3 max-[1024px]:transition-transform max-[1024px]:duration-dur max-[1024px]:ease-ease ${
        open ? 'max-[1024px]:translate-x-0' : 'max-[1024px]:-translate-x-full'
      }`}
    >
      <div className="flex items-center gap-[11px] px-5 py-[18px] font-display text-[19px] font-bold tracking-[-0.03em] text-ink">
        <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[11px] bg-[linear-gradient(145deg,var(--blue),var(--blue-700))] text-[16px] text-white shadow-[0_6px_14px_-6px_var(--blue),var(--top-hi)]">
          ⚓
        </span>{' '}
        Haor<span className="text-blue">Boat</span>{' '}
        <span className="ml-auto rounded-md border border-hair px-[7px] py-[3px] font-sans text-[9px] font-bold uppercase tracking-[0.09em] text-muted">
          Platform
        </span>
      </div>
      <nav className="flex-1 px-3 pb-4 pt-2">
        {NAV.map((grp) => (
          <div key={grp.group}>
            <div className="mb-[7px] mt-[18px] px-3 text-[10px] font-bold uppercase tracking-[0.11em] text-muted">
              {grp.group}
            </div>
            {grp.subgroups
              ? grp.subgroups.map((sub) => (
                  <div key={sub.subgroup}>
                    <div className="mb-[3px] mt-2.5 flex items-center gap-2 px-3 text-[9.5px] font-semibold uppercase tracking-[0.09em] text-muted/80 before:h-px before:w-2.5 before:bg-hair before:content-['']">
                      {sub.subgroup}
                    </div>
                    {sub.items.map(renderItem)}
                  </div>
                ))
              : grp.items?.map(renderItem)}
          </div>
        ))}
      </nav>
      <div className="border-t border-hair px-[18px] py-[14px] text-[11.5px] text-muted">
        Signed in as platform staff · UTC+6 (BST)
      </div>
    </aside>
  );
}
