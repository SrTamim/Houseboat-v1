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
  Field,
  Seg,
  FilterBar,
  TableWrap,
  AsyncBlock,
} from '@/components/owner/ui';
import { Bill } from '@/components/owner/Bill';
import { money, moneyShort, formatDate, apiErrorMessage } from '@/lib/owner/format';

interface EarningsResponse {
  period: string;
  statement: {
    roomRevenue: string;
    commission: string;
    gatewayFees: string;
    payoutsReceived: string;
    operatingCosts: string;
    crewPayroll: string;
    subscriptionFees: string;
    net: string;
  };
  distributions: {
    id: string;
    membershipId: string;
    name: string;
    shareholderPct: number | null;
    amount: string;
    note: string | null;
    at: string;
  }[];
  distributionsTotal: string;
}

interface SuggestedSplit {
  membershipId: string;
  accountId: string;
  shareholderPct: number;
  amount: string;
}

/** Last `count` months as YYYY-MM, most recent first. */
function recentMonths(count: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  });
}

export default function OwnerEarningsPage() {
  const { boatId } = useActiveBoat();
  const months = recentMonths(3);
  const [period, setPeriod] = useState(months[0]);

  const [amount, setAmount] = useState('');
  const [membershipId, setMembershipId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR<EarningsResponse>(
    `/houseboats/${boatId}/earnings?month=${period}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  // Suggested split by shareholder %, so the owner doesn't do the arithmetic.
  const { data: suggested } = useSWR<SuggestedSplit[]>(
    amount ? `/houseboats/${boatId}/distributions/suggest?amount=${amount}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const s = data?.statement;

  async function recordDistribution(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !membershipId || !amount) return;
    setBusy(true);
    setFormError(null);
    try {
      await api.post(`/houseboats/${boatId}/distributions`, {
        membershipId,
        amount: Number(amount),
        note: note || undefined,
      });
      setAmount('');
      setNote('');
      setMembershipId('');
      await mutate();
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not record the distribution.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="Earnings statement"
        desc="What came in, what the platform took, what you paid out, and what is left. Co-owner withdrawals are recorded at the bottom."
        actions={
          <FilterBar>
            <Seg
              options={months.map((m) => ({ value: m, label: monthLabel(m) })).reverse()}
              value={period}
              onChange={setPeriod}
            />
          </FilterBar>
        }
      />

      <Kpis>
        <Kpi
          icon="৳"
          label="Room revenue"
          value={s ? moneyShort(s.roomRevenue) : '—'}
          detail={`${monthLabel(period)} bookings`}
        />
        <Kpi
          icon="%"
          label="Commission paid"
          value={s ? moneyShort(s.commission) : '—'}
          detail="Platform share of room total"
        />
        <Kpi
          icon="🧾"
          label="Costs"
          value={s ? moneyShort(s.operatingCosts) : '—'}
          detail="Fuel · bazar · repairs"
        />
        <Kpi
          icon="💰"
          label="Net"
          value={s ? moneyShort(s.net) : '—'}
          detail="Before distributions"
        />
      </Kpis>

      <div className="grid-2">
        <Card title={`${monthLabel(period)} statement`}>
          <AsyncBlock isLoading={isLoading} error={error} onRetry={() => mutate()}>
            {s ? (
              <Bill
                rows={[
                  { label: 'Room revenue', hint: 'Owner-set prices', value: s.roomRevenue },
                  { label: 'Commission (platform)', value: s.commission, negative: true },
                  {
                    label: 'Payouts received',
                    hint: 'Transferred to your bank',
                    value: s.payoutsReceived,
                    sub: true,
                  },
                  { label: 'Operating costs', value: s.operatingCosts, negative: true },
                  { label: 'Crew payroll', value: s.crewPayroll, negative: true },
                  { label: `Net for ${monthLabel(period)}`, value: s.net, total: true },
                ]}
              />
            ) : null}
            <Note kind="info" style={{ marginTop: 14 }}>
              Payouts received is what actually landed in your bank; net is the trading
              result including cash you kept at the counter. They differ on purpose.
            </Note>
          </AsyncBlock>
        </Card>

        <div className="stack">
          <Card title="Distributions" sub="recorded withdrawals · no auto-split" flush>
            <AsyncBlock
              isLoading={isLoading}
              error={error}
              isEmpty={(data?.distributions.length ?? 0) === 0}
              onRetry={() => mutate()}
              empty={
                <div className="state">
                  <div className="ic">💰</div>
                  <h4>Nothing withdrawn</h4>
                  <p>Log what each partner actually took out.</p>
                </div>
              }
            >
              <TableWrap minWidth={0}>
                <thead>
                  <tr>
                    <th>Shareholder</th>
                    <th>%</th>
                    <th className="num">Taken</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.distributions.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <div className="t1">{d.name}</div>
                        <div className="t2">{formatDate(d.at)}</div>
                      </td>
                      <td>{d.shareholderPct !== null ? `${d.shareholderPct}%` : '—'}</td>
                      <td className="num">{money(d.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>Total this period</td>
                    <td className="num">{money(data?.distributionsTotal)}</td>
                  </tr>
                </tfoot>
              </TableWrap>
            </AsyncBlock>
          </Card>

          <Card title="Record a withdrawal">
            <form onSubmit={recordDistribution} style={{ display: 'grid', gap: 12 }}>
              {formError ? <Note kind="danger">{formError}</Note> : null}

              <Field label="Amount (৳)">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="100000"
                  required
                />
              </Field>

              {suggested && suggested.length > 0 ? (
                <div>
                  <div
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '.06em',
                      color: 'var(--muted)',
                      marginBottom: 6,
                    }}
                  >
                    Suggested split — pick whose withdrawal this is
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {suggested.map((sg) => (
                      <button
                        key={sg.membershipId}
                        type="button"
                        className={`btn btn-o btn-sm${
                          membershipId === sg.membershipId ? ' btn-b' : ''
                        }`}
                        style={{ justifyContent: 'space-between' }}
                        onClick={() => setMembershipId(sg.membershipId)}
                      >
                        <span>{sg.shareholderPct}% share</span>
                        <span>{money(sg.amount)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <Field label="Note">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="July drawing"
                />
              </Field>

              <div>
                <button className="btn btn-b" type="submit" disabled={busy || !membershipId}>
                  {busy ? 'Recording…' : 'Record withdrawal'}
                </button>
              </div>

              <Note kind="info">
                Shareholder % is a record only — the system never splits profit
                automatically. Log what each partner actually withdrew.
              </Note>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
