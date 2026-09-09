'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import {
  PageHead,
  Card,
  TableWrap,
  TableSkeleton,
  EmptyState,
  ErrorState,
  Note,
} from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';
import { Drawer } from '@/components/admin/Drawer';
import {
  PlatformPermMatrix,
  PLATFORM_PAGE_COUNT,
  type PlatformPermissionMap,
} from '@/components/admin/PlatformPermMatrix';

/** Drop pages that grant nothing, so a stored map only lists granted pages. */
function grantedOnly(perms: PlatformPermissionMap): PlatformPermissionMap {
  const out: PlatformPermissionMap = {};
  for (const [page, p] of Object.entries(perms)) {
    if (p?.view || p?.edit) out[page] = p;
  }
  return out;
}
import { useAdminList } from '@/lib/admin/useAdminList';
import { apiErrorMessage } from '@/lib/admin/api-error';
import { BTN_B, BTN_DANGER, BTN_O, BTN_SM, FIELD, FIELD_INPUT, FIELD_LABEL, ROWACT, STACK, TD_NUM, TD_T1, TD_T2 } from '@/components/admin/styles';

interface PlatformRoleRow {
  id: string;
  name: string;
  permissions: PlatformPermissionMap;
  createdAt: string;
  _count: { accounts: number };
}

interface BoatRoleRow {
  id: string;
  name: string;
  isTemplate: boolean;
  houseboat: { id: string; name: string };
  _count: { members: number; staff: number };
}

interface RoleForm {
  id: string | null; // null = creating
  name: string;
  permissions: PlatformPermissionMap;
}

