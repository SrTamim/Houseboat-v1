'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import {
  PageHead,
  Card,
  TableWrap,
  EmptyState,
  ErrorState,
} from '@/components/admin/ui';
import { StatRow } from '@/components/admin/StatCard';
import { formatBDT } from '@/lib/admin/money';

interface Analytics {
  totals: {
    gmv: string | number;
    commission: string | number;
    gatewayFees: string | number;
    collected: string | number;
    dueToBoats: string | number;
    invoiceCount: number;
    bookingCount: number;
    liveBoats: number;
  };
  revenueByBoat: {
    houseboatId: string;
    name: string;
    gmv: string | number;
    commission: string | number;
    invoiceCount: number;
  }[];
}

export default function Analytics() {
  const { data, error, isLoading, mutate } = useSWR<Analytics>(
    '/platform/finance/analytics',
    fetcher,
    { revalidateOnFocus: false },
  );

  const money = (v: string | number | undefined) =>
    data ? (
      <><span className="u">৳</span>{formatBDT(v ?? 0)}</>
    ) : (
      '…'
    );

  return (
    <>
      <PageHead
        title="Platform analytics"
        desc="Revenue and receivables across all boats — computed live from invoices. Read-only."
      />
      {error ? (
        <ErrorState error={error} onRetry={() => mutate()} />
      ) : (
        <>
          <StatRow
            stats={[
              { icon: '৳', label: 'GMV (all-time)', value: money(data?.totals.gmv) },
              { icon: '%', label: 'Commission', value: money(data?.totals.commission) },
              { icon: '💳', label: 'Collected', value: money(data?.totals.collected) },
              { icon: '💸', label: 'Due to boats', value: money(data?.totals.dueToBoats) },
              {
                icon: '🎟️',
                label: 'Bookings',
                value: data ? String(data.totals.bookingCount) : '…',
              },
              {
                icon: '🚤',
                label: 'Live boats',
                value: data ? String(data.totals.liveBoats) : '…',
              },
            ]}
          />
          <Card title="Revenue by boat" sub="top 10 by GMV" flush>
            {!isLoading && data && data.revenueByBoat.length === 0 ? (
              <EmptyState
                title="No revenue yet"
                desc="This table fills in as bookings generate invoices."
              />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <th>Boat</th>
                    <th className="num">Invoices</th>
                    <th className="num">GMV</th>
                    <th className="num">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.revenueByBoat ?? []).map((b) => (
                    <tr key={b.houseboatId}>
                      <td className="t1">{b.name}</td>
                      <td className="num">{b.invoiceCount}</td>
                      <td className="num">
                        <span className="u">৳</span> {formatBDT(b.gmv)}
                      </td>
                      <td className="num">
                        <span className="u">৳</span> {formatBDT(b.commission)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Card>
        </>
      )}
    </>
  );
}
