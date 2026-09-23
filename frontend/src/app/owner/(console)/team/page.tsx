'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import {
  PageHead,
  Card,
  Field,
  Note,
  TableWrap,
  AsyncTable,
} from '@/components/owner/ui';
import {
  BTN_B,
  BTN_O,
  BTN_SM,
  PERM_LIST,
  PERM_NAME,
  PERM_ROW,
  PERM_TOGGLE,
  PERM_TOGGLES,
} from '@/components/owner/styles';
import { Pill } from '@/components/owner/Pill';
import { Drawer } from '@/components/owner/Drawer';
import {
  formatDate,
  maskPhone,
  apiErrorMessage,
  toE164,
} from '@/lib/owner/format';
import { OWNER_NAV } from '@/lib/owner/nav';

interface Member {
  id: string;
  shareholderPct: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  account: { id: string; name: string | null; phone: string };
  role: { id: string; name: string };
}

interface Role {
  id: string;
  name: string;
  isTemplate: boolean;
  permissions: Record<string, { view?: boolean; edit?: boolean }> | null;
}

type Perms = Record<string, { view: boolean; edit: boolean }>;

/**
 * The per-boat permission catalog is the 29 owner-console pages, grouped exactly
 * as the sidebar groups them (OWNER_NAV) so the role drawer reads as the same
 * map of the console. Each page's own label is reused, so keys like `pos` show
 * as "Counter sale" rather than a humanized key.
 */
const PAGE_GROUPS = OWNER_NAV.map((g) => ({
  group: g.group,
  pages: g.items.map((i) => ({ key: i.key, label: i.label })),
}));

/** Flat list of the 29 page keys, for building/seeding permission maps. */
const PAGES = PAGE_GROUPS.flatMap((g) => g.pages.map((p) => p.key));

/** Empty permission map with every page off. */
function emptyPerms(): Perms {
  return Object.fromEntries(PAGES.map((p) => [p, { view: false, edit: false }]));
}

/** Seed a permission map from a role's stored (partial) permissions. */
function permsFromRole(role: Role): Perms {
  const base = emptyPerms();
  for (const p of PAGES) {
    const stored = role.permissions?.[p];
    if (stored) base[p] = { view: !!stored.view, edit: !!stored.edit };
  }
  return base;
}

/**
 * Compact per-module View/Edit permission list. Replaces the old three-column
 * table so the checkboxes read as a tidy settings list inside the drawer.
 * Editing implies View — turning Edit on forces View on so a role can't edit a
 * page it can't see.
 */
