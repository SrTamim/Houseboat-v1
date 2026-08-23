'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import {
  PageHead,
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

interface CashoutRow {
  id: string;
  amount: string;
  method: 'bkash' | 'nagad' | 'bank';
  accountRef: string;
  bankName: string | null;
  status: 'pending' | 'approved' | 'rejected';
  note: string | null;
  createdAt: string;
  resolvedAt: string | null;
  account: { id: string; name: string | null; phone: string } | null;
  resolvedByAccount: { id: string; name: string | null } | null;
}

const CASHOUT_TONE = {
  pending: 'warn',
  approved: 'ok',
  rejected: 'danger',
} as const;

const METHOD_LABEL: Record<CashoutRow['method'], string> = {
  bkash: '📱 bKash',
  nagad: '💗 Nagad',
  bank: '🏦 Bank',
};

const STATUS_OPTIONS = [
  { value: '', label: 'All cash-outs' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function Cashouts() {
  const [status, setStatus] = useState('');
  const { items, error, isInitialLoading, hasMore, loadMore, mutate } =
    useAdminList<CashoutRow>('/platform/finance/cashouts', {
      status: status || undefined,
      limit: 25,
    });

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function resolve(row: CashoutRow, outcome: 'approve' | 'reject') {
    if (busyId) return;
    setBusyId(row.id);
    setActionError(null);
    try {
      await api.post(`/platform/finance/cashouts/${row.id}/${outcome}`);
      await mutate();
    } catch (e) {
      const message =
        (e as { response?: { data?: { message?: unknown } } })?.response?.data
          ?.message;
      setActionError(
        typeof message === 'string' ? message : `Could not ${outcome} this cash-out.`,
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHead
        title="Cash-outs"
        desc={
          <>
            Customer requests to withdraw wallet credit to bKash/Nagad/bank. Approving
            burns the locked credit (money leaves the wallet); rejecting returns it to
            the customer&rsquo;s spendable balance. Transfer the money out-of-band, then
            approve.
          </>
        }
      />
      <div className="filterbar">
        <Select options={STATUS_OPTIONS} value={status} onChange={setStatus} />
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
        ) : !isInitialLoading && items.length === 0 ? (
          <EmptyState
            title="No cash-outs"
            desc="Requests appear here when a customer asks to withdraw their wallet balance."
          />
        ) : (
          <>
            <TableWrap minWidth={1000}>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className="num">Amount</th>
                  <th>Method</th>
                  <th>Send to</th>
                  <th>Status</th>
                  <th>Requested</th>
                  <th />
                </tr>
              </thead>
              {isInitialLoading ? (
                <TableSkeleton rows={5} cols={7} />
              ) : (
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div className="t1">{r.account?.name ?? '—'}</div>
                        <div className="t2">{r.account?.phone ?? ''}</div>
                      </td>
                      <td className="num">
                        <span className="u">৳</span> {formatBDT(r.amount)}
                      </td>
                      <td>{METHOD_LABEL[r.method]}</td>
                      <td className="t2">
                        {r.bankName ? `${r.bankName} · ` : ''}
                        {r.accountRef}
                      </td>
                      <td>
                        <Pill tone={CASHOUT_TONE[r.status]}>{r.status}</Pill>
                      </td>
                      <td className="t2">{formatDate(r.createdAt)}</td>
                      <td className="rowact">
                        {r.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="btn btn-sm btn-b"
                              disabled={busyId === r.id}
                              onClick={() => resolve(r, 'approve')}
                            >
                              {busyId === r.id ? '…' : 'Approve'}
                            </button>
                            <button
                              className="btn btn-sm btn-o"
                              disabled={busyId === r.id}
                              onClick={() => resolve(r, 'reject')}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="t2">
                            {r.resolvedByAccount?.name ?? ''} · {formatDate(r.resolvedAt)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </TableWrap>
            {hasMore ? (
              <div style={{ padding: 12, textAlign: 'center' }}>
                <button className="btn btn-o btn-sm" onClick={loadMore}>
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
