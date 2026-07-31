'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { OWNER_NAV } from '@/lib/owner/nav';
import { useActiveBoat } from '@/lib/owner/boat-context';
import { BoatSwitcher } from './BoatSwitcher';

/** Only the slice of the dashboard response the sidebar needs. */
interface BadgeResponse {
  badges?: Record<string, number>;
}

export function Sidebar({ open, user }: { open: boolean; user: string }) {
  const pathname = usePathname();
  const { boatId, boat } = useActiveBoat();

  // Badge counts ride on the dashboard call the chrome makes anyway. One shared
  // SWR key for the whole console beats a count endpoint per nav item.
  const { data } = useSWR<BadgeResponse>(
    `/houseboats/${boatId}/dashboard`,
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const badges = data?.badges ?? {};

  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <div className="sb-logo">
        <span className="mark">⚓</span> Haor<span className="b">Boat</span>{' '}
        <span className="tag">Owner</span>
      </div>

      <BoatSwitcher />

      <nav className="sb-nav">
        {OWNER_NAV.map((group) => (
          <div key={group.group}>
            <div className="sb-group">{group.group}</div>
            {group.items.map((item) => {
              // Exact match or a nested route below it — /owner/bookings must
              // stay lit while a detail page under it is open.
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const count = item.badge ? badges[item.badge] : undefined;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`sb-link${active ? ' on' : ''}`}
                >
                  <span className="ic">{item.icon}</span> {item.label}
                  {count ? (
                    <span className={`ct${item.badgeWarn ? ' warn' : ''}`}>{count}</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sb-foot">
        {user} · {boat.role} · {boat.name}
      </div>
    </aside>
  );
}
