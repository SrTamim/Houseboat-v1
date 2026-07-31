'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import {
  PageHead,
  Card,
  TableWrap,
  EmptyState,
  ErrorState,
  Note,
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

export default function Commission() {
  const { data, error, isLoading, mutate } = useSWR<Analytics>(
    '/platform/finance/analytics',
    fetcher,
    { revalidateOnFocus: false },
  );

  return (
    <>
      <PageHead
        title="Commission"
        desc={<>Commission is charged on the <b>original</b> room total, never the discounted amount — the boat absorbs its own coupon.</>}
      />
      {error ? (
        <ErrorState error={error} onRetry={() => mutate()} />
      ) : (
        <>
          <StatRow
            stats={[
              {
                icon: '৳',
                label: 'Commission earned',
                value: data ? (
                  <><span className="u">৳</span>{formatBDT(data.totals.commission)}</>
                ) : '…',
                delta: data ? `${data.totals.invoiceCount} invoices all-time` : undefined,
              },
              {
                icon: '💳',
                label: 'Gateway fees',
                value: data ? (
                  <><span className="u">৳</span>{formatBDT(data.totals.gatewayFees)}</>
                ) : '…',
              },
              {
                icon: '📈',
                label: 'GMV',
                value: data ? (
                  <><span className="u">৳</span>{formatBDT(data.totals.gmv)}</>
                ) : '…',
              },
              {
                icon: '🚤',
                label: 'Live boats',
                value: data ? String(data.totals.liveBoats) : '…',
              },
            ]}
          />
          <Card title="Commission by boat" sub="top boats by revenue" flush>
            {!isLoading && data && data.revenueByBoat.length === 0 ? (
              <EmptyState
                title="No invoices yet"
                desc="Commission accrues here as bookings generate invoices."
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
          <Note kind="info" icon="ℹ" style={{ marginTop: 16 }}>
            Per-invoice commission integrity checks (expected vs recorded) will
            land with the reconciliation job — the DB already stores commission
            per invoice, so any mismatch is auditable.
          </Note>
        </>
      )}
    </>
  );
}
