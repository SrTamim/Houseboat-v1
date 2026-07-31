'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
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
import { money, formatDate, isNegative, humanize } from '@/lib/owner/format';

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
  commissionTotal: string | null;
  amountDue: string;
  status: string;
  issuedAt: string;
}

const STATUS_TONES: Record<string, 'ok' | 'warn' | 'danger' | 'mut'> = {
  paid: 'ok',
  issued: 'warn',
  overdue: 'danger',
};

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
  const unpaid = rows.filter((r) => r.status !== 'paid');

  return (
    <>
      <PageHead
        title="Platform billing"
        desc={
          <>
            The monthly bill the <b>platform</b> sends you — separate from booking
            commission. A monthly fee and commission can both apply, and billing is per
            boat, never combined across the boats you operate.
          </>
        }
      />

      {s?.locked ? (
        <Note kind="danger" style={{ marginBottom: 20 }}>
          This boat is locked. An overdue bill passed its grace period, so everything
          except this page is read-only until it is settled. Pay through the platform
          finance team to unlock.
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
        sub="monthly fee + commission total"
        flush
        style={{ marginBottom: 20 }}
      >
        <TableWrap minWidth={720}>
          <thead>
            <tr>
              <th>Period</th>
              <th className="num">Monthly fee</th>
              <th className="num">Commission</th>
              <th className="num">Due</th>
              <th>Issued</th>
              <th>Status</th>
            </tr>
          </thead>
          <AsyncTable
            isLoading={invoices.isLoading}
            error={invoices.error}
            isEmpty={rows.length === 0}
            onRetry={() => invoices.mutate()}
            empty={
              <div className="state">
                <div className="ic">🏛</div>
                <h4>No bills yet</h4>
                <p>
                  The platform issues a bill per month once your trial ends. Nothing is
                  owed before then.
                </p>
              </div>
            }
          >
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="t1">{r.period}</td>
                  <td className="num">{money(r.monthlyFee ?? 0)}</td>
                  <td className="num">{money(r.commissionTotal ?? 0)}</td>
                  <td className="num">{money(r.amountDue)}</td>
                  <td className="t2">{formatDate(r.issuedAt)}</td>
                  <td>
                    <Pill tone={STATUS_TONES[r.status] ?? 'mut'}>{humanize(r.status)}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </AsyncTable>
        </TableWrap>
      </Card>

      <Card title="How this bill is settled">
        <AsyncBlock isLoading={status.isLoading} error={status.error} onRetry={() => status.mutate()}>
          <div className="stack" style={{ gap: 10 }}>
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
