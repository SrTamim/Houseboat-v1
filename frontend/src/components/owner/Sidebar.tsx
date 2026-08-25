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
  const { boatId, boat, canView } = useActiveBoat();

  // Badge counts ride on the dashboard call the chrome makes anyway. One shared
  // SWR key for the whole console beats a count endpoint per nav item.
  const { data } = useSWR<BadgeResponse>(
    `/houseboats/${boatId}/dashboard`,
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const badges = data?.badges ?? {};

    return (
    <aside
      className={`owner-scroll sticky top-0 flex h-screen flex-col overflow-y-auto border-r border-hair bg-bg text-bodytext [scrollbar-width:thin] print:hidden max-[1024px]:fixed max-[1024px]:left-0 max-[1024px]:top-0 max-[1024px]:z-[70] max-[1024px]:w-[var(--sbw)] max-[1024px]:shadow-e3 max-[1024px]:transition-transform max-[1024px]:duration-dur max-[1024px]:ease-ease ${
        open ? 'max-[1024px]:translate-x-0' : 'max-[1024px]:-translate-x-full'
      }`}
    >
      <div className="flex items-center gap-[11px] px-5 py-[18px] font-display text-[19px] font-bold tracking-[-0.03em] text-ink">
        <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[11px] bg-[linear-gradient(145deg,var(--blue),var(--blue-700))] text-[16px] text-white shadow-[0_6px_14px_-6px_var(--blue),var(--top-hi)]">
          ⚓
        </span>{' '}
        Haor<span className="text-blue">Boat</span>{' '}
        <span className="ml-auto rounded-md border border-hair px-[7px] py-[3px] font-sans text-[9px] font-bold uppercase tracking-[0.09em] text-muted">
          Owner
        </span>
      </div>

      <BoatSwitcher />

      <nav className="flex-1 px-3 pb-4 pt-2">
        {OWNER_NAV.map((group) => {
          // Hide links the member can't view; drop the whole group if that
          // empties it, so no orphan section header renders.
          const items = group.items.filter((item) => canView(item.key));
          if (items.length === 0) return null;
          return (
          <div key={group.group}>
            <div className="mx-0 mb-[7px] mt-[18px] px-3 text-[10px] font-bold uppercase tracking-[0.11em] text-muted">
              {group.group}
            </div>
            {items.map((item) => {
              // Exact match or a nested route below it — /owner/bookings must
              // stay lit while a detail page under it is open.
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const count = item.badge ? badges[item.badge] : undefined;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`group relative flex items-center gap-[11px] rounded px-3 py-2 text-[13.5px] transition-[background,color] duration-dur ease-ease ${
                    active
                      ? "font-semibold text-blue bg-[color-mix(in_srgb,var(--blue)_10%,transparent)] before:absolute before:-left-3 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-[3px] before:bg-blue before:content-['']"
                      : 'font-medium text-bodytext hover:bg-hover hover:text-ink'
                  }`}
                >
                  <span
                    className={`grid h-5 w-5 flex-none place-items-center text-[14px] ${
                      active ? 'opacity-100' : 'opacity-[0.72] grayscale-[0.35]'
                    }`}
                  >
                    {item.icon}
                  </span>{' '}
                  {item.label}
                  {count ? (
                    <span
                      className={`ml-auto rounded-full px-2 py-px text-[11px] font-bold tabular-nums ${
                        item.badgeWarn
                          ? 'bg-[color-mix(in_srgb,var(--amber)_20%,transparent)] text-amber-700 dark:text-amber'
                          : active
                            ? 'bg-[color-mix(in_srgb,var(--blue)_18%,transparent)] text-blue'
                            : 'bg-chip text-bodytext'
                      }`}
                    >
                      {count}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
          );
        })}
      </nav>

      <div className="border-t border-hair px-[18px] py-3.5 text-[11.5px] text-muted">
        {user} · {boat.role} · {boat.name}
      </div>
    </aside>
  );
}
