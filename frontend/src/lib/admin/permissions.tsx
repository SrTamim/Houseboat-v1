'use client';

import { createContext, useContext, useMemo } from 'react';
import type { PlatformPermissionMap } from '@/lib/admin/session';

/**
 * Client-side platform permission context for the admin console. Mirrors the
 * owner console's boat-context canView/canEdit. Backs sidebar nav-gating and the
 * per-page ConsolePageGuard. Backend guards remain the real enforcement — this
 * is UX so restricted staff don't see links/pages that would 403.
 */
interface AdminPermsValue {
  canView: (page: string) => boolean;
  canEdit: (page: string) => boolean;
}

const AdminPermsContext = createContext<AdminPermsValue | null>(null);

// Always-reachable pages regardless of role: the console landing and its
// notifications shortcut in the topbar. `dashboard` matches the owner console's
// always-visible landing.
const ALWAYS_VIEW = new Set(['dashboard']);

export function AdminPermsProvider({
  permissions,
  children,
}: {
  permissions: PlatformPermissionMap | null | undefined;
  children: React.ReactNode;
}) {
  const value = useMemo<AdminPermsValue>(() => {
    // null/absent map = superadmin or older payload → allow everything.
    const canView = (page: string) => {
      if (ALWAYS_VIEW.has(page)) return true;
      if (!permissions) return true;
      return Boolean(permissions[page]?.view);
    };
    const canEdit = (page: string) => {
      if (!permissions) return true;
      return Boolean(permissions[page]?.edit);
    };
    return { canView, canEdit };
  }, [permissions]);

  return (
    <AdminPermsContext.Provider value={value}>
      {children}
    </AdminPermsContext.Provider>
  );
}

export function useAdminPerms(): AdminPermsValue {
  const ctx = useContext(AdminPermsContext);
  // Fail open if a component renders outside the provider — never hard-lock the
  // console on a wiring mistake.
  return ctx ?? { canView: () => true, canEdit: () => true };
}
