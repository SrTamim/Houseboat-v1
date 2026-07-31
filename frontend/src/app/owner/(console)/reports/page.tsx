'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import {
  PageHead,
  Card,
  Kpi,
  Kpis,
  FilterBar,
  Seg,
  Note,
  TableWrap,
  AsyncTable,
} from '@/components/owner/ui';
import { money, moneyShort, formatDate, isNegative } from '@/lib/owner/format';

interface TripReport {
  month: string;
  trips: {
    departureId: string;
    date: string;
    label: string | null;
    status: string;
    cabinsSold: number;
    cabinsTotal: number;
    guests: number;
    revenue: string;
    commission: string;
    costs: string;
    crew: string;
    net: string;
  }[];
  totals: {
    revenue: string;
    commission: string;
    costs: string;
    crew: string;
    net: string;
  };
  averages: { fillPct: number; revenuePerTrip: string; marginPct: number };
}

interface MonthlyReport {
  months: {
    month: string;
    trips: number;
    revenue: string;
    commission: string;
    costs: string;
    crew: string;
    net: string;
    fillPct: number;
  }[];
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  });
}

export default function OwnerReportsPage() {
  const { boatId } = useActiveBoat();
  const [view, setView] = useState<'trips' | 'monthly'>('trips');

  const trips = useSWR<TripReport>(`/houseboats/${boatId}/reports/trips`, fetcher, {
    revalidateOnFocus: false,
  });
  const monthly = useSWR<MonthlyReport>(
    view === 'monthly' ? `/houseboats/${boatId}/reports/monthly?months=6` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const t = trips.data;

  return (
    <>
      <PageHead
        title="Reports"
        desc="Profit per trip and per month. Costs count against a trip only when you tagged them with one — untagged spending is boat-level overhead."
        actions={
          <FilterBar>
            <Seg
              options={[
                { value: 'trips', label: 'Per trip' },
                { value: 'monthly', label: 'Monthly' },
              ]}
              value={view}
              onChange={(v) => setView(v as 'trips' | 'monthly')}
            />
          </FilterBar>
        }
      />

      <Kpis>
        <Kpi
          icon="📈"
          label="Revenue"
          value={t ? moneyShort(t.totals.revenue) : '—'}
          detail={t ? `${t.trips.length} trips this month` : undefined}
        />
        <Kpi
          icon="🚪"
          label="Average fill"
          value={t ? `${t.averages.fillPct}%` : '—'}
          detail="Cabins sold against capacity"
        />
        <Kpi
          icon="৳"
          label="Revenue per trip"
          value={t ? moneyShort(t.averages.revenuePerTrip) : '—'}
          detail="Room revenue only"
        />
        <Kpi
          icon="💰"
          label="Margin"
          value={t ? `${t.averages.marginPct}%` : '—'}
          detail="Net against revenue"
          alert={Boolean(t && t.averages.marginPct < 0)}
        />
      </Kpis>

      {view === 'trips' ? (
        <Card title={`Profit per trip · ${t ? monthLabel(t.month) : ''}`} flush>
          <TableWrap minWidth={860}>
            <thead>
              <tr>
                <th>Departure</th>
                <th>Cabins</th>
                <th className="num">Revenue</th>
                <th className="num">Commission</th>
                <th className="num">Costs</th>
                <th className="num">Crew</th>
                <th className="num">Net</th>
              </tr>
            </thead>
            <AsyncTable
              isLoading={trips.isLoading}
              error={trips.error}
              isEmpty={(t?.trips.length ?? 0) === 0}
              onRetry={() => trips.mutate()}
              empty={
                <div className="state">
                  <div className="ic">📈</div>
                  <h4>No trips this month</h4>
                  <p>Reports fill in as departures run.</p>
                </div>
              }
            >
              <tbody>
                {t?.trips.map((row) => (
                  <tr key={row.departureId}>
                    <td>
                      <div className="t1">{formatDate(row.date)}</div>
                      <div className="t2">{row.label ?? 'Trip'}</div>
                    </td>
                    <td>
                      <div className="t1">
                        {row.cabinsSold} / {row.cabinsTotal}
                      </div>
                      <div className="t2">{row.guests} guests</div>
                    </td>
                    <td className="num">{money(row.revenue)}</td>
                    <td className="num">{money(row.commission)}</td>
                    <td className="num">{money(row.costs)}</td>
                    <td className="num">{money(row.crew)}</td>
                    <td className={`num${isNegative(row.net) ? ' neg' : ''}`}>
                      {money(row.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </AsyncTable>
            {t && t.trips.length > 0 ? (
              <tfoot>
                <tr>
                  <td colSpan={2}>{monthLabel(t.month)} totals</td>
                  <td className="num">{money(t.totals.revenue)}</td>
                  <td className="num">{money(t.totals.commission)}</td>
                  <td className="num">{money(t.totals.costs)}</td>
                  <td className="num">{money(t.totals.crew)}</td>
                  <td className={`num${isNegative(t.totals.net) ? ' neg' : ''}`}>
                    {money(t.totals.net)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </TableWrap>
        </Card>
      ) : (
        <Card title="Month by month" sub="last 6 months" flush>
          <TableWrap minWidth={760}>
            <thead>
              <tr>
                <th>Month</th>
                <th>Trips</th>
                <th>Fill</th>
                <th className="num">Revenue</th>
                <th className="num">Costs</th>
                <th className="num">Net</th>
              </tr>
            </thead>
            <AsyncTable
              isLoading={monthly.isLoading}
              error={monthly.error}
              isEmpty={(monthly.data?.months.length ?? 0) === 0}
              onRetry={() => monthly.mutate()}
              empty={
                <div className="state">
                  <div className="ic">📊</div>
                  <h4>Nothing to summarise</h4>
                  <p>Run some trips and the monthly view fills in.</p>
                </div>
              }
            >
              <tbody>
                {monthly.data?.months.map((m) => (
                  <tr key={m.month}>
                    <td className="t1">{monthLabel(m.month)}</td>
                    <td>{m.trips}</td>
                    <td>{m.fillPct}%</td>
                    <td className="num">{money(m.revenue)}</td>
                    <td className="num">{money(m.costs)}</td>
                    <td className={`num${isNegative(m.net) ? ' neg' : ''}`}>{money(m.net)}</td>
                  </tr>
                ))}
              </tbody>
            </AsyncTable>
          </TableWrap>
        </Card>
      )}

      <Note kind="info" style={{ marginTop: 16 }}>
        Crew cost per trip counts per-trip rates only. Salaried crew are paid whether the
        boat sails or not, so they are a monthly cost rather than a cost of any one trip.
      </Note>
    </>
  );
}
