'use client';

import { usePathname } from 'next/navigation';
import { NAV } from '@/lib/admin/nav';
import type { NavItem } from '@/lib/admin/nav';
import { useAdminPerms } from '@/lib/admin/permissions';
import { Card, EmptyState } from './ui';

/**
 * Client-side page-access gate for the admin console. Derives the current page
 * key from the pathname (matching a NAV item's href) and, if the staffer's role
 * lacks view on that page, renders an access-denied card instead of the page
 * body — so a staffer who types a URL for a page hidden from their sidebar gets
 * a clear message rather than a page whose data calls 403 into a "Could not
 * load" state. Backend guards remain the real enforcement.
 *
 * Routes with no matching NAV entry (dynamic detail routes, if any) fall through
 * as allowed; those are gated by their own data calls.
 */
export function ConsolePageGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { canView } = useAdminPerms();

  const match = findNavItem(pathname);
  if (match && !canView(match.key)) {
    return (
      <Card>
        <EmptyState
          icon="🔒"
          title="You don't have access to this page"
          desc="Your platform role doesn't include this page. Ask a superadmin to grant it under Roles."
        />
      </Card>
    );
  }

  return <>{children}</>;
}

/** The NAV item whose href owns this pathname, or undefined. Longest match wins. */
function findNavItem(pathname: string): NavItem | undefined {
  const items: NavItem[] = NAV.flatMap((grp) =>
    grp.items ?? (grp.subgroups ?? []).flatMap((sub) => sub.items),
  );
  let best: NavItem | undefined;
  for (const item of items) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (!best || item.href.length > best.href.length) best = item;
    }
  }
  return best;
}
