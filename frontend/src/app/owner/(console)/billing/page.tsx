'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import {
  PageHead,
  Card,
  Kpi,
  Kpis,
  Note,
  TableWrap,
  AsyncTable,
  AsyncBlock,
} from '@/components/owner/ui';
import { Pill } from '@/components/owner/Pill';
import { BTN_B, BTN_SM } from '@/components/owner/styles';
import {
  money,
  formatDate,
  isNegative,
  humanize,
  apiErrorMessage,
} from '@/lib/owner/format';

interface BillingStatus {
  locked: boolean;
  platformBalance: string;
  trialEnds: string | null;
  graceDays?: number;
  amountDue?: string;
  daysLeft?: number | null;
}

interface SubscriptionInvoice {
  id: string;
  period: string;
  monthlyFee: string | null;
  amountDue: string;
  status: string;
  issuedAt: string;
}

/** "2026-08" → "August 2026". */
function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Last date to pay = issue date + grace days (the deadline the lock uses). */
function lastPayDate(issuedAt: string, graceDays: number | undefined): string {
  if (graceDays == null) return '—';
  const d = new Date(issuedAt);
  d.setUTCDate(d.getUTCDate() + graceDays);
  return formatDate(d.toISOString());
}

const STATUS_TONES: Record<string, 'ok' | 'warn' | 'danger' | 'mut'> = {
  paid: 'ok',
  issued: 'warn',
  overdue: 'danger',
  trial: 'mut',
};

const STATUS_LABELS: Record<string, string> = { trial: 'Free trial' };

/**
 * Platform billing.
 *
 * Both endpoints behind this page are allowWhenLocked on the backend, which is
 * the whole point: when a boat is locked the owner must still be able to open
 * this page, see the bill, and clear it.
 */
