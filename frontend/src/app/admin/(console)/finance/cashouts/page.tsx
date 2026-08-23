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
import { BTN_B, BTN_O, BTN_SM, FILTERBAR, ROWACT, TD_NUM, TD_T1, TD_T2, UNIT } from '@/components/admin/styles';

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
            title="No cash-outs"
            desc="Requests appear here when a customer asks to withdraw their wallet balance."
          />
        ) : (
          <>
            <TableWrap minWidth={1000}>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className={TD_NUM}>Amount</th>
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
                    <tr key={r.id} className="group">
                      <td>
                        <div className={TD_T1}>{r.account?.name ?? '—'}</div>
                        <div className={TD_T2}>{r.account?.phone ?? ''}</div>
                      </td>
                      <td className={TD_NUM}>
                        <span className={UNIT}>৳</span> {formatBDT(r.amount)}
                      </td>
                      <td>{METHOD_LABEL[r.method]}</td>
                      <td className={TD_T2}>
                        {r.bankName ? `${r.bankName} · ` : ''}
                        {r.accountRef}
                      </td>
                      <td>
                        <Pill tone={CASHOUT_TONE[r.status]}>{r.status}</Pill>
                      </td>
                      <td className={TD_T2}>{formatDate(r.createdAt)}</td>
                      <td className={ROWACT}>
                        {r.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className={`${BTN_B} ${BTN_SM}`}
                              disabled={busyId === r.id}
                              onClick={() => resolve(r, 'approve')}
                            >
                              {busyId === r.id ? '…' : 'Approve'}
                            </button>
                            <button
                              className={`${BTN_O} ${BTN_SM}`}
                              disabled={busyId === r.id}
                              onClick={() => resolve(r, 'reject')}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className={TD_T2}>
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