export default function Roles() {
  const platformRoles = useSWR<PlatformRoleRow[]>('/platform/rbac/roles', fetcher, {
    revalidateOnFocus: false,
  });
  const boatRoles = useAdminList<BoatRoleRow>('/platform/ops/roles', { limit: 25 });

  const [form, setForm] = useState<RoleForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function save() {
    if (!form || busy) return;
    if (!form.name.trim()) {
      setFormError('Role name is required.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      if (form.id) {
        await api.patch(`/platform/rbac/roles/${form.id}`, {
          name: form.name.trim(),
          permissions: grantedOnly(form.permissions),
        });
      } else {
        await api.post('/platform/rbac/roles', {
          name: form.name.trim(),
          permissions: grantedOnly(form.permissions),
        });
      }
      setForm(null);
      await platformRoles.mutate();
    } catch (e) {
      setFormError(apiErrorMessage(e, 'Could not save this role.'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(role: PlatformRoleRow) {
    if (deletingId) return;
    setDeletingId(role.id);
    setActionError(null);
    try {
      await api.delete(`/platform/rbac/roles/${role.id}`);
      await platformRoles.mutate();
    } catch (e) {
      setActionError(apiErrorMessage(e, 'Could not delete this role.'));
    } finally {
      setDeletingId(null);
    }
  }

  const proles = platformRoles.data ?? [];

  return (
    <>
      <PageHead
        title="Roles"
        desc={<>Platform roles restrict what console staff can do; a staff account with <b>no role is an unrestricted superadmin</b>. Boat roles below are read-only — each owner sets their own boat&apos;s permissions.</>}
        actions={
          <button
            className={BTN_B}
            onClick={() => {
              setFormError(null);
              setForm({ id: null, name: '', permissions: {} });
            }}
          >
            + New platform role
          </button>
        }
      />
      {actionError ? (
        <div className="mb-3" role="alert"><Note kind="danger" icon="⚠">{actionError}</Note></div>
      ) : null}

      <Card title="Platform roles" sub="assign them on the Accounts page" flush>
        {platformRoles.error ? (
          <ErrorState error={platformRoles.error} onRetry={() => platformRoles.mutate()} />
        ) : !platformRoles.isLoading && proles.length === 0 ? (
          <EmptyState
            title="No platform roles yet"
            desc="Without roles, every platform staffer is a superadmin. Create a role to restrict what a staff account can see and do."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Role</th>
                <th>Permissions</th>
                <th className={TD_NUM}>Assigned</th>
                <th />
              </tr>
            </thead>
            {platformRoles.isLoading ? (
              <TableSkeleton rows={3} cols={4} />
            ) : (
              <tbody>
                {proles.map((role) => {
                  const granted = Object.values(role.permissions ?? {}).filter(
                    (p) => p?.view || p?.edit,
                  ).length;
                  const summary =
                    granted === 0
                      ? 'no access'
                      : `${granted} of ${PLATFORM_PAGE_COUNT} pages`;
                  return (
                    <tr key={role.id} className="group">
                      <td className={TD_T1}>{role.name}</td>
                      <td className={TD_T2}>{summary}</td>
                      <td className={TD_NUM}>{role._count.accounts}</td>
                      <td className={ROWACT}>
                        <button
                          className={`${BTN_O} ${BTN_SM}`}
                          onClick={() => {
                            setFormError(null);
                            setForm({
                              id: role.id,
                              name: role.name,
                              permissions: role.permissions ?? {},
                            });
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className={`${BTN_DANGER} ${BTN_SM}`}
                          disabled={role._count.accounts > 0 || deletingId === role.id}
                          title={
                            role._count.accounts > 0
                              ? 'Unassign this role from all accounts first'
                              : undefined
                          }
                          onClick={() => remove(role)}
                        >
                          {deletingId === role.id ? '…' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </TableWrap>
        )}
      </Card>

      <Card title="Boat roles" sub="read-only — owners manage their own" flush style={{ marginTop: 20 }}>
        {boatRoles.error ? (
          <ErrorState error={boatRoles.error} onRetry={() => boatRoles.mutate()} />
        ) : !boatRoles.isInitialLoading && boatRoles.items.length === 0 ? (
          <EmptyState
            title="No boat roles yet"
            desc="A boat's Owner role is created automatically when the boat is created."
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Boat</th>
                  <th>Kind</th>
                  <th className={TD_NUM}>Members</th>
                  <th className={TD_NUM}>Staff</th>
                </tr>
              </thead>
              {boatRoles.isInitialLoading ? (
                <TableSkeleton rows={5} cols={5} />
              ) : (
                <tbody>
                  {boatRoles.items.map((r) => (
                    <tr key={r.id} className="group">
                      <td className={TD_T1}>{r.name}</td>
                      <td>{r.houseboat.name}</td>
                      <td>
                        <Pill tone={r.isTemplate ? 'blue' : 'mut'}>
                          {r.isTemplate ? 'template' : 'boat role'}
                        </Pill>
                      </td>
                      <td className={TD_NUM}>{r._count.members}</td>
                      <td className={TD_NUM}>{r._count.staff}</td>
                    </tr>
                  ))}
                </tbody>
              )}
            </TableWrap>
            {boatRoles.hasMore ? (
              <div style={{ padding: 12, textAlign: 'center' }}>
                <button className={`${BTN_O} ${BTN_SM}`} onClick={boatRoles.loadMore}>
                  Load more
                </button>
              </div>
            ) : null}
          </>
        )}
      </Card>

      <Note kind="info" icon="🔑" style={{ marginTop: 16 }}>
        Edit implies view. Staff revocations take effect on the next request;
        the guard checks the database, not the token.
      </Note>

      <Drawer
        open={form !== null}
        onClose={() => setForm(null)}
        wide
        title={form?.id ? `Edit role · ${form.name || '—'}` : 'New platform role'}
        footer={
          <>
            <button className={BTN_O} onClick={() => setForm(null)}>Cancel</button>
            <button className={BTN_B} disabled={busy} onClick={save}>
              {busy ? 'Saving…' : 'Save role & permissions'}
            </button>
          </>
        }
      >
        {form ? (
          <div className={STACK} style={{ gap: 14 }}>
            <div className={FIELD} style={{ maxWidth: 320 }}>
              <label className={FIELD_LABEL}>Role name</label>
              <input
                className={FIELD_INPUT}
                placeholder="e.g. Finance Officer"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <PlatformPermMatrix
              value={form.permissions}
              onChange={(permissions) => setForm({ ...form, permissions })}
            />
            {formError ? (
              <div role="alert"><Note kind="danger" icon="⚠">{formError}</Note></div>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
