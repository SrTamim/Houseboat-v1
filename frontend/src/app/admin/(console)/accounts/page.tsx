'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import {
  PageHead,
  Note,
  Card,
  TableWrap,
  TableSkeleton,
  EmptyState,
  ErrorState,
  Search,
} from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';
import { useAdminList } from '@/lib/admin/useAdminList';
import { apiErrorMessage } from '@/lib/admin/api-error';
import { BTN_DANGER, BTN_O, BTN_SM, FILTERBAR, ROWACT, SELECT, TD_T1, TD_T2 } from '@/components/admin/styles';

interface AccountRow {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  phoneVerified: boolean;
  isPlatform: boolean;
  platformRole: { id: string; name: string } | null;
  createdAt: string;
  _count: { memberships: number; bookingsAsCustomer: number };
}

interface PlatformRoleOption {
  id: string;
  name: string;
}

function roleSummary(a: AccountRow): string {
  const parts: string[] = [];
  if (a._count.memberships > 0) parts.push(`member ×${a._count.memberships}`);
  if (a._count.bookingsAsCustomer > 0) parts.push('customer');
  return parts.length ? parts.join(' · ') : '—';
}

export default function Accounts() {
  const [query, setQuery] = useState('');
  const { items, error, isInitialLoading, hasMore, loadMore, mutate } =
    useAdminList<AccountRow>('/platform/ops/accounts', {
      q: query || undefined,
      limit: 25,
    });
  const roles = useSWR<PlatformRoleOption[]>('/platform/rbac/roles', fetcher, {
    revalidateOnFocus: false,
  });
  // Who am I? Own row's controls are disabled — the backend blocks
  // self-changes anyway; the UI just should not offer them.
  const me = useSWR<{ id: string }>('/auth/me', fetcher, {
    revalidateOnFocus: false,
  });

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function setStaff(account: AccountRow, isPlatform: boolean) {
    if (busyId) return;
    if (
      !isPlatform &&
      !window.confirm(
        `Revoke platform staff access for ${account.name ?? account.phone}? They lose the console immediately.`,
      )
    ) {
      return;
    }
    setBusyId(account.id);
    setActionError(null);
    try {
      await api.patch(`/platform/rbac/accounts/${account.id}/platform-staff`, {
        isPlatform,
      });
      await mutate();
    } catch (e) {
      setActionError(apiErrorMessage(e, 'Could not update staff access.'));
    } finally {
      setBusyId(null);
    }
  }

  async function assignRole(account: AccountRow, platformRoleId: string | null) {
    if (busyId) return;
    setBusyId(account.id);
    setActionError(null);
    try {
      await api.patch(`/platform/rbac/accounts/${account.id}/platform-role`, {
        platformRoleId,
      });
      await mutate();
    } catch (e) {
      setActionError(apiErrorMessage(e, 'Could not assign the role.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHead
        title="Account support"
        desc="One login per person. Grant platform-staff access here and restrict it with a platform role — staff with no role are unrestricted superadmins."
      />
      <div className={FILTERBAR}>
        <Search
          placeholder="Search phone, name or email…"
          maxWidth={420}
          value={query}
          onChange={setQuery}
        />
      </div>
      {actionError ? (
        <div className="mb-3" role="alert"><Note kind="danger" icon="⚠">{actionError}</Note></div>
      ) : null}
      <Card flush>
        {error ? (
          <ErrorState error={error} onRetry={() => mutate()} />
        ) : !isInitialLoading && items.length === 0 ? (
          <EmptyState
            title={query ? 'No accounts match' : 'No accounts yet'}
            desc={
              query
                ? 'Try a different phone, name or email.'
                : 'Accounts appear here as people register.'
            }
          />
        ) : (
          <>
            <TableWrap minWidth={1050}>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Phone</th>
                  <th>Verified</th>
                  <th>Roles</th>
                  <th>Platform access</th>
                  <th>Joined</th>
                  <th />
                </tr>
              </thead>
              {isInitialLoading ? (
                <TableSkeleton rows={6} cols={7} />
              ) : (
                <tbody>
                  {items.map((a) => {
                    const isSelf = me.data?.id === a.id;
                    return (
                      <tr key={a.id} className="group">
                        <td>
                          <div className={TD_T1}>{a.name ?? '—'}</div>
                          <div className={TD_T2}>{a.email ?? '—'}</div>
                        </td>
                        <td className={TD_T2}>{a.phone}</td>
                        <td>
                          <Pill tone={a.phoneVerified ? 'ok' : 'warn'}>
                            {a.phoneVerified ? 'verified' : 'pending'}
                          </Pill>
                        </td>
                        <td className={TD_T2}>{roleSummary(a)}</td>
                        <td>
                          {a.isPlatform ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <Pill tone="blue">staff</Pill>
                              <select
                                className={SELECT}
                                style={{ height: 30, fontSize: 12 }}
                                value={a.platformRole?.id ?? ''}
                                disabled={isSelf || busyId === a.id}
                                title={isSelf ? 'Another admin must change your access' : undefined}
                                onChange={(e) =>
                                  assignRole(a, e.target.value || null)
                                }
                              >
                                <option value="">Superadmin (no role)</option>
                                {(roles.data ?? []).map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <span className={TD_T2}>—</span>
                          )}
                        </td>
                        <td className={TD_T2}>
                          {new Date(a.createdAt).toLocaleDateString('en-GB', {
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className={ROWACT}>
                          {a.isPlatform ? (
                            <button
                              className={`${BTN_DANGER} ${BTN_SM}`}
                              disabled={isSelf || busyId === a.id}
                              title={isSelf ? 'Another admin must change your access' : undefined}
                              onClick={() => setStaff(a, false)}
                            >
                              {busyId === a.id ? '…' : 'Revoke staff'}
                            </button>
                          ) : (
                            <button
                              className={`${BTN_O} ${BTN_SM}`}
                              disabled={busyId === a.id}
                              onClick={() => setStaff(a, true)}
                            >
                              {busyId === a.id ? '…' : 'Grant staff'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              )}
            </TableWrap>
            {hasMore ? (
              <div style={{ padding: 12, textAlign: 'center' }}>
                <button className={`${BTN_O} ${BTN_SM}`} onClick={loadMore}>
                  Load more
                </button>
              </div>
            ) : null}
          </>
        )}
      </Card>
    </>
  );
}
