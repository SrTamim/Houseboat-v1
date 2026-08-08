'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import {
  PageHead,
  Card,
  Kpi,
  Kpis,
  FilterBar,
  Select,
  Note,
  AsyncBlock,
} from '@/components/owner/ui';
import { moneyShort, isNegative } from '@/lib/owner/format';
import { TrendChart, ProfitBars, CostDonut } from '@/components/owner/charts';

interface Financials {
  period: string;
  month: number;
  year: number | null;
  kpis: {
    revenue: string;
    commission: string;
    operatingCosts: string;
    crewPayroll: string;
    totalCost: string;
    profit: string;
    trips: number;
    guests: number;
    costPerTrip: string;
    revenuePerTrip: string;
    fillPct: number;
    marginPct: number;
  };
  costBreakdown: { key: string; label: string; amount: string }[];
  trend: {
    month: string;
    revenue: string;
    totalCost: string;
    profit: string;
    trips: number;
  }[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_OPTIONS = MONTH_NAMES.map((label, i) => ({
  value: String(i + 1),
  label,
}));

/** Current year back to 2022, plus an "All years" seasonality option. */
function yearOptions(): { value: string; label: string }[] {
  const now = new Date().getUTCFullYear();
  const years = Array.from({ length: now - 2022 + 1 }, (_, i) => {
    const y = now - i;
    return { value: String(y), label: String(y) };
  });
  return [...years, { value: 'all', label: 'All years' }];
}

const YEAR_OPTIONS = yearOptions();

export default function OwnerReportsPage() {
  const { boatId } = useActiveBoat();
  const now = new Date();
  const [month, setMonth] = useState(String(now.getUTCMonth() + 1));
  const [year, setYear] = useState(String(now.getUTCFullYear()));

  const qs = useMemo(() => {
    const p = new URLSearchParams({ month });
    if (year !== 'all') p.set('year', year);
    return p.toString();
  }, [month, year]);

  const { data, error, isLoading, mutate } = useSWR<Financials>(
    `/houseboats/${boatId}/reports/financials?${qs}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const k = data?.kpis;
  const loss = Boolean(k && isNegative(k.profit));

  return (
    <>
      <PageHead
        title="Reports"
        desc="Revenue, cost and profit for the boat. Pick a month and year — or a month across all years to compare seasons."
        actions={
          <FilterBar>
            <Select
              options={MONTH_OPTIONS}
              value={month}
              onChange={setMonth}
              ariaLabel="Report month"
            />
            <Select
              options={YEAR_OPTIONS}
              value={year}
              onChange={setYear}
              ariaLabel="Report year"
            />
          </FilterBar>
        }
      />

      <Kpis>
        <Kpi
          icon="📈"
          label="Revenue"
          value={k ? moneyShort(k.revenue) : '—'}
          detail={k ? `${k.trips} trips · ${k.guests} guests` : undefined}
        />
        <Kpi
          icon="🧾"
          label="Total cost"
          value={k ? moneyShort(k.totalCost) : '—'}
          detail="Costs + crew payroll"
        />
        <Kpi
          icon="💰"
          label={loss ? 'Loss' : 'Profit'}
          value={k ? moneyShort(k.profit) : '—'}
          detail={`Margin ${k ? k.marginPct : 0}%`}
          alert={loss}
        />
        <Kpi
          icon="৳"
          label="Cost per trip"
          value={k ? moneyShort(k.costPerTrip) : '—'}
          detail="Total cost ÷ trips"
        />
        <Kpi
          icon="🎟️"
          label="Revenue per trip"
          value={k ? moneyShort(k.revenuePerTrip) : '—'}
          detail="Room revenue only"
        />
        <Kpi
          icon="🚪"
          label="Average fill"
          value={k ? `${k.fillPct}%` : '—'}
          detail="Cabins sold vs capacity"
        />
        <Kpi
          icon="👷"
          label="Crew payroll"
          value={k ? moneyShort(k.crewPayroll) : '—'}
          detail="Salaried crew this period"
        />
        <Kpi
          icon="🏷️"
          label="Commission"
          value={k ? moneyShort(k.commission) : '—'}
          detail="Platform share"
        />
      </Kpis>

      <div className="rp-grid">
        <Card title="Revenue · cost · profit" sub="last 12 months">
          <AsyncBlock
            isLoading={isLoading}
            error={error}
            isEmpty={!data?.trend.length}
            onRetry={() => mutate()}
          >
            {data ? <TrendChart data={data.trend} /> : null}
          </AsyncBlock>
        </Card>

        <Card title="Cost breakdown" sub={data?.period}>
          <AsyncBlock
            isLoading={isLoading}
            error={error}
            isEmpty={!data}
            onRetry={() => mutate()}
          >
            {data ? <CostDonut data={data.costBreakdown} /> : null}
          </AsyncBlock>
        </Card>

        <Card title="Profit / loss" sub="last 12 months" style={{ gridColumn: '1 / -1' }}>
          <AsyncBlock
            isLoading={isLoading}
            error={error}
            isEmpty={!data?.trend.length}
            onRetry={() => mutate()}
          >
            {data ? <ProfitBars data={data.trend} /> : null}
          </AsyncBlock>
        </Card>
      </div>

      <Note kind="info" style={{ marginTop: 16 }}>
        <strong>Total cost</strong> is every cost you logged in the period plus salaried crew
        payroll; <strong>Profit</strong> is revenue minus commission minus that total. Choose a
        month with <strong>All years</strong> to sum that month across every year on record and
        spot seasonal patterns.
      </Note>
    </>
  );
}