function PermissionList({
  perms,
  onChange,
}: {
  perms: Perms;
  onChange: (next: Perms) => void;
}) {
  return (
    <div className={PERM_LIST}>
      {PAGE_GROUPS.map((group) => (
        <div key={group.group}>
          <div className="mb-1 mt-3 px-0.5 text-[10px] font-bold uppercase tracking-[0.11em] text-muted first:mt-0">
            {group.group}
          </div>
          {group.pages.map(({ key, label }) => (
            <div className={PERM_ROW} key={key}>
              <span className={PERM_NAME}>{label}</span>
              <div className={PERM_TOGGLES}>
                <label className={PERM_TOGGLE}>
                  <input
                    type="checkbox"
                    checked={perms[key].view}
                    onChange={(e) =>
                      onChange({
                        ...perms,
                        [key]: { ...perms[key], view: e.target.checked },
                      })
                    }
                  />
                  View
                </label>
                <label className={PERM_TOGGLE}>
                  <input
                    type="checkbox"
                    checked={perms[key].edit}
                    onChange={(e) =>
                      onChange({
                        ...perms,
                        [key]: {
                          view: e.target.checked ? true : perms[key].view,
                          edit: e.target.checked,
                        },
                      })
                    }
                  />
                  Edit
                </label>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Keep only the modules that grant something, for the API payload. */
function grantedOnly(perms: Perms) {
  return Object.fromEntries(Object.entries(perms).filter(([, v]) => v.view || v.edit));
}

export default function OwnerTeamPage() {
  const { boatId } = useActiveBoat();
  const [addOpen, setAddOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState('');
  const [shareholderPct, setShareholderPct] = useState('');

  const [roleName, setRoleName] = useState('');
  const [perms, setPerms] = useState<Perms>(emptyPerms());

  // Edit-role drawer state.
  const [editRoleName, setEditRoleName] = useState('');
  const [editPerms, setEditPerms] = useState<Perms>(emptyPerms());

  // Edit-member drawer state.
  const [mRoleId, setMRoleId] = useState('');
  const [mShare, setMShare] = useState('');
  const [mSince, setMSince] = useState('');
  const [mStatus, setMStatus] = useState<'active' | 'exited'>('active');

  // Delete confirmation drawers.
  const [delRole, setDelRole] = useState<Role | null>(null);
  const [delMember, setDelMember] = useState<Member | null>(null);

  const members = useSWR<Member[]>(`/houseboats/${boatId}/members`, fetcher, {
    revalidateOnFocus: false,
  });
  const roles = useSWR<Role[]>(`/houseboats/${boatId}/roles`, fetcher, {
    revalidateOnFocus: false,
  });

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !phone || !roleId) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/houseboats/${boatId}/members`, {
        phone: toE164(phone),
        roleId,
        shareholderPct: shareholderPct ? Number(shareholderPct) : undefined,
      });
      setAddOpen(false);
      setPhone('');
      setShareholderPct('');
      await members.mutate();
    } catch (err) {
      setError(
        apiErrorMessage(err, 'Could not add that person. They need an account first.'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function createRole(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !roleName) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/houseboats/${boatId}/roles`, {
        name: roleName,
        permissions: grantedOnly(perms),
      });
      setRoleOpen(false);
      setRoleName('');
      setPerms(emptyPerms());
      await roles.mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create the role.'));
    } finally {
      setBusy(false);
    }
  }

  function openEditRole(r: Role) {
    setError(null);
    setEditRoleName(r.name);
    setEditPerms(permsFromRole(r));
    setEditRole(r);
  }

  async function saveRole(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !editRole || !editRoleName) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/houseboats/${boatId}/roles/${editRole.id}`, {
        name: editRoleName,
        permissions: grantedOnly(editPerms),
      });
      setEditRole(null);
      await roles.mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update the role.'));
    } finally {
      setBusy(false);
    }
  }

  function openEditMember(m: Member) {
    setError(null);
    setMRoleId(m.role.id);
    setMShare(m.shareholderPct ? String(Number(m.shareholderPct)) : '');
    setMSince(m.startDate ? m.startDate.slice(0, 10) : '');
    setMStatus(m.status === 'exited' ? 'exited' : 'active');
    setEditMember(m);
  }

  async function saveMember(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !editMember) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/houseboats/${boatId}/members/${editMember.id}`, {
        roleId: mRoleId,
        shareholderPct: mShare ? Number(mShare) : undefined,
        startDate: mSince ? new Date(mSince).toISOString() : undefined,
        status: mStatus,
      });
      setEditMember(null);
      await members.mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update the member.'));
    } finally {
      setBusy(false);
    }
  }

  async function exitMember(membershipId: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/houseboats/${boatId}/members/${membershipId}/exit`);
      await members.mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not record the exit.'));
    } finally {
      setBusy(false);
    }
  }

  async function deleteMember() {
    if (busy || !delMember) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/houseboats/${boatId}/members/${delMember.id}`);
      setDelMember(null);
      await members.mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not delete the member.'));
    } finally {
      setBusy(false);
    }
  }

  async function deleteRole() {
    if (busy || !delRole) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/houseboats/${boatId}/roles/${delRole.id}`);
      setDelRole(null);
      // Deleting a role removes the members on it — refresh both lists.
      await Promise.all([roles.mutate(), members.mutate()]);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not delete the role.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="Team & roles"
        desc="Who can operate this boat, and what each of them may touch. Permissions are per boat — the same person can be an owner here and a manager elsewhere."
        actions={
          <>
            <button
              className={BTN_O}
              onClick={() => {
                setError(null);
                setRoleName('');
                setPerms(emptyPerms());
                setRoleOpen(true);
              }}
            >
              ＋ Role
            </button>
            <button
              className={BTN_B}
              onClick={() => {
                setError(null);
                setRoleId(roles.data?.[0]?.id ?? '');
                setAddOpen(true);
              }}
              disabled={(roles.data?.length ?? 0) === 0}
            >
              ＋ Member
            </button>
          </>
        }
      />

      {error ? (
        <Note kind="danger" style={{ marginBottom: 18 }}>
          {error}
        </Note>
      ) : null}

      <Card title="Members & shareholders" flush style={{ marginBottom: 20 }}>
        <TableWrap minWidth={760}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Share</th>
              <th>Since</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <AsyncTable
            isLoading={members.isLoading}
            error={members.error}
            isEmpty={(members.data?.length ?? 0) === 0}
            onRetry={() => members.mutate()}
            empty={
              <div className="px-6 py-11 text-center text-muted">
                <div className="mb-2.5 text-[26px]">🔑</div>
                <h4 className="mb-1.5 text-[15px] text-ink">No members</h4>
                <p className="mx-auto max-w-[46ch] text-[13px] leading-[1.55]">
                  Add a shareholder or manager to share the workload.
                </p>
              </div>
            }
          >
            <tbody>
              {members.data?.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="t1">{m.account.name ?? 'Member'}</div>
                    <div className="t2">{maskPhone(m.account.phone)}</div>
                  </td>
                  <td data-label="Role">
                    <Pill tone="blue">{m.role.name}</Pill>
                  </td>
                  <td data-label="Share">{m.shareholderPct ? `${Number(m.shareholderPct)}%` : '—'}</td>
                  <td className="t2" data-label="Since">{formatDate(m.startDate)}</td>
                  <td data-label="Status">
                    <Pill tone={m.status === 'active' ? 'ok' : 'mut'}>
                      {m.status === 'active' ? 'active' : `exited ${formatDate(m.endDate)}`}
                    </Pill>
                  </td>
                  <td>
                    <div className="rowact">
                      <button
                        className={`${BTN_O} ${BTN_SM}`}
                        onClick={() => openEditMember(m)}
                        disabled={busy}
                      >
                        Edit
                      </button>
                      {m.status === 'active' ? (
                        <button
                          className={`${BTN_O} ${BTN_SM}`}
                          onClick={() => exitMember(m.id)}
                          disabled={busy}
                        >
                          Record exit
                        </button>
                      ) : null}
                      <button
                        className={`${BTN_O} ${BTN_SM}`}
                        onClick={() => {
                          setError(null);
                          setDelMember(m);
                        }}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </AsyncTable>
        </TableWrap>
      </Card>

      <div className="grid grid-cols-[2fr_1fr] items-start gap-5 max-[1024px]:grid-cols-1">
        <Card title="Roles" sub="per-boat permission sets" flush>
          <TableWrap minWidth={0}>
            <thead>
              <tr>
                <th>Role</th>
                <th>Modules granted</th>
                <th />
              </tr>
            </thead>
            <AsyncTable
              isLoading={roles.isLoading}
              error={roles.error}
              isEmpty={(roles.data?.length ?? 0) === 0}
              onRetry={() => roles.mutate()}
              empty={
                <div className="px-6 py-11 text-center text-muted">
                  <div className="mb-2.5 text-[26px]">🔑</div>
                  <h4 className="mb-1.5 text-[15px] text-ink">No roles</h4>
                  <p className="mx-auto max-w-[46ch] text-[13px] leading-[1.55]">
                    Create one to describe what a manager may do.
                  </p>
                </div>
              }
            >
              <tbody>
                {roles.data?.map((r) => (
                  <tr key={r.id}>
                    <td className="t1">{r.name}</td>
                    <td className="t2" data-label="Modules granted">
                      {Object.keys(r.permissions ?? {}).length} of {PAGES.length}
                    </td>
                    <td>
                      <div className="rowact">
                        <button
                          className={`${BTN_O} ${BTN_SM}`}
                          onClick={() => openEditRole(r)}
                        >
                          Edit
                        </button>
                        {r.name !== 'Owner' ? (
                          <button
                            className={`${BTN_O} ${BTN_SM}`}
                            onClick={() => {
                              setError(null);
                              setDelRole(r);
                            }}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </AsyncTable>
          </TableWrap>
        </Card>

        <Card title="Exited members">
          <Note kind="info">
            Exiting a shareholder does not delete them. The membership row stays so their
            historical access survives — they keep read access to their own period and
            lose the ability to change anything.
          </Note>
        </Card>
      </div>

      <Drawer
        open={addOpen}
        title="Add member"
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <button className={BTN_O} onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button className={BTN_B} onClick={addMember} disabled={busy || !phone}>
              {busy ? 'Adding…' : 'Add member'}
            </button>
          </>
        }
      >
        <form onSubmit={addMember} style={{ display: 'grid', gap: 12 }}>
          {error ? <Note kind="danger">{error}</Note> : null}
          <Field label="Phone">
            <div className="with-pre">
              <span className="pre">+880</span>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
          </Field>
          <Field label="Role">
            <select value={roleId} onChange={(e) => setRoleId(e.target.value)} required>
              {roles.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Shareholder %">
            <input
              type="number"
              min={0}
              max={100}
              value={shareholderPct}
              onChange={(e) => setShareholderPct(e.target.value)}
              placeholder="25"
            />
          </Field>
          <Note kind="info">
            Shareholder % is a record for splitting withdrawals by hand. Nothing is paid out
            automatically.
          </Note>
        </form>
      </Drawer>

      <Drawer
        open={roleOpen}
        title="New role"
        onClose={() => setRoleOpen(false)}
        footer={
          <>
            <button className={BTN_O} onClick={() => setRoleOpen(false)}>
              Cancel
            </button>
            <button className={BTN_B} onClick={createRole} disabled={busy || !roleName}>
              {busy ? 'Creating…' : 'Create role'}
            </button>
          </>
        }
      >
        <form onSubmit={createRole} style={{ display: 'grid', gap: 12 }}>
          {error ? <Note kind="danger">{error}</Note> : null}
          <Field label="Role name">
            <input
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="Manager"
              required
            />
          </Field>
          <Field label="Permissions">
            <PermissionList perms={perms} onChange={setPerms} />
          </Field>
        </form>
      </Drawer>

      <Drawer
        open={editRole !== null}
        title="Edit role"
        onClose={() => setEditRole(null)}
        footer={
          <>
            <button className={BTN_O} onClick={() => setEditRole(null)}>
              Cancel
            </button>
            <button
              className={BTN_B}
              onClick={saveRole}
              disabled={busy || !editRoleName}
            >
              {busy ? 'Saving…' : 'Save role'}
            </button>
          </>
        }
      >
        <form onSubmit={saveRole} style={{ display: 'grid', gap: 12 }}>
          {error ? <Note kind="danger">{error}</Note> : null}
          <Field label="Role name">
            <input
              value={editRoleName}
              onChange={(e) => setEditRoleName(e.target.value)}
              required
            />
          </Field>
          <Field label="Permissions">
            <PermissionList perms={editPerms} onChange={setEditPerms} />
          </Field>
        </form>
      </Drawer>

      <Drawer
        open={editMember !== null}
        title="Edit member"
        onClose={() => setEditMember(null)}
        footer={
          <>
            <button className={BTN_O} onClick={() => setEditMember(null)}>
              Cancel
            </button>
            <button className={BTN_B} onClick={saveMember} disabled={busy}>
              {busy ? 'Saving…' : 'Save member'}
            </button>
          </>
        }
      >
        <form onSubmit={saveMember} style={{ display: 'grid', gap: 12 }}>
          {error ? <Note kind="danger">{error}</Note> : null}
          <Field label="Member">
            <div className="t1">{editMember?.account.name ?? 'Member'}</div>
            <div className="t2">{maskPhone(editMember?.account.phone)}</div>
          </Field>
          <Field label="Role">
            <select value={mRoleId} onChange={(e) => setMRoleId(e.target.value)} required>
              {roles.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Shareholder %">
            <input
              type="number"
              min={0}
              max={100}
              value={mShare}
              onChange={(e) => setMShare(e.target.value)}
              placeholder="25"
            />
          </Field>
          <Field label="Since">
            <input
              type="date"
              value={mSince}
              onChange={(e) => setMSince(e.target.value)}
            />
          </Field>
          <Field label="Status">
            <select
              value={mStatus}
              onChange={(e) => setMStatus(e.target.value as 'active' | 'exited')}
            >
              <option value="active">active</option>
              <option value="exited">exited</option>
            </select>
          </Field>
          <Note kind="info">
            Name and phone belong to the person&rsquo;s account and are shared across every
            boat — edit them from their profile, not here.
          </Note>
        </form>
      </Drawer>

      <Drawer
        open={delMember !== null}
        title="Delete member"
        onClose={() => setDelMember(null)}
        footer={
          <>
            <button className={BTN_O} onClick={() => setDelMember(null)}>
              Cancel
            </button>
            <button className={BTN_B} onClick={deleteMember} disabled={busy}>
              {busy ? 'Deleting…' : 'Delete member'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 12 }}>
          {error ? <Note kind="danger">{error}</Note> : null}
          <Note kind="warn">
            Remove <strong>{delMember?.account.name ?? 'this member'}</strong> from
            this boat entirely? They lose all access. This deletes the membership —
            to keep their history instead, use <strong>Record exit</strong>.
          </Note>
        </div>
      </Drawer>

      <Drawer
        open={delRole !== null}
        title="Delete role"
        onClose={() => setDelRole(null)}
        footer={
          <>
            <button className={BTN_O} onClick={() => setDelRole(null)}>
              Cancel
            </button>
            <button className={BTN_B} onClick={deleteRole} disabled={busy}>
              {busy ? 'Deleting…' : 'Delete role'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 12 }}>
          {error ? <Note kind="danger">{error}</Note> : null}
          <Note kind="warn">
            Delete the <strong>{delRole?.name}</strong> role?{' '}
            {(() => {
              const n =
                members.data?.filter((m) => m.role.id === delRole?.id).length ?? 0;
              return n > 0
                ? `${n} member${n === 1 ? '' : 's'} on this role will be removed from the boat.`
                : 'No members currently hold this role.';
            })()}
          </Note>
        </div>
      </Drawer>
    </>
  );
}
