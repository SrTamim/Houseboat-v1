'use client';

import { usePathname } from 'next/navigation';
import { OWNER_NAV } from '@/lib/owner/nav';
import { useActiveBoat } from '@/lib/owner/boat-context';
import { Card, EmptyState } from './ui';

/**
 * Client-side page-access gate for the owner console.
 *
 * Derives the current page key from the pathname (matching OWNER_NAV hrefs, the
 * same match usePageTitle uses) and, if the active member lacks view on that
 * page, renders an access-denied card instead of the page body — so a member who
 * types a URL for a page hidden from their sidebar sees a clear message rather
 * than a page whose data calls 403 into a confusing "Could not load" state.
 *
 * Routes with no matching nav entry (onboarding, dynamic detail routes) fall
 * through as allowed; those are gated by their own data calls server-side.
 */
export function ConsolePageGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { canView } = useActiveBoat();

  const match = findNavItem(pathname);
  if (match && !canView(match.key)) {
    return (
      <Card>
        <EmptyState
          icon="🔒"
          title="You don't have access to this page"
          message="Your role on this boat doesn't include this page. Ask an owner or admin to grant it under Team & roles."
        />
      </Card>
    );
  }

  return <>{children}</>;
}

/** The nav item whose href owns this pathname, or undefined. */
function findNavItem(pathname: string) {
  for (const group of OWNER_NAV) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return item;
      }
    }
  }
  return undefined;
}