export default function OwnerBillingPage() {
  const { boatId } = useActiveBoat();

  const status = useSWR<BillingStatus>(
    `/houseboats/${boatId}/billing-status`,
    fetcher,
    { revalidateOnFocus: false },
  );
  const invoices = useSWR<SubscriptionInvoice[]>(
    `/houseboats/${boatId}/my-subscription-invoices`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const s = status.data;
  const rows = invoices.data ?? [];
  // A trial invoice is a $0 marker, not a bill owed — keep it out of "unpaid".
  const unpaid = rows.filter((r) => r.status !== 'paid' && r.status !== 'trial');

  const [payingId, setPayingId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  async function pay(invoiceId: string) {
    setPayingId(invoiceId);
    setPayError(null);
    try {
      await api.post(
        `/houseboats/${boatId}/subscription-invoices/${invoiceId}/pay`,
      );
      await Promise.all([invoices.mutate(), status.mutate()]);
    } catch (e) {
      setPayError(apiErrorMessage(e, 'Could not record the payment.'));
    } finally {
      setPayingId(null);
    }
  }

  return (
    <>
      <PageHead
        title="Platform billing"
        desc={
          <>
            The monthly bill the <b>platform</b> sends you for using the platform —
            the monthly fee your admin set. This is separate from booking commission
            (already withheld at booking), and billing is per boat, never combined
            across the boats you operate.
          </>
        }
      />

      {s?.locked ? (
        <Note kind="danger" style={{ marginBottom: 20 }}>
          This boat is locked. An overdue bill passed its grace period, so everything
          except this page is read-only until it is settled. Pay the bill below to
          unlock.
        </Note>
      ) : null}

      {payError ? (
        <Note kind="danger" style={{ marginBottom: 20 }}>
          {payError}
        </Note>
      ) : null}

      <Kpis>
        <Kpi
          icon="🔻"
          label="Platform balance"
          value={s ? money(s.platformBalance) : '—'}
          alert={Boolean(s && isNegative(s.platformBalance))}
          detail={
            s && isNegative(s.platformBalance)
              ? 'You owe the platform'
              : 'Nothing outstanding'
          }
        />
        <Kpi
          icon="⏱"
          label="Trial ends"
          value={s?.trialEnds ? formatDate(s.trialEnds) : '—'}
          detail={s?.trialEnds ? 'Then the monthly fee applies' : 'No trial on this boat'}
        />
        <Kpi
          icon="📄"
          label="Unpaid bills"
          value={unpaid.length}
          alert={unpaid.length > 0}
          detail={money(
            unpaid.reduce((sum, r) => sum + Number(r.amountDue), 0).toFixed(2),
          )}
        />
      </Kpis>

      <Card
        title="Subscription invoices"
        sub="the monthly platform fee — pay to keep the console unlocked"
        flush
        style={{ marginBottom: 20 }}
      >
        <TableWrap minWidth={820}>
          <thead>
            <tr>
              <th>Period</th>
              <th className="num">Monthly fee</th>
              <th className="num">Due</th>
              <th>Issued</th>
              <th>Last date to pay</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <AsyncTable
            isLoading={invoices.isLoading}
            error={invoices.error}
            isEmpty={rows.length === 0}
            onRetry={() => invoices.mutate()}
            empty={
              <div className="px-6 py-11 text-center text-muted">
                <div className="mb-2.5 text-[26px]">🏛</div>
                <h4 className="mb-1.5 text-[15px] text-ink">No bills yet</h4>
                <p className="mx-auto max-w-[46ch] text-[13px] leading-[1.55]">
                  The platform issues a bill per month once your trial ends. Nothing is
                  owed before then.
                </p>
              </div>
            }
          >
            <tbody>
              {rows.map((r) => {
                const isTrial = r.status === 'trial';
                const payable = !isTrial && r.status !== 'paid';
                return (
                  <tr key={r.id}>
                    <td className="t1">
                      {periodLabel(r.period)}
                      {isTrial && s?.trialEnds ? (
                        <div className="text-[12px] text-muted">
                          Trial {formatDate(r.issuedAt)} → {formatDate(s.trialEnds)}
                        </div>
                      ) : null}
                    </td>
                    <td className="num" data-label="Monthly fee">{isTrial ? '—' : money(r.monthlyFee ?? 0)}</td>
                    <td className="num" data-label="Due">{money(r.amountDue)}</td>
                    <td className="t2" data-label="Issued">{formatDate(r.issuedAt)}</td>
                    <td className="t2" data-label="Last date to pay">
                      {isTrial ? '—' : lastPayDate(r.issuedAt, s?.graceDays)}
                    </td>
                    <td data-label="Status">
                      <Pill tone={STATUS_TONES[r.status] ?? 'mut'}>
                        {STATUS_LABELS[r.status] ?? humanize(r.status)}
                      </Pill>
                    </td>
                    <td>
                      {payable ? (
                        <button
                          type="button"
                          className={`${BTN_B} ${BTN_SM}`}
                          disabled={payingId === r.id}
                          onClick={() => pay(r.id)}
                        >
                          {payingId === r.id ? 'Paying…' : 'Pay'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </AsyncTable>
        </TableWrap>
      </Card>

      <Card title="How this bill is settled">
        <AsyncBlock isLoading={status.isLoading} error={status.error} onRetry={() => status.mutate()}>
          <div className="flex flex-col gap-5" style={{ gap: 10 }}>
            <Note kind="info">
              Pressing <b>Pay</b> marks the bill settled. An online payment gateway is
              not connected yet — once it is, Pay will open it instead.
            </Note>
            <Note kind="info">
              An unpaid bill does not lock you out immediately — there is a grace period
              from the issue date. Only after it elapses does the console go read-only,
              and this page stays reachable throughout so you can always see what is owed.
            </Note>
            <Note kind="info">
              A negative payout batch offsets your platform balance instead of being paid
              out. That is the usual way a balance goes negative: cash sales leave the
              platform holding commission it never received.
            </Note>
          </div>
        </AsyncBlock>
      </Card>
    </>
  );
}
