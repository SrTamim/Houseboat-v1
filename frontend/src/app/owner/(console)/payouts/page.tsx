'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import { PageHead, Card, Kpi, Kpis, Note, TableWrap, AsyncTable } from '@/components/owner/ui';
import { Pill } from '@/components/owner/Pill';
import { money, formatDate, isNegative } from '@/lib/owner/format';

interface PayoutBatch {
  id: string;
  totalAmount: string;
  status: string;
  paidAt: string | null;
  preparedBy: string | null;
  approvedBy: string | null;
  invoiceCount: number;
  invoices: { id: string; bookingId: string; dueToBoat: string }[];
}

interface BoatProfile {
  bankAccount: Record<string, unknown> | null;
}

const STATUS_TONES: Record<string, 'blue' | 'ok' | 'warn'> = {
  prepared: 'warn',
  approved: 'blue',
  paid: 'ok',
};

function batchRef(id: string): string {
  return `#${id.slice(-6).toUpperCase()}`;
}

export default function OwnerPayoutsPage() {
  const { boatId } = useActiveBoat();

  const { data, error, isLoading, mutate } = useSWR<PayoutBatch[]>(
    `/houseboats/${boatId}/payout-batches`,
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: boat } = useSWR<BoatProfile>(
    `/houseboats/${boatId}/manage`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const batches = data ?? [];
  const pending = batches.filter((b) => b.status !== 'paid');
  const lastPaid = batches.find((b) => b.status === 'paid');
  const pendingTotal = pending.reduce((s, b) => s + Number(b.totalAmount), 0);

  // Bank account shape is bank-dependent, so read defensively for display.
  // Canonical key is accountNo; older/seed records used accountNumber (see
  // profile page's normalizeBank), so fall back to it.
  const account = boat?.bankAccount as
    | { accountNo?: string; accountNumber?: string; bankName?: string }
    | null
    | undefined;
  const acctNo = account?.accountNo ?? account?.accountNumber;
  const hasBank = Boolean(acctNo);
  const masked = acctNo ? `••${String(acctNo).slice(-4)}` : '—';

  return (
    <>
      <PageHead
        title="Payouts"
        desc={
          <>
            Weekly. Platform finance batches every verified invoice for your boat, nets
            commission, and transfers. A batch total is <b>signed</b> — it can go negative
            when cash sales and low deposits leave you owing the platform.
          </>
        }
      />

      <Kpis>
        <Kpi
          icon="💸"
          label="Pending"
          value={money(pendingTotal.toFixed(2))}
          detail={`${pending.reduce((s, b) => s + b.invoiceCount, 0)} invoices in batch`}
        />
        <Kpi
          icon="📅"
          label="Last transfer"
          value={lastPaid ? formatDate(lastPaid.paidAt) : '—'}
          detail={lastPaid ? money(lastPaid.totalAmount) : 'Nothing paid out yet'}
        />
        <Kpi
          icon="🏦"
          label="Paid into"
          value={masked}
          detail={(account?.bankName as string) ?? 'No bank account on file'}
          alert={!hasBank}
        />
      </Kpis>

      {!hasBank ? (
        <Note kind="warn" style={{ marginBottom: 20 }}>
          No bank account is on file, so a payout cannot run at all. Add one from the boat
          profile.
        </Note>
      ) : null}

      <Card flush>
        <TableWrap minWidth={820}>
          <thead>
            <tr>
              <th>Batch</th>
              <th>Invoices</th>
              <th className="num">Total</th>
              <th>Prepared</th>
              <th>Approved</th>
              <th>Paid</th>
              <th>Status</th>
            </tr>
          </thead>
          <AsyncTable
            isLoading={isLoading}
            error={error}
            isEmpty={batches.length === 0}
            onRetry={() => mutate()}
            empty={
              <div className="state">
                <div className="ic">💸</div>
                <h4>No payouts yet</h4>
                <p>
                  Batches appear once finance settles verified invoices for this boat.
                  Only gateway money is settled — cash stays with you.
                </p>
              </div>
            }
          >
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td className="t1">{batchRef(b.id)}</td>
                  <td>{b.invoiceCount}</td>
                  <td className={`num${isNegative(b.totalAmount) ? ' neg' : ''}`}>
                    {money(b.totalAmount)}
                  </td>
                  <td className="t2">{b.preparedBy ?? '—'}</td>
                  <td className="t2">{b.approvedBy ?? '—'}</td>
                  <td className="t2">{b.paidAt ? formatDate(b.paidAt) : '—'}</td>
                  <td>
                    <Pill tone={STATUS_TONES[b.status] ?? 'mut'}>{b.status}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </AsyncTable>
        </TableWrap>
      </Card>

      <Note kind="info" style={{ marginTop: 16 }}>
        Cash never entered the platform account, so it is never part of <b>due to boat</b>.
        A negative batch offsets your platform balance — if that debt sits unpaid past the
        grace period, the console locks until it is settled.
      </Note>
    </>
  );
}
