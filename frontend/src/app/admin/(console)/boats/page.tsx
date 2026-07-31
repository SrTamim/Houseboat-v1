'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import {
  PageHead,
  Card,
  TableWrap,
  Search,
  TableSkeleton,
  EmptyState,
  ErrorState,
} from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';
import { BoatDetailDrawer } from '@/components/admin/BoatDetailDrawer';

interface ModerationBoat {
  id: string;
  name: string;
  slug: string;
  status: string;
  profileCompletePct: number;
  createdAt: string;
  hasBankAccount: boolean;
  routeNames: string[];
}

const SEGMENTS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'draft', label: 'Draft' },
  { key: 'live', label: 'Live' },
  { key: 'suspended', label: 'Suspended' },
] as const;

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'danger' | 'mut'> = {
  live: 'ok',
  pending: 'warn',
  suspended: 'danger',
  draft: 'mut',
};

function apiErrorMessage(e: unknown, fallback: string): string {
  const message =
    (e as { response?: { data?: { message?: unknown } } })?.response?.data
      ?.message;
  if (Array.isArray(message)) return message.join(', ');
  return typeof message === 'string' ? message : fallback;
}

export default function Boats() {
  const { data, error, isLoading, mutate } = useSWR<ModerationBoat[]>(
    '/platform/houseboats',
    fetcher,
    { revalidateOnFocus: false },
  );

  const [segment, setSegment] = useState<(typeof SEGMENTS)[number]['key']>('pending');
  const [query, setQuery] = useState('');
  const [openBoatId, setOpenBoatId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const boats = useMemo(() => data ?? [], [data]);

  const counts = useMemo(() => {
    const bySegment: Record<string, number> = { all: boats.length };
    for (const boat of boats) {
      bySegment[boat.status] = (bySegment[boat.status] ?? 0) + 1;
    }
    return bySegment;
  }, [boats]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return boats.filter(
      (b) =>
        (segment === 'all' || b.status === segment) &&
        (!q || b.name.toLowerCase().includes(q) || b.slug.toLowerCase().includes(q)),
    );
  }, [boats, segment, query]);

  async function approve(boatId: string) {
    if (busyId) return;
    setBusyId(boatId);
    setActionError(null);
    try {
      await api.post(`/platform/houseboats/${boatId}/approve`);
      setOpenBoatId(null);
      await mutate();
    } catch (e) {
      setActionError(apiErrorMessage(e, 'Could not approve this boat.'));
    } finally {
      setBusyId(null);
    }
  }

  async function setStatus(boatId: string, status: 'suspended' | 'live') {
    if (busyId) return;
    setBusyId(boatId);
    setActionError(null);
    try {
      await api.patch(`/platform/houseboats/${boatId}/status`, { status });
      await mutate();
    } catch (e) {
      setActionError(apiErrorMessage(e, 'Could not update this boat.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHead
        title="Boat moderation"
        desc={<>Approve a boat only when its profile is 100% complete <b>and</b> a bank account is on file. Suspend or reinstate — every change lands in the audit log.</>}
      />
      <div className="filterbar">
        <div className="seg">
          {SEGMENTS.map((s) => (
            <button
              key={s.key}
              className={`seg-b${segment === s.key ? ' on' : ''}`}
              onClick={() => setSegment(s.key)}
            >
              {s.label}
              <span className="ct">{counts[s.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <Search
          placeholder="Search boat or slug…"
          value={query}
          onChange={setQuery}
        />
      </div>
      {actionError ? (
        <div className="note danger" role="alert" style={{ marginBottom: 12 }}>
          <span className="ic">⚠</span>
          <span>{actionError}</span>
        </div>
      ) : null}
      <Card flush>
        {error ? (
          <ErrorState error={error} onRetry={() => mutate()} />
        ) : !isLoading && visible.length === 0 ? (
          <EmptyState
            title={boats.length === 0 ? 'No boats yet' : 'No boats match'}
            desc={
              boats.length === 0
                ? 'Boats appear here once owners create them.'
                : 'Try another status filter or clear the search.'
            }
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Boat</th><th>Routes</th><th>Status</th><th>Profile</th><th>Bank</th><th>Created</th><th />
              </tr>
            </thead>
            {isLoading ? (
              <TableSkeleton rows={6} cols={7} />
            ) : (
              <tbody>
                {visible.map((boat) => {
                  const canApprove =
                    boat.status === 'pending' &&
                    boat.profileCompletePct === 100 &&
                    boat.hasBankAccount;
                  return (
                    <tr key={boat.id}>
                      <td>
                        <div className="t1">{boat.name}</div>
                        <div className="t2">/{boat.slug}</div>
                      </td>
                      <td>{boat.routeNames.length ? boat.routeNames.join(', ') : '—'}</td>
                      <td>
                        <Pill tone={STATUS_TONE[boat.status] ?? 'mut'}>{boat.status}</Pill>
                      </td>
                      <td><b className="money">{boat.profileCompletePct}%</b></td>
                      <td>
                        <Pill tone={boat.hasBankAccount ? 'ok' : 'danger'}>
                          {boat.hasBankAccount ? 'on file' : 'missing'}
                        </Pill>
                      </td>
                      <td className="t2">
                        {new Date(boat.createdAt).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </td>
                      <td className="rowact">
                        <button
                          className="btn btn-sm btn-o"
                          onClick={() => setOpenBoatId(boat.id)}
                        >
                          View
                        </button>
                        {boat.status === 'pending' ? (
                          <button
                            className="btn btn-sm btn-ok"
                            disabled={!canApprove || busyId === boat.id}
                            title={
                              canApprove
                                ? undefined
                                : 'Profile must be 100% with a bank account on file'
                            }
                            onClick={() => approve(boat.id)}
                          >
                            {busyId === boat.id ? '…' : 'Approve'}
                          </button>
                        ) : null}
                        {boat.status === 'live' ? (
                          <button
                            className="btn btn-sm btn-danger"
                            disabled={busyId === boat.id}
                            onClick={() => setStatus(boat.id, 'suspended')}
                          >
                            {busyId === boat.id ? '…' : 'Suspend'}
                          </button>
                        ) : null}
                        {boat.status === 'suspended' ? (
                          <button
                            className="btn btn-sm btn-ok"
                            disabled={busyId === boat.id}
                            onClick={() => setStatus(boat.id, 'live')}
                          >
                            {busyId === boat.id ? '…' : 'Reinstate'}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </TableWrap>
        )}
      </Card>
      <BoatDetailDrawer
        boatId={openBoatId}
        onClose={() => setOpenBoatId(null)}
        onApprove={approve}
        approving={busyId !== null && busyId === openBoatId}
      />
    </>
  );
}
