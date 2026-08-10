'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import {
  PageHead,
  Card,
  Kpi,
  Kpis,
  Field,
  Note,
  Search,
  Seg,
  FilterBar,
  TableWrap,
  AsyncTable,
} from '@/components/owner/ui';
import { Pill, PillTone } from '@/components/owner/Pill';
import { Drawer } from '@/components/owner/Drawer';
import { formatDateTime, humanize, apiErrorMessage } from '@/lib/owner/format';

interface RequestComment {
  id: string;
  body: string;
  statusChange: string | null;
  authorId: string | null;
  createdAt: string;
}

interface MaintenanceRequest {
  id: string;
  topic: string;
  urgency: string;
  status: string;
  requestedAt: string;
  createdAt: string;
  closedAt: string | null;
  comments: RequestComment[];
}

interface RequestsSummary {
  requests: MaintenanceRequest[];
  kpis: {
    total: number;
    pending: number;
    inProgress: number;
    complete: number;
    canceled: number;
  };
}

const URGENCY_TONES: Record<string, PillTone> = {
  low: 'mut',
  medium: 'warn',
  high: 'danger',
};

const STATUS_TONES: Record<string, PillTone> = {
  pending: 'amb',
  in_progress: 'blue',
  complete: 'ok',
  canceled: 'mut',
};

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'complete', label: 'Complete' },
  { value: 'canceled', label: 'Canceled' },
];

