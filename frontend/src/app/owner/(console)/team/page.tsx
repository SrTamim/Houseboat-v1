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
import { formatDate, maskPhone, apiErrorMessage, toE164 } from '@/lib/owner/format';

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

export default function OwnerTeamPage() {
  const { boatId } = useActiveBoat();
  const [addOpen, setAddOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [viewRole, setViewRole] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState('');
  const [shareholderPct, setShareholderPct] = useState('');

  const [roleName, setRoleName] = useState('');
  const [perms, setPerms] = useState<Record<string, { view: boolean; edit: boolean }>>(
    Object.fromEntries(MODULES.map((m) => [m, { view: false, edit: false }])),
  );

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
        permissions: Object.fromEntries(
          Object.entries(perms).filter(([, v]) => v.view || v.edit),
        ),
      });
      setRoleOpen(false);
      setRoleName('');
      await roles.mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create the role.'));
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
            <button className="btn btn-o" onClick={() => setRoleOpen(true)}>
              ＋ Role
            </button>
            <button
              className="btn btn-b"
              onClick={() => {
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
                        <button className="btn btn-sm btn-o" onClick={() => setViewRole(r)}>
                          View
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
          <Field label="Role name">
            <input
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="Manager"
              required
            />
          </Field>

          <TableWrap minWidth={0}>
            <thead>
              <tr>
                <th>Module</th>
                <th>View</th>
                <th>Edit</th>
              </tr>
            </thead>
            <tbody>
              {MODULES.map((m) => (
                <tr key={m}>
                  <td className="t1">{m}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={perms[m].view}
                      onChange={(e) =>
                        setPerms((p) => ({
                          ...p,
                          [m]: { ...p[m], view: e.target.checked },
                        }))
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={perms[m].edit}
                      onChange={(e) =>
                        setPerms((p) => ({
                          ...p,
                          // Edit without view would hide the page it edits.
                          [m]: {
                            view: e.target.checked ? true : p[m].view,
                            edit: e.target.checked,
                          },
                        }))
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </form>
      </Drawer>

      <Drawer
        open={viewRole !== null}
        title={viewRole?.name ?? ''}
        onClose={() => setViewRole(null)}
        footer={
          <button className="btn btn-o" onClick={() => setViewRole(null)}>
            Close
          </button>
        }
      >
        <TableWrap minWidth={0}>
          <thead>
            <tr>
              <th>Module</th>
              <th>View</th>
              <th>Edit</th>
            </tr>
          </thead>
          <tbody>
            {MODULES.map((m) => {
              const p = viewRole?.permissions?.[m];
              return (
                <tr key={m}>
                  <td className="t1">{m}</td>
                  <td>{p?.view ? '✓' : '✗'}</td>
                  <td>{p?.edit ? '✓' : '✗'}</td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      </Drawer>
    </>
  );
}
