'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import {
  PageHead,
  Card,
  Kpi,
  Kpis,
  Kv,
  Note,
  TableWrap,
  AsyncBlock,
} from '@/components/owner/ui';
import { Pill, DepartureStatusPill } from '@/components/owner/Pill';
import {
  money,
  formatDate,
  formatDateTime,
  humanize,
  timeLeft,
} from '@/lib/owner/format';

interface DashboardResponse {
  boat: {
    id: string;
    name: string;
    slug: string;
    status: string;
    profileCompletePct: number;
    hasBankAccount: boolean;
  };
  kpis: {
    departingToday: number;
    cabinsSoldToday: number;
    cabinsTotalToday: number;
    cashToVerify: number;
    cashToVerifyAmount: string;
    payoutPending: string;
    payoutInvoiceCount: number;
    crewUnpaid: number;
    lowStock: number;
    lowStockNames: string[];
    quotesWaiting: number;
    nextQuoteExpiresAt: string | null;
  };
  departuresToday: {
    id: string;
    label: string | null;
    ghat: string | null;
    departureTime: string | null;
    status: string;
    cabinsSold: number;
    cabinsTotal: number;
    guests: number;
    crewPresent: number;
    crewTotal: number;
  }[];
  week: {
    bookings: number;
    roomRevenue: string;
    commission: string;
    costs: string;
    netEstimate: string;
  };
  billing: {
    locked: boolean;
    platformBalance: string;
    trialEnds: string | null;
    unpaidSubscription: {
      id: string;
      period: string;
      amountDue: string;
      issuedAt: string;
    } | null;
  };
  recentActivity: {
    id: string;
    action: string;
    entityType: string | null;
    serverTime: string;
    actor: { name: string | null; phone: string } | null;
  }[];
  badges: Record<string, number>;
}

/** One row of the "needs you now" queue. */
interface TodoRow {
  tone: 'warn' | 'danger' | 'blue';
  label: string;
  detail: string;
  href: string;
  action: string;
}

/** Greeting keyed off the viewer's own clock, not the server's. */
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Everything that needs a decision, most urgent first.
 *
 * Built from the same payload the KPIs use rather than a second endpoint —
 * the dashboard call already knows all of it.
 */
function buildTodos(d: DashboardResponse): TodoRow[] {
  const todos: TodoRow[] = [];

  if (d.kpis.cashToVerify > 0) {
    todos.push({
      tone: 'warn',
      label: 'Verify cash',
      detail: `${d.kpis.cashToVerify} payment${d.kpis.cashToVerify > 1 ? 's' : ''} · ${money(d.kpis.cashToVerifyAmount)} taken at the counter`,
      href: '/owner/payments',
      action: 'Verify',
    });
  }
  if (d.billing.unpaidSubscription) {
    todos.push({
      tone: 'danger',
      label: 'Billing',
      detail: `${d.billing.unpaidSubscription.period} bill unpaid · ${money(d.billing.unpaidSubscription.amountDue)} due`,
      href: '/owner/billing',
      action: 'Open',
    });
  }
  if (d.kpis.lowStock > 0) {
    todos.push({
      tone: 'danger',
      label: 'Low stock',
      detail: `${d.kpis.lowStockNames.join(' · ')} below reorder level`,
      href: '/owner/inventory',
      action: 'Open',
    });
  }
  if (d.kpis.quotesWaiting > 0) {
    todos.push({
      tone: 'blue',
      label: 'Quote',
      detail: d.kpis.nextQuoteExpiresAt
        ? `${d.kpis.quotesWaiting} waiting · next expires ${timeLeft(d.kpis.nextQuoteExpiresAt)}`
        : `${d.kpis.quotesWaiting} waiting to be priced`,
      href: '/owner/quotes',
      action: 'Price it',
    });
  }
  if (d.kpis.crewUnpaid > 0) {
    todos.push({
      tone: 'warn',
      label: 'Payroll',
      detail: `${d.kpis.crewUnpaid} crew wage${d.kpis.crewUnpaid > 1 ? 's' : ''} still unpaid`,
      href: '/owner/payroll',
      action: 'Open',
    });
  }
  if ((d.badges.refunds ?? 0) > 0) {
    todos.push({
      tone: 'warn',
      label: 'Refund',
      detail: `${d.badges.refunds} refund${d.badges.refunds > 1 ? 's' : ''} awaiting the next step`,
      href: '/owner/refunds',
      action: 'Open',
    });
  }
  if ((d.badges.maintenance ?? 0) > 0) {
    todos.push({
      tone: 'warn',
      label: 'Maintenance',
      detail: `${d.badges.maintenance} service or damage item${d.badges.maintenance > 1 ? 's' : ''} open`,
      href: '/owner/maintenance',
      action: 'Open',
    });
  }

  return todos;
}

