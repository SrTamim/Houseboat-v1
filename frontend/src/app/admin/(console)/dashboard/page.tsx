import { PageHead, Card, TableWrap, Note } from '@/components/admin/ui';
import { StatRow } from '@/components/admin/StatCard';
import { Pill } from '@/components/admin/Pill';
import Link from 'next/link';

export default function Dashboard() {
  return (
    <>
      <PageHead
        title="Good evening, Rafiq"
        desc="What needs a human right now across all boats."
        actions={
          <>
            <Link className="btn btn-o" href="/admin/analytics">📈 Analytics</Link>
            <Link className="btn btn-b" href="/admin/finance/verify">Verification queue →</Link>
          </>
        }
      />

      <StatRow
        stats={[
          { icon: '🚤', label: 'Boats pending', value: '3', delta: '1 ready to approve' },
          { icon: '✓', label: 'Payments to verify', value: '5', delta: '2 large · risk-sorted', deltaDir: 'down', alert: true },
          { icon: '↩', label: 'Refunds in flight', value: '2', delta: '1 near 6-day deadline' },
          { icon: '💸', label: 'Payout this week', value: <><span className="u">৳</span>4,82,140</>, delta: '6 boats · 1 negative batch', deltaDir: 'up' },
          { icon: '🩺', label: 'Failed jobs', value: '1', delta: 'hold-sweeper last run errored', deltaDir: 'down', alert: true },
          { icon: '🔔', label: 'Undelivered', value: '4', delta: '3 SMS · 1 e-ticket', deltaDir: 'down' },
        ]}
      />

      <div className="grid-2">
        <div className="stack">
          <Card title="Action queue" sub="most urgent first" flush>
            <TableWrap>
              <thead>
                <tr><th>What</th><th>Boat</th><th>Detail</th><th></th></tr>
              </thead>
              <tbody>
                <tr><td><Pill tone="danger">Job failed</Pill></td><td className="t1">—</td><td>Hold sweeper errored 01:58, holds may be stuck</td><td className="rowact"><Link className="btn btn-sm btn-o" href="/admin/jobs">Open</Link></td></tr>
                <tr><td><Pill tone="warn">Verify</Pill></td><td className="t1">Meghduar</td><td>৳1,84,000 gateway payment · first-time boat</td><td className="rowact"><Link className="btn btn-sm btn-b" href="/admin/finance/verify">Review</Link></td></tr>
                <tr><td><Pill tone="blue">Approve</Pill></td><td className="t1">Meghduar</td><td>Profile 100% · bank account present</td><td className="rowact"><Link className="btn btn-sm btn-o" href="/admin/boats">Open</Link></td></tr>
                <tr><td><Pill tone="warn">Refund</Pill></td><td className="t1">Haor Bilash</td><td>Owner-cancelled · 1 day left to claim</td><td className="rowact"><Link className="btn btn-sm btn-o" href="/admin/finance/refunds">Open</Link></td></tr>
                <tr><td><Pill tone="danger">Debtor</Pill></td><td className="t1">Bhela</td><td>Balance −৳12,400 · access denied</td><td className="rowact"><Link className="btn btn-sm btn-o" href="/admin/debtors">Open</Link></td></tr>
              </tbody>
            </TableWrap>
          </Card>
        </div>
        <div className="stack">
          <Card title="This week">
            <dl className="kv">
              <dt>Bookings</dt><dd>1,284</dd>
              <dt>GMV</dt><dd className="money">৳ 62,40,500</dd>
              <dt>Commission</dt><dd className="money">৳ 3,12,025</dd>
              <dt>Live boats</dt><dd>28</dd>
              <dt>Departures today</dt><dd>17</dd>
            </dl>
          </Card>
          <Card title="System health" head={<Link className="sub" href="/admin/jobs" style={{ color: 'var(--blue)' }}>Details →</Link>}>
            <div className="stack" style={{ gap: 12 }}>
              <Note kind="danger" icon="✕">Hold sweeper — last run errored 01:58 UTC</Note>
              <Note kind="ok" icon="✓">Departure status — ran 12:55, 4 advanced</Note>
              <Note kind="info" icon="ℹ">Gateway: <b>SANDBOX</b> · SMS provider live · SMTP live</Note>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