export default function OwnerMaintenancePage() {
  const { boatId } = useActiveBoat();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters (client-side over the loaded list).
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Drawer: either the "new request" form or a request's detail view.
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  // New-request form state. Date/time is set by the server at creation.
  const [topic, setTopic] = useState('');
  const [urgency, setUrgency] = useState('medium');
  const [openingComment, setOpeningComment] = useState('');

  // Detail-drawer comment box.
  const [comment, setComment] = useState('');

  const { data, error: loadError, isLoading, mutate } = useSWR<RequestsSummary>(
    boatId ? `/houseboats/${boatId}/maintenance/requests` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const filtered = useMemo(() => {
    const list = data?.requests ?? [];
    const needle = q.trim().toLowerCase();
    return list.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (needle && !r.topic.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [data?.requests, q, statusFilter]);

  const openRequest = openId
    ? data?.requests.find((r) => r.id === openId) ?? null
    : null;

  function resetForm() {
    setTopic('');
    setUrgency('medium');
    setOpeningComment('');
  }

  async function createRequest(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/houseboats/${boatId}/maintenance/requests`, {
        topic,
        urgency,
        comment: openingComment || undefined,
      });
      resetForm();
      setCreating(false);
      await mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create that request.'));
    } finally {
      setBusy(false);
    }
  }

  /** Change status, optionally with the comment typed in the detail drawer. */
  async function changeStatus(requestId: string, status: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/houseboats/${boatId}/maintenance/requests/${requestId}`, {
        status,
        comment: comment.trim() || undefined,
      });
      setComment('');
      await mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update that request.'));
    } finally {
      setBusy(false);
    }
  }

  async function addComment(requestId: string) {
    if (busy || !comment.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(
        `/houseboats/${boatId}/maintenance/requests/${requestId}/comments`,
        { body: comment.trim() },
      );
      setComment('');
      await mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not add that comment.'));
    } finally {
      setBusy(false);
    }
  }

  const kpis = data?.kpis;

  return (
    <>
      <PageHead
        title="Maintenance"
        desc="Requests raised against the boat — what needs doing, how urgent, and where each one stands. Add a comment as work progresses so the history stays with the request."
        actions={
          <button
            className="btn btn-b"
            onClick={() => {
              setError(null);
              setCreating(true);
            }}
          >
            ＋ New request
          </button>
        }
      />

      {error && !creating && !openId ? (
        <Note kind="danger" style={{ marginBottom: 18 }}>
          {error}
        </Note>
      ) : null}

      <Kpis>
        <Kpi
          icon="⏳"
          label="Pending"
          value={kpis?.pending ?? '—'}
          alert={Boolean(kpis?.pending)}
          detail="Not started yet"
        />
        <Kpi
          icon="🔧"
          label="In progress"
          value={kpis?.inProgress ?? '—'}
          detail="Being worked on"
        />
        <Kpi icon="✓" label="Complete" value={kpis?.complete ?? '—'} detail="Done" />
        <Kpi
          icon="✕"
          label="Canceled"
          value={kpis?.canceled ?? '—'}
          detail="Dropped"
        />
      </Kpis>

      <Card title="Requests" flush>
        <div style={{ padding: '14px 16px 0' }}>
          <FilterBar>
            <Search
              placeholder="Search by topic…"
              value={q}
              onChange={setQ}
            />
            <Seg
              options={STATUS_FILTERS}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </FilterBar>
        </div>
        <TableWrap minWidth={720}>
          <thead>
            <tr>
              <th>Topic</th>
              <th>Urgency</th>
              <th>Status</th>
              <th className="num">Comments</th>
              <th />
            </tr>
          </thead>
          <AsyncTable
            isLoading={isLoading}
            error={loadError}
            isEmpty={filtered.length === 0}
            onRetry={() => mutate()}
            empty={
              <div className="state">
                <div className="ic">🛠</div>
                <h4>
                  {(data?.requests.length ?? 0) === 0
                    ? 'No requests yet'
                    : 'Nothing matches'}
                </h4>
                <p>
                  {(data?.requests.length ?? 0) === 0
                    ? 'Raise a request when something on the boat needs attention.'
                    : 'Try a different search or status filter.'}
                </p>
              </div>
            }
          >
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="t1">{r.topic}</div>
                    <div className="t2">{formatDateTime(r.requestedAt)}</div>
                  </td>
                  <td>
                    <Pill tone={URGENCY_TONES[r.urgency] ?? 'mut'}>
                      {humanize(r.urgency)}
                    </Pill>
                  </td>
                  <td>
                    <Pill tone={STATUS_TONES[r.status] ?? 'mut'}>
                      {humanize(r.status)}
                    </Pill>
                  </td>
                  <td className="num">{r.comments.length || '—'}</td>
                  <td>
                    <div className="rowact">
                      <button
                        className="btn btn-sm btn-o"
                        onClick={() => {
                          setError(null);
                          setComment('');
                          setOpenId(r.id);
                        }}
                      >
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

      {/* New request */}
      <Drawer
        open={creating}
        title="New maintenance request"
        onClose={() => setCreating(false)}
        footer={
          <>
            <button className="btn btn-o" onClick={() => setCreating(false)}>
              Cancel
            </button>
            <button className="btn btn-b" onClick={createRequest} disabled={busy}>
              {busy ? 'Saving…' : 'Create request'}
            </button>
          </>
        }
      >
        <form onSubmit={createRequest} style={{ display: 'grid', gap: 12 }}>
          {error ? <Note kind="danger">{error}</Note> : null}
          <Field label="Topic">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Railing loose on upper deck"
              required
            />
          </Field>
          <Field label="Urgency">
            <select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </Field>
          <Field label="Opening comment (optional)">
            <textarea
              rows={3}
              value={openingComment}
              onChange={(e) => setOpeningComment(e.target.value)}
              placeholder="Context, part numbers, who spotted it…"
            />
          </Field>
        </form>
      </Drawer>

      {/* Request detail + comment log */}
      <Drawer
        open={openId !== null}
        title={openRequest?.topic ?? 'Request'}
        onClose={() => setOpenId(null)}
        footer={
          <button className="btn btn-o" onClick={() => setOpenId(null)}>
            Close
          </button>
        }
      >
        {openRequest ? (
          <div style={{ display: 'grid', gap: 16 }}>
            {error ? <Note kind="danger">{error}</Note> : null}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Pill tone={URGENCY_TONES[openRequest.urgency] ?? 'mut'}>
                {humanize(openRequest.urgency)} urgency
              </Pill>
              <Pill tone={STATUS_TONES[openRequest.status] ?? 'mut'}>
                {humanize(openRequest.status)}
              </Pill>
            </div>
            <div className="t2">Raised {formatDateTime(openRequest.requestedAt)}</div>

            {/* Status actions available from the current state. */}
            <div className="rowact" style={{ flexWrap: 'wrap' }}>
              {openRequest.status === 'pending' ? (
                <button
                  className="btn btn-sm btn-b"
                  onClick={() => changeStatus(openRequest.id, 'in_progress')}
                  disabled={busy}
                >
                  Start
                </button>
              ) : null}
              {openRequest.status !== 'complete' &&
              openRequest.status !== 'canceled' ? (
                <>
                  <button
                    className="btn btn-sm btn-ok"
                    onClick={() => changeStatus(openRequest.id, 'complete')}
                    disabled={busy}
                  >
                    Mark complete
                  </button>
                  <button
                    className="btn btn-sm btn-o"
                    onClick={() => changeStatus(openRequest.id, 'canceled')}
                    disabled={busy}
                  >
                    Cancel request
                  </button>
                </>
              ) : (
                <button
                  className="btn btn-sm btn-o"
                  onClick={() => changeStatus(openRequest.id, 'pending')}
                  disabled={busy}
                >
                  Reopen
                </button>
              )}
            </div>

            <div>
              <div className="t1" style={{ marginBottom: 8 }}>
                Comments
              </div>
              {openRequest.comments.length === 0 ? (
                <div className="t2">No comments yet.</div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {openRequest.comments.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        borderLeft: '2px solid var(--line, #e5e7eb)',
                        paddingLeft: 10,
                      }}
                    >
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {c.statusChange ? (
                          <Pill tone={STATUS_TONES[c.statusChange] ?? 'mut'}>
                            → {humanize(c.statusChange)}
                          </Pill>
                        ) : null}
                        <span className="t2">{formatDateTime(c.createdAt)}</span>
                      </div>
                      <div style={{ marginTop: 4 }}>{c.body}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Field label="Add a comment">
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Update, or a note to attach to the next status change…"
              />
            </Field>
            <button
              className="btn btn-o btn-sm"
              onClick={() => addComment(openRequest.id)}
              disabled={busy || !comment.trim()}
              style={{ justifySelf: 'start' }}
            >
              {busy ? 'Saving…' : 'Add comment'}
            </button>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
