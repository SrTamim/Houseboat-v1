'use client';

// Live dashboard body — KPIs and the action queue, all from
// GET /platform/ops/overview. Rendered under the server-side greeting.

import Link from 'next/link';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { Card, TableWrap, ErrorState } from './ui';
import { StatRow } from './StatCard';
import { Pill } from './Pill';

interface Overview {
  pendingBoats: number;
  liveBoats: number;
  invoicesToVerify: number;
  readyForPayout: number;
  refundsInFlight: number;
  waitlisted: number;
}

export function DashboardOverview() {
  const { data, error, mutate } = useSWR<Overview>(
    '/platform/ops/overview',
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 60_000 },
  );

  if (error) return <ErrorState error={error} onRetry={() => mutate()} />;

  const n = (v: number | undefined) => (data ? String(v ?? 0) : '…');

  type Queue = {
    label: string;
    tone: 'warn' | 'blue' | 'ok' | 'danger' | 'mut';
    count: number;
    detail: string;
    href: string;
  };
  const queues: Queue[] = data
    ? (
        [
        {
          label: 'Verify',
          tone: 'warn',
          count: data.invoicesToVerify,
          detail: 'customer payments awaiting human verification',
          href: '/admin/finance/verify',
        },
        {
          label: 'Approve',
          tone: 'blue',
          count: data.pendingBoats,
          detail: 'boats pending moderation',
          href: '/admin/boats',
        },
        {
          label: 'Payout',
          tone: 'ok',
          count: data.readyForPayout,
          detail: 'verified invoices ready to batch',
          href: '/admin/finance/payouts',
        },
        {
          label: 'Refund',
          tone: 'warn',
          count: data.refundsInFlight,
          detail: 'refunds requested or awaiting completion',
          href: '/admin/finance/refunds',
        },
        {
          label: 'Waitlist',
          tone: 'mut',
          count: data.waitlisted,
          detail: 'customers waiting on full departures',
          href: '/admin/waitlist',
        },
        ] as Queue[]
      ).filter((q) => q.count > 0)
    : [];

  return (
    <>
      <StatRow
        stats={[
          { icon: '🚤', label: 'Boats pending', value: n(data?.pendingBoats), alert: Boolean(data && data.pendingBoats > 0) },
          { icon: '✓', label: 'Payments to verify', value: n(data?.invoicesToVerify), alert: Boolean(data && data.invoicesToVerify > 0) },
          { icon: '↩', label: 'Refunds in flight', value: n(data?.refundsInFlight) },
          { icon: '💸', label: 'Ready for payout', value: n(data?.readyForPayout) },
          { icon: '🟢', label: 'Live boats', value: n(data?.liveBoats) },
          { icon: '⏳', label: 'Waitlisted', value: n(data?.waitlisted) },
        ]}
      />

      <Card title="Action queue" sub="what needs a human right now" flush>
        {data && queues.length === 0 ? (
          <p className="t2" style={{ padding: 16 }}>
            All clear — no queue needs attention right now.
          </p>
        ) : (
          <TableWrap>
            <thead>
              <tr><th>What</th><th className="num">Count</th><th>Detail</th><th /></tr>
            </thead>
            <tbody>
              {queues.map((q) => (
                <tr key={q.href}>
                  <td><Pill tone={q.tone}>{q.label}</Pill></td>
                  <td className="num">{q.count}</td>
                  <td className="t2">{q.detail}</td>
                  <td className="rowact">
                    <Link className="btn btn-sm btn-o" href={q.href}>Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
