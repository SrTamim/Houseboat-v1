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
import { Pill } from '@/components/owner/Pill';
import { Drawer } from '@/components/owner/Drawer';
import {
  formatDate,
  maskPhone,
  apiErrorMessage,
  toE164,
  humanize,
} from '@/lib/owner/format';

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

/** The permission modules a per-boat role can grant. */
const MODULES = [
  'bookings',
  'assets',
  'trips',
  'pricing',
  'money',
  'staff',
  'inventory',
  'costs',
  'reports',
  'settings',
] as const;

/** Empty permission map with every module off. */
function emptyPerms(): Perms {
  return Object.fromEntries(MODULES.map((m) => [m, { view: false, edit: false }]));
}

/** Seed a permission map from a role's stored (partial) permissions. */
function permsFromRole(role: Role): Perms {
  const base = emptyPerms();
  for (const m of MODULES) {
    const p = role.permissions?.[m];
    if (p) base[m] = { view: !!p.view, edit: !!p.edit };
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
    <div className="perm-list">
      {MODULES.map((m) => (
        <div className="perm-row" key={m}>
          <span className="perm-name">{humanize(m)}</span>
          <div className="perm-toggles">
            <label className="perm-toggle">
              <input
                type="checkbox"
                checked={perms[m].view}
                onChange={(e) =>
                  onChange({ ...perms, [m]: { ...perms[m], view: e.target.checked } })
                }
              />
              View
            </label>
            <label className="perm-toggle">
              <input
                type="checkbox"
                checked={perms[m].edit}
                onChange={(e) =>
                  onChange({
                    ...perms,
                    [m]: {
                      view: e.target.checked ? true : perms[m].view,
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

  return (
    <>
      <PageHead
        title="Team & roles"
        desc="Who can operate this boat, and what each of them may touch. Permissions are per boat — the same person can be an owner here and a manager elsewhere."
        actions={
          <>
            <button
              className="btn btn-o"
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
              className="btn btn-b"
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
              <div className="state">
                <div className="ic">🔑</div>
                <h4>No members</h4>
                <p>Add a shareholder or manager to share the workload.</p>
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
                  <td>
                    <Pill tone="blue">{m.role.name}</Pill>
                  </td>
                  <td>{m.shareholderPct ? `${Number(m.shareholderPct)}%` : '—'}</td>
                  <td className="t2">{formatDate(m.startDate)}</td>
                  <td>
                    <Pill tone={m.status === 'active' ? 'ok' : 'mut'}>
                      {m.status === 'active' ? 'active' : `exited ${formatDate(m.endDate)}`}
                    </Pill>
                  </td>
                  <td>
                    <div className="rowact">
                      <button
                        className="btn btn-sm btn-o"
                        onClick={() => openEditMember(m)}
                        disabled={busy}
                      >
                        Edit
                      </button>
                      {m.status === 'active' ? (
                        <button
                          className="btn btn-sm btn-o"
                          onClick={() => exitMember(m.id)}
                          disabled={busy}
                        >
                          Record exit
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

      <div className="grid-2">
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
                <div className="state">
                  <div className="ic">🔑</div>
                  <h4>No roles</h4>
                  <p>Create one to describe what a manager may do.</p>
                </div>
              }
            >
              <tbody>
                {roles.data?.map((r) => (
                  <tr key={r.id}>
                    <td className="t1">{r.name}</td>
                    <td className="t2">
                      {Object.keys(r.permissions ?? {}).length} of {MODULES.length}
                    </td>
                    <td>
                      <div className="rowact">
                        <button
                          className="btn btn-sm btn-o"
                          onClick={() => openEditRole(r)}
                        >
                          Edit
                        </button>
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
            <button className="btn btn-o" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-b" onClick={addMember} disabled={busy || !phone}>
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
            <button className="btn btn-o" onClick={() => setRoleOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-b" onClick={createRole} disabled={busy || !roleName}>
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
            <button className="btn btn-o" onClick={() => setEditRole(null)}>
              Cancel
            </button>
            <button
              className="btn btn-b"
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
            <button className="btn btn-o" onClick={() => setEditMember(null)}>
              Cancel
            </button>
            <button className="btn btn-b" onClick={saveMember} disabled={busy}>
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
    </>
  );
}
