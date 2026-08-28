'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { api, clearCsrfToken, fetcher } from '@/lib/api';
import type { NotificationItem, WaitlistEntry } from '@/lib/customer/types';

type BadgeKind = 'blue' | 'warn';

const LINKS: {
  href: string;
  icon: string;
  label: string;
  badge?: BadgeKind;
}[] = [
  { href: '/account/trips', icon: '🎟️', label: 'My trips' },
  { href: '/account/quotes', icon: '💬', label: 'Custom quotes' },
  { href: '/account/wallet', icon: '💳', label: 'Wallet & credits' },
  { href: '/account/waitlist', icon: '⏳', label: 'Waitlist', badge: 'warn' },
  { href: '/account/notifications', icon: '🔔', label: 'Notifications', badge: 'blue' },
  { href: '/account/profile', icon: '👤', label: 'Profile' },
];

/**
 * Account-area sidebar (design: `.side`/`.slink` in haorboat-account-*.html),
 * rebuilt in Tailwind. Badges (design `.ct` / `.ct.warn`) show live counts:
 * unread notifications (blue) and open waitlist entries (amber). Both reuse the
 * same SWR keys the pages themselves use, so the cache is shared — no extra
 * network round-trips beyond what the pages already do.
 */
export function AccountSidebar() {
  const pathname = usePathname();

  const { data: notifications } = useSWR<NotificationItem[]>('/me/notifications', fetcher, {
    revalidateOnFocus: false,
  });
  const { data: waitlist } = useSWR<WaitlistEntry[]>('/booking/waitlist', fetcher, {
    revalidateOnFocus: false,
  });

  const unread = notifications?.filter((n) => !n.readAt).length ?? 0;
  const waiting = waitlist?.length ?? 0;

  const counts: Record<string, number> = {
    '/account/notifications': unread,
    '/account/waitlist': waiting,
  };

  const signOut = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {}
    clearCsrfToken();
    window.location.assign('/');
  };

  return (
    <aside className="rounded-2xl border border-hair bg-raise-1 p-2.5 shadow-e1 md:sticky md:top-[94px] max-md:flex max-md:gap-1 max-md:overflow-x-auto">
      <div className="px-3 pb-1.5 pt-3 text-[11px] font-bold uppercase tracking-[0.06em] text-muted max-md:hidden">
        My account
      </div>
      {LINKS.map((l) => {
        const active = pathname.startsWith(l.href);
        const count = l.badge ? counts[l.href] ?? 0 : 0;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`flex items-center gap-[11px] rounded px-3 py-[11px] text-[14.5px] font-semibold transition-colors max-md:flex-none ${
              active
                ? 'bg-[color-mix(in_srgb,var(--blue)_10%,transparent)] text-blue'
                : 'text-bodytext hover:bg-bg hover:text-ink'
            }`}
          >
            <span className="w-5 text-center text-base">{l.icon}</span>
            <span className="whitespace-nowrap">{l.label}</span>
            {l.badge && count > 0 ? (
              <span
                className={`ml-auto grid h-5 min-w-[20px] place-items-center rounded-full px-1.5 text-[11px] font-extrabold ${
                  l.badge === 'warn' ? 'bg-amber text-[#3a2a00]' : 'bg-blue text-white'
                }`}
              >
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
      <div className="mt-1.5 border-t border-hair p-3 max-md:hidden">
        <button
          className="flex w-full items-center gap-[11px] rounded px-3 py-[11px] text-left text-[14.5px] font-semibold text-bodytext transition-colors hover:bg-bg hover:text-ink"
          onClick={signOut}
        >
          <span className="w-5 text-center text-base">↩</span> Sign out
        </button>
      </div>
    </aside>
  );
}