export default function OwnerDashboardPage() {
  const { boatId, boat } = useActiveBoat();
  const { data, error, isLoading, mutate } = useSWR<DashboardResponse>(
    `/houseboats/${boatId}/dashboard`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const todos = data ? buildTodos(data) : [];
  const k = data?.kpis;

  return (
    <>
      <PageHead
        title={`${greeting()}${boat.name ? '' : ''}`}
        desc={`What ${boat.name} needs from you right now — before the next departure leaves the ghat.`}
        actions={
          <>
            <Link className="btn btn-o" href="/owner/costs">
              ＋ Log a cost
            </Link>
            <Link className="btn btn-b" href="/owner/pos">
              🧾 Counter sale →
            </Link>
          </>
        }
      />

      {data?.billing.locked ? (
        <Note kind="danger" style={{ marginBottom: 20 }}>
          This boat is locked because an overdue platform bill has passed its grace
          period. Bookings and settings are read-only until it is settled —{' '}
          <Link href="/owner/billing" style={{ textDecoration: 'underline' }}>
            open billing
          </Link>
          .
        </Note>
      ) : null}

      <Kpis>
        <Kpi
          icon="⛴️"
          label="Departing today"
          value={k?.departingToday ?? '—'}
          detail={
            k && k.cabinsTotalToday > 0
              ? `${k.cabinsSoldToday} of ${k.cabinsTotalToday} cabins sold`
              : 'No departures scheduled'
          }
        />
        <Kpi
          icon="💵"
          label="Cash to verify"
          value={k?.cashToVerify ?? '—'}
          alert={Boolean(k && k.cashToVerify > 0)}
          detail={k ? `${money(k.cashToVerifyAmount)} taken at counter` : undefined}
        />
        <Kpi
          icon="💸"
          label="Payout pending"
          value={k ? money(k.payoutPending) : '—'}
          detail={k ? `${k.payoutInvoiceCount} invoices in batch` : undefined}
        />
        <Kpi
          icon="💰"
          label="Crew unpaid"
          value={k?.crewUnpaid ?? '—'}
          alert={Boolean(k && k.crewUnpaid > 0)}
          detail="Wages pending"
        />
        <Kpi
          icon="📦"
          label="Low stock"
          value={k?.lowStock ?? '—'}
          alert={Boolean(k && k.lowStock > 0)}
          detail={k?.lowStockNames.length ? k.lowStockNames.join(' · ') : 'All above reorder'}
        />
        <Kpi
          icon="💬"
          label="Quotes waiting"
          value={k?.quotesWaiting ?? '—'}
          detail={
            k?.nextQuoteExpiresAt
              ? `Next expires ${timeLeft(k.nextQuoteExpiresAt)}`
              : 'Nothing to price'
          }
        />
      </Kpis>

      <div className="grid-2">
        <div className="stack">
          <Card title="Needs you now" sub="most urgent first" flush>
            <AsyncBlock
              isLoading={isLoading}
              error={error}
              isEmpty={!isLoading && todos.length === 0}
              onRetry={() => mutate()}
              empty={
                <div className="state">
                  <div className="ic">✓</div>
                  <h4>Nothing needs you</h4>
                  <p>No cash to verify, no bills due, nothing low on stock.</p>
                </div>
              }
            >
              <TableWrap>
                <thead>
                  <tr>
                    <th>What</th>
                    <th>Detail</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {todos.map((t, i) => (
                    <tr key={i}>
                      <td>
                        <Pill tone={t.tone}>{t.label}</Pill>
                      </td>
                      <td>{t.detail}</td>
                      <td>
                        <div className="rowact">
                          <Link className="btn btn-sm btn-o" href={t.href}>
                            {t.action}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </AsyncBlock>
          </Card>

          <Card title="Today's departures" sub="status is time-driven" flush>
            <AsyncBlock
              isLoading={isLoading}
              error={error}
              isEmpty={!isLoading && (data?.departuresToday.length ?? 0) === 0}
              onRetry={() => mutate()}
              empty={
                <div className="state">
                  <div className="ic">🗓</div>
                  <h4>Nothing leaves today</h4>
                  <p>Set operating dates and add departures from the schedule editor.</p>
                </div>
              }
            >
              <TableWrap>
                <thead>
                  <tr>
                    <th>Trip</th>
                    <th>Depart</th>
                    <th>Cabins</th>
                    <th>Crew</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.departuresToday.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <div className="t1">{d.label ?? 'Trip'}</div>
                        <div className="t2">{d.ghat ?? '—'}</div>
                      </td>
                      <td className="t2">
                        {d.departureTime
                          ? new Date(d.departureTime).toISOString().slice(11, 16)
                          : '—'}
                      </td>
                      <td>
                        <b className="money">
                          {d.cabinsSold} / {d.cabinsTotal}
                        </b>
                        <span className="t2"> · {d.guests} guests</span>
                      </td>
                      <td>
                        <Pill tone={d.crewPresent === d.crewTotal && d.crewTotal > 0 ? 'ok' : 'warn'}>
                          {d.crewPresent} of {d.crewTotal} present
                        </Pill>
                      </td>
                      <td>
                        <DepartureStatusPill status={d.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </AsyncBlock>
          </Card>
        </div>

        <div className="stack">
          <Card title="This week">
            <AsyncBlock isLoading={isLoading} error={error} onRetry={() => mutate()}>
              <Kv
                rows={[
                  ['Bookings', data?.week.bookings ?? 0],
                  ['Room revenue', <span className="money" key="r">{money(data?.week.roomRevenue)}</span>],
                  ['Commission', <span className="money" key="c">{money(data?.week.commission)}</span>],
                  ['Costs logged', <span className="money" key="k">{money(data?.week.costs)}</span>],
                  [
                    'Net (est.)',
                    <span
                      className={`money${Number(data?.week.netEstimate ?? 0) < 0 ? ' neg' : ''}`}
                      key="n"
                    >
                      {money(data?.week.netEstimate)}
                    </span>,
                  ],
                ]}
              />
              <Note kind="info" style={{ marginTop: 14 }}>
                Cash never touches the platform, so it is not in the weekly payout —
                verify it at the counter and it lands in your reports.
              </Note>
            </AsyncBlock>
          </Card>

          <Card title="Recent activity" sub="from audit log" flush>
            <AsyncBlock
              isLoading={isLoading}
              error={error}
              isEmpty={!isLoading && (data?.recentActivity.length ?? 0) === 0}
              onRetry={() => mutate()}
              empty={<EmptyActivity />}
            >
              <TableWrap minWidth={0}>
                <tbody>
                  {data?.recentActivity.map((a) => (
                    <tr key={a.id}>
                      <td className="t1">{a.actor?.name ?? a.actor?.phone ?? 'system'}</td>
                      <td>
                        <Pill tone="mut">{humanize(a.action)}</Pill>
                      </td>
                      <td className="num t2">{formatDateTime(a.serverTime)}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </AsyncBlock>
          </Card>

          <Card title="Go-live health">
            <div className="stack" style={{ gap: 10 }}>
              {data ? (
                <>
                  <Note kind={data.boat.profileCompletePct >= 100 ? 'ok' : 'warn'}>
                    Profile {data.boat.profileCompletePct}%
                    {data.boat.hasBankAccount
                      ? ' · bank account on file'
                      : ' · no bank account yet — payouts cannot run'}
                    {' · '}
                    {humanize(data.boat.status)}
                  </Note>
                  {data.billing.trialEnds ? (
                    <Note kind="warn">
                      Trial ends {formatDate(data.billing.trialEnds)} — the first monthly
                      bill follows, plus commission.
                    </Note>
                  ) : null}
                  {Number(data.billing.platformBalance) < 0 ? (
                    <Note kind="danger">
                      Platform balance {money(data.billing.platformBalance)} — this boat
                      owes the platform.
                    </Note>
                  ) : null}
                </>
              ) : (
                <div className="skel" style={{ height: 40 }} />
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function EmptyActivity() {
  return (
    <div className="state">
      <div className="ic">📜</div>
      <h4>No activity yet</h4>
      <p>Every change to bookings, money and settings is recorded here.</p>
    </div>
  );
}
