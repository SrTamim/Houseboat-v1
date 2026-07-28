import { PageHead, Card, TableWrap, Note, Select } from '@/components/admin/ui';
import { StatRow } from '@/components/admin/StatCard';
import { Pill } from '@/components/admin/Pill';

export default function Analytics() {
  return (
    <>
      <PageHead
        title="Platform analytics"
        desc="Revenue, receivables and the risk signals that feed the verification queue. Read-only — no per-boat data leaves this view without an authorization re-check."
        actions={
          <>
            <Select options={['This month', 'Last 30 days', 'This quarter', 'Year to date']} />
            <button className="btn btn-o">⤓ Export CSV</button>
          </>
        }
      />

      <StatRow
        stats={[
          { icon: '৳', label: 'GMV', value: <><span className="u">৳</span>2.41Cr</>, delta: '▲ 14% vs last month', deltaDir: 'up' },
          { icon: '%', label: 'Commission rev', value: <><span className="u">৳</span>12.1L</>, delta: '▲ 11%', deltaDir: 'up' },
          { icon: '🧾', label: 'Subscription rev', value: <><span className="u">৳</span>2.8L</>, delta: '▲ 4 boats', deltaDir: 'up' },
          { icon: '🔻', label: 'Receivables', value: <><span className="u">৳</span>41,900</>, delta: '3 debtor boats', deltaDir: 'down', alert: true },
          { icon: '💸', label: 'Payout volume', value: <><span className="u">৳</span>19.3L</>, delta: 'wk avg' },
          { icon: '🚤', label: 'Active boats', value: '28', delta: '▲ 2 approved', deltaDir: 'up' },
        ]}
      />

      <div className="grid-2">
        <Card title="Revenue by boat" sub="commission + subscription, this month" flush>
          <TableWrap>
            <thead>
              <tr><th>Boat</th><th>Route</th><th className="num">Bookings</th><th className="num">GMV</th><th className="num">Commission</th><th>Standing</th></tr>
            </thead>
            <tbody>
              <tr><td className="t1">Jol Kolol</td><td className="t2">Tanguar Haor</td><td className="num">412</td><td className="num">৳ 41,20,000</td><td className="num">৳ 2,06,000</td><td><Pill tone="ok">settled</Pill></td></tr>
              <tr><td className="t1">Haor Bilash</td><td className="t2">Nikli Haor</td><td className="num">308</td><td className="num">৳ 28,64,000</td><td className="num">৳ 1,43,200</td><td><Pill tone="warn">−৳8,200</Pill></td></tr>
              <tr><td className="t1">Meghduar</td><td className="t2">Tanguar Haor</td><td className="num">96</td><td className="num">৳ 9,84,000</td><td className="num">৳ 49,200</td><td><Pill tone="blue">new</Pill></td></tr>
              <tr><td className="t1">Bhela</td><td className="t2">Nikli Haor</td><td className="num">44</td><td className="num">৳ 3,10,000</td><td className="num">৳ 15,500</td><td><Pill tone="danger">−৳12,400</Pill></td></tr>
            </tbody>
          </TableWrap>
        </Card>
        <Card title="Risk signals" sub="feed the verify queue">
          <div className="stack" style={{ gap: 12 }}>
            <Note kind="warn" icon="⚑"><b>Meghduar</b> — first-time boat, first payout pending. Float large payments to top.</Note>
            <Note kind="warn" icon="⚑"><b>Jol Kolol</b> — coupon usage 3× median this week. Commission-gaming check advised.</Note>
            <Note kind="info" icon="ℹ">Largest single unverified payment: <b className="money">৳ 1,84,000</b> (Meghduar).</Note>
            <Note kind="danger" icon="▲"><b>Bhela</b> — negative balance exceeds platform fee → access denied.</Note>
          </div>
        </Card>
      </div>
    </>
  );
}
