'use client';

// Controlled permission matrix for PLATFORM roles. Mirrors the backend's
// PLATFORM_MODULES union (backend/src/platform/rbac/platform-permission.types.ts)
// and its "edit implies view" semantics — ticking edit auto-ticks view so the
// UI never shows a state the guard treats differently.

export const PLATFORM_MODULES = [
  { key: 'boats', label: 'Boats', hint: 'moderation · routes' },
  { key: 'finance', label: 'Finance', hint: 'invoices · payouts · refunds · billing · coupons' },
  { key: 'ops', label: 'Operations', hint: 'bookings · waitlist · reviews · notifications · audit' },
  { key: 'accounts', label: 'Accounts', hint: 'account + membership directory' },
  { key: 'roles', label: 'Roles', hint: 'platform RBAC management' },
  { key: 'settings', label: 'Settings', hint: 'config status' },
] as const;

export type PlatformPermissionMap = Partial<
  Record<string, { view?: boolean; edit?: boolean }>
>;

export function PlatformPermMatrix({
  value,
  onChange,
  disabled = false,
}: {
  value: PlatformPermissionMap;
  onChange: (next: PlatformPermissionMap) => void;
  disabled?: boolean;
}) {
  function set(module: string, action: 'view' | 'edit', checked: boolean) {
    const current = value[module] ?? {};
    const next = { ...current, [action]: checked };
    // edit ⊇ view: granting edit grants view; revoking view revokes edit.
    if (action === 'edit' && checked) next.view = true;
    if (action === 'view' && !checked) next.edit = false;
    onChange({ ...value, [module]: next });
  }

  return (
    <div className="tbl-wrap">
      <table className="tbl" style={{ minWidth: 0 }}>
        <thead>
          <tr>
            <th>Section</th>
            <th style={{ width: 90 }}>View</th>
            <th style={{ width: 90 }}>Edit</th>
          </tr>
        </thead>
        <tbody>
          {PLATFORM_MODULES.map((m) => {
            const perms = value[m.key] ?? {};
            return (
              <tr key={m.key}>
                <td>
                  <div className="t1">{m.label}</div>
                  <div className="t2">{m.hint}</div>
                </td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`${m.label} view`}
                    checked={perms.view === true}
                    disabled={disabled}
                    onChange={(e) => set(m.key, 'view', e.target.checked)}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`${m.label} edit`}
                    checked={perms.edit === true}
                    disabled={disabled}
                    onChange={(e) => set(m.key, 'edit', e.target.checked)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
