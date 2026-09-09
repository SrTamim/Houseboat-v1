'use client';

// Controlled per-PAGE permission matrix for PLATFORM roles. The catalog is
// derived directly from the admin sidebar NAV (lib/admin/nav.ts) so roles and
// nav stay in lockstep — one key per console page, grouped exactly as the
// sidebar groups them. Mirrors the owner console's PermissionList.
//
// "edit implies view": ticking edit auto-ticks view, and clearing view clears
// edit, so the UI never shows a state the backend guard treats differently.

import { NAV } from '@/lib/admin/nav';
import { TableWrap } from './ui';
import { TD_T1, TD_T2 } from './styles';

export type PlatformPermissionMap = Partial<
  Record<string, { view?: boolean; edit?: boolean }>
>;

// Flat, group-tagged catalog built once from NAV. Subgroups (Finance) fold into
// their parent group heading with the subgroup name appended for context.
type CatalogRow = { key: string; label: string; group: string };

const CATALOG: CatalogRow[] = NAV.flatMap((grp) => {
  if (grp.items) {
    return grp.items.map((it) => ({ key: it.key, label: it.label, group: grp.group }));
  }
  return (grp.subgroups ?? []).flatMap((sub) =>
    sub.items.map((it) => ({
      key: it.key,
      label: it.label,
      group: `${grp.group} · ${sub.subgroup}`,
    })),
  );
});

// Preserve NAV order while grouping rows under their heading.
const GROUPS: { group: string; rows: CatalogRow[] }[] = (() => {
  const order: string[] = [];
  const byGroup = new Map<string, CatalogRow[]>();
  for (const row of CATALOG) {
    if (!byGroup.has(row.group)) {
      byGroup.set(row.group, []);
      order.push(row.group);
    }
    byGroup.get(row.group)!.push(row);
  }
  return order.map((group) => ({ group, rows: byGroup.get(group)! }));
})();

/** Total number of grantable pages — for the roles page summary. */
export const PLATFORM_PAGE_COUNT = CATALOG.length;

export function PlatformPermMatrix({
  value,
  onChange,
  disabled = false,
}: {
  value: PlatformPermissionMap;
  onChange: (next: PlatformPermissionMap) => void;
  disabled?: boolean;
}) {
  function set(page: string, action: 'view' | 'edit', checked: boolean) {
    const current = value[page] ?? {};
    const next = { ...current, [action]: checked };
    // edit ⊇ view: granting edit grants view; revoking view revokes edit.
    if (action === 'edit' && checked) next.view = true;
    if (action === 'view' && !checked) next.edit = false;
    onChange({ ...value, [page]: next });
  }

  return (
    <TableWrap minWidth={0}>
      <thead>
        <tr>
          <th>Page</th>
          <th style={{ width: 90 }}>View</th>
          <th style={{ width: 90 }}>Edit</th>
        </tr>
      </thead>
      <tbody>
        {GROUPS.map((g) => (
          <GroupBlock
            key={g.group}
            group={g.group}
            rows={g.rows}
            value={value}
            disabled={disabled}
            set={set}
          />
        ))}
      </tbody>
    </TableWrap>
  );
}

function GroupBlock({
  group,
  rows,
  value,
  disabled,
  set,
}: {
  group: string;
  rows: CatalogRow[];
  value: PlatformPermissionMap;
  disabled: boolean;
  set: (page: string, action: 'view' | 'edit', checked: boolean) => void;
}) {
  return (
    <>
      <tr>
        <td colSpan={3} className={`${TD_T2} pt-3 font-semibold uppercase tracking-[0.08em]`}>
          {group}
        </td>
      </tr>
      {rows.map((row) => {
        const perms = value[row.key] ?? {};
        return (
          <tr key={row.key}>
            <td>
              <div className={TD_T1}>{row.label}</div>
            </td>
            <td>
              <input
                type="checkbox"
                className="h-[15px] w-[15px] cursor-pointer accent-blue"
                aria-label={`${row.label} view`}
                checked={perms.view === true}
                disabled={disabled}
                onChange={(e) => set(row.key, 'view', e.target.checked)}
              />
            </td>
            <td>
              <input
                type="checkbox"
                className="h-[15px] w-[15px] cursor-pointer accent-blue"
                aria-label={`${row.label} edit`}
                checked={perms.edit === true}
                disabled={disabled}
                onChange={(e) => set(row.key, 'edit', e.target.checked)}
              />
            </td>
          </tr>
        );
      })}
    </>
  );
}
