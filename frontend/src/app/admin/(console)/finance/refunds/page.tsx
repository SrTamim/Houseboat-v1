'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import {
  PageHead,
  Note,
  Card,
  TableWrap,
  TableSkeleton,
  EmptyState,
  ErrorState,
  Select,
} from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';
import { useAdminList } from '@/lib/admin/useAdminList';
import { formatBDT } from '@/lib/admin/money';
import { shortId, channelLabel, channelTone } from '@/lib/admin/invoices';
import { BTN_B, BTN_O, BTN_SM, FILTERBAR, ROWACT, TD_NUM, TD_T1, TD_T2, UNIT } from '@/components/admin/styles';

interface RefundRow {
  id: string;
  amount: string;
  reason: string | null;
  status: 'requested' | 'verified' | 'completed';
  claimDeadline: string | null;
  completedAt: string | null;
  requestedByAccount: { id: string; name: string | null } | null;
  verifiedByAccount: { id: string; name: string | null } | null;
  completedByAccount: { id: string; name: string | null } | null;
  invoice: {
    id: string;
    status: string;
    displayTotal: string;
    houseboat: { id: string; name: string };
    customer: { id: string; name: string | null; phone: string };
    booking: { id: string; channel: string };
  };
}

const REFUND_TONE = {
  requested: 'warn',
  verified: 'blue',
  completed: 'ok',
} as const;

const STATUS_OPTIONS = [
  { value: '', label: 'All refunds' },
  { value: 'requested', label: 'Requested' },
  { value: 'verified', label: 'Verified' },
  { value: 'completed', label: 'Completed' },
];

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function Refunds() {
  const [status, setStatus] = useState('');
  const { items, error, isInitialLoading, hasMore, loadMore, mutate } =
    useAdminList<RefundRow>('/platform/finance/refunds', {
      status: status || undefined,
      limit: 25,
    });

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function advance(refund: RefundRow) {
    if (busyId) return;
    const step = refund.status === 'requested' ? 'verify' : 'complete';
    setBusyId(refund.id);
    setActionError(null);
    try {
      await api.post(`/refunds/${refund.id}/${step}`);
      await mutate();
    } catch (e) {
      const message =
        (e as { response?: { data?: { message?: unknown } } })?.response?.data
          ?.message;
      setActionError(
        typeof message === 'string'
          ? message
          : `Could not ${step} this refund.`,
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHead
        title="Refunds"
        desc={<>Owner-cancel refunds, claimable within 6 days. Separation of duties is enforced by the backend and the database: request → verify → complete must be different people.</>}
      />
      <div className={FILTERBAR}>
        <Select options={STATUS_OPTIONS} value={status} onChange={setStatus} />
      </div>
      {actionError ? (
        <div className="mb-3" role="alert"><Note kind="danger" icon="⚠">{actionError}</Note></div>
      ) : null}
      <Card flush>
        {error ? (
          <ErrorState error={error} onRetry={() => mutate()} />
        ) : !isInitialLoading && items.length === 0 ? (
          <EmptyState
            title="No refunds"
            desc="Refund requests appear here when an owner cancels a paid trip."
          />
        ) : (
          <>
            <TableWrap minWidth={1080}>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Boat</th>
                  <th>Customer</th>
                  <th className={TD_NUM}>Refund</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Deadline</th>
                  <th>Chain</th>
                  <th />
                </tr>
              </thead>
              {isInitialLoading ? (
                <TableSkeleton rows={5} cols={9} />
              ) : (
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id} className="group">
                      <td>
                        <div className={TD_T1}>{shortId(r.invoice.id, 'INV')}</div>
                        {r.reason ? <div className={TD_T2}>{r.reason}</div> : null}
                      </td>
                      <td>{r.invoice.houseboat.name}</td>
                      <td>
                        <div className={TD_T1}>{r.invoice.customer.name ?? '—'}</div>
                        <div className={TD_T2}>{r.invoice.customer.phone}</div>
                      </td>
                      <td className={TD_NUM}>
                        <span className={UNIT}>৳</span> {formatBDT(r.amount)}
                      </td>
                      <td>
                        <Pill tone={REFUND_TONE[r.status]}>{r.status}</Pill>
                      </td>
                      <td>
                        <Pill tone={channelTone(r.invoice.booking.channel)}>
                          {channelLabel(r.invoice.booking.channel)}
                        </Pill>
                      </td>
                      <td className={TD_T2}>{formatDate(r.claimDeadline)}</td>
                      <td className={TD_T2}>
                        {[
                          r.requestedByAccount?.name,
                          r.verifiedByAccount?.name,
                          r.completedByAccount?.name,
                        ]
                          .filter(Boolean)
                          .join(' → ') || '—'}
                      </td>
                      <td className={ROWACT}>
                        {r.status !== 'completed' ? (
                          <button
                            className={`${BTN_B} ${BTN_SM}`}
                            disabled={busyId === r.id}
                            onClick={() => advance(r)}
                          >
                            {busyId === r.id
                              ? '…'
                              : r.status === 'requested'
                                ? 'Verify'
                                : 'Complete'}
                          </button>
                        ) : (
                          <span className={TD_T2}>{formatDate(r.completedAt)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
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
