'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import { useOwnerList } from '@/lib/owner/useOwnerList';
import {
  PageHead,
  Card,
  Kpi,
  Kpis,
  Note,
  TableWrap,
  AsyncTable,
  LoadMore,
} from '@/components/owner/ui';
import { Pill } from '@/components/owner/Pill';
import { money, formatDateTime, apiErrorMessage, maskPhone } from '@/lib/owner/format';

interface PaymentInvoice {
  id: string;
  displayTotal: string;
  amountPaid: string;
  status: string;
  customer: { name: string | null; phone: string };
  payments: {
    id: string;
    amount: string;
    method: string;
    paidAt: string | null;
    verifiedBy: string | null;
    receivedByAccount: { name: string | null } | null;
    verifiedByAccount: { name: string | null } | null;
  }[];
}

function invoiceRef(id: string): string {
  return `#${id.slice(-6).toUpperCase()}`;
}

export default function OwnerPaymentsPage() {
  const { boatId } = useActiveBoat();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // The verification queue: invoices carrying cash nobody has checked.
  const pending = useOwnerList<PaymentInvoice>(`/houseboats/${boatId}/invoices`, {
    cashPending: true,
  });

  // The full log, for context on what has already been settled.
  const log = useOwnerList<PaymentInvoice>(`/houseboats/${boatId}/invoices`, {});

  const { data: dash } = useSWR<{ kpis: { cashToVerify: number; cashToVerifyAmount: string } }>(
    `/houseboats/${boatId}/dashboard`,
    fetcher,
    { revalidateOnFocus: false },
  );

  async function verify(invoiceId: string) {
    if (busyId) return;
    setBusyId(invoiceId);
    setActionError(null);
    try {
      await api.post(`/invoices/${invoiceId}/verify`);
      await Promise.all([pending.mutate(), log.mutate()]);
    } catch (e) {
      setActionError(apiErrorMessage(e, 'Could not verify this payment.'));
    } finally {
      setBusyId(null);
    }
  }

  const verifiedToday = log.items
    .flatMap((i) => i.payments)
    .filter(
      (p) =>
        p.verifiedBy &&
        p.paidAt &&
        new Date(p.paidAt).toDateString() === new Date().toDateString(),
    );

  const gatewayPending = log.items
    .flatMap((i) => i.payments)
    .filter((p) => p.method === 'gateway' && !p.verifiedBy);

  return (
    <>
      <PageHead
        title="Payments"
        desc={
          <>
            Cash taken at the counter is verified <b>by you</b> — it never touches the
            gateway. Online payments are verified by platform finance instead, so they
            are shown here for information only.
          </>
        }
      />

      {actionError ? (
        <Note kind="danger" style={{ marginBottom: 18 }}>
          {actionError}
        </Note>
      ) : null}

      <Kpis>
        <Kpi
          icon="💵"
          label="Cash to verify"
          value={dash?.kpis.cashToVerify ?? pending.items.length}
          alert={(dash?.kpis.cashToVerify ?? pending.items.length) > 0}
          detail={dash ? money(dash.kpis.cashToVerifyAmount) : undefined}
        />
        <Kpi
          icon="✓"
          label="Verified today"
          value={verifiedToday.length}
          detail={money(
            verifiedToday.reduce((s, p) => s + Number(p.amount), 0).toFixed(2),
          )}
        />
        <Kpi
          icon="💳"
          label="Online awaiting finance"
          value={gatewayPending.length}
          detail="Out of your hands"
        />
      </Kpis>

      <Card title="Cash awaiting your verification" flush>
        <TableWrap minWidth={720}>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Guest</th>
              <th>Taken by</th>
              <th className="num">Amount</th>
              <th>When</th>
              <th />
            </tr>
          </thead>
          <AsyncTable
            isLoading={pending.isInitialLoading}
            error={pending.error}
            isEmpty={pending.items.length === 0}
            onRetry={() => pending.mutate()}
            empty={
              <div className="state">
                <div className="ic">✓</div>
                <h4>No cash waiting</h4>
                <p>Every counter payment has been verified.</p>
              </div>
            }
          >
            <tbody>
              {pending.items.map((inv) => {
                const cash = inv.payments.filter((p) => p.method === 'cash' && !p.verifiedBy);
                const total = cash.reduce((s, p) => s + Number(p.amount), 0);
                const latest = cash[cash.length - 1];
                return (
                  <tr key={inv.id}>
                    <td className="t1">{invoiceRef(inv.id)}</td>
                    <td>
                      <div className="t1">{inv.customer.name ?? 'Walk-in'}</div>
                      <div className="t2">{maskPhone(inv.customer.phone)}</div>
                    </td>
                    <td className="t2">{latest?.receivedByAccount?.name ?? '—'}</td>
                    <td className="num">{money(total.toFixed(2))}</td>
                    <td className="t2">{formatDateTime(latest?.paidAt)}</td>
                    <td>
                      <div className="rowact">
                        <button
                          className="btn btn-sm btn-ok"
                          onClick={() => verify(inv.id)}
                          disabled={busyId === inv.id}
                        >
                          {busyId === inv.id ? 'Verifying…' : 'Verify'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </AsyncTable>
        </TableWrap>
      </Card>

      <Card title="Payment log" sub="gateway + cash" flush style={{ marginTop: 20 }}>
        <TableWrap minWidth={720}>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Method</th>
              <th className="num">Amount</th>
              <th>Received by</th>
              <th>Verified by</th>
              <th>Status</th>
            </tr>
          </thead>
          <AsyncTable
            isLoading={log.isInitialLoading}
            error={log.error}
            isEmpty={log.items.every((i) => i.payments.length === 0)}
            onRetry={() => log.mutate()}
            empty={
              <div className="state">
                <div className="ic">💵</div>
                <h4>No payments yet</h4>
                <p>Payments appear here as bookings are paid for.</p>
              </div>
            }
          >
            <tbody>
              {log.items.flatMap((inv) =>
                inv.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="t1">{invoiceRef(inv.id)}</td>
                    <td>
                      <Pill tone={p.method === 'cash' ? 'amb' : 'blue'}>{p.method}</Pill>
                    </td>
                    <td className="num">{money(p.amount)}</td>
                    <td className="t2">{p.receivedByAccount?.name ?? '—'}</td>
                    <td className="t2">{p.verifiedByAccount?.name ?? '—'}</td>
                    <td>
                      <Pill tone={p.verifiedBy ? 'ok' : 'warn'}>
                        {p.verifiedBy ? 'verified' : 'unverified'}
                      </Pill>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </AsyncTable>
        </TableWrap>
        <LoadMore hasMore={log.hasMore} isLoading={log.isLoading} onClick={log.loadMore} />
      </Card>
    </>
  );
}
