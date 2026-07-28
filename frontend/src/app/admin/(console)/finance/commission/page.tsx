import { PageHead, Card, TableWrap, Search, Select, Note } from '@/components/admin/ui';
import { StatRow } from '@/components/admin/StatCard';
import { Pill } from '@/components/admin/Pill';

export default function Commission() {
  return (
    <>
      <PageHead
        title="Commission integrity"
        desc={<>Commission must equal room_total × rate — on the <b>original</b> price, never the discounted amount. This catches coupon-gaming and computation bugs.</>}
      />
      <StatRow
        stats={[
          { icon: '৳', label: 'Commission earned', value: <><span className="u">৳</span>12.1L</>, delta: '▲ 11% vs last month', deltaDir: 'up' },
          { icon: '📅', label: 'This month', value: <><span className="u">৳</span>3,12,025</>, delta: '1,284 invoices' },
          { icon: '%', label: 'Average rate', value: <>4.9<span className="u">%</span></>, delta: 'across 28 boats' },
          { icon: '⚠', label: 'Mismatches', value: '1', delta: '৳90 short · 1 boat', deltaDir: 'down', alert: true },
        ]}
      />
      <div className="filterbar">
        <Search placeholder="Invoice id or boat…" maxWidth={300} />
        <Select options={['All checks', 'Mismatches only', 'Matches only']} />
        <Select options={['Any date', 'Last 7 days', 'Last 30 days']} />
        <Select options={['Jul', 'Jun', 'All months']} />
        <Select options={['2026', '2025']} />
      </div>
      <Card flush>
        <TableWrap>
          <thead>
            <tr><th>Invoice</th><th>Boat</th><th className="num">Room total</th><th className="num">Rate</th><th className="num">Expected</th><th className="num">Recorded</th><th>Check</th></tr>
          </thead>
          <tbody>
            <tr><td className="t1">INV-8410</td><td>Jol Kolol</td><td className="num">৳ 10,000</td><td className="num">5%</td><td className="num">৳ 500</td><td className="num">৳ 500</td><td><Pill tone="ok">match</Pill></td></tr>
            <tr><td className="t1">INV-7d55</td><td>Haor Bilash</td><td className="num">৳ 20,000</td><td className="num">5%</td><td className="num">৳ 1,000</td><td className="num">৳ 1,000</td><td><Pill tone="ok">match</Pill></td></tr>
            <tr><td className="t1">INV-80a2</td><td>Jol Kolol</td><td className="num">৳ 12,000</td><td className="num">5%</td><td className="num">৳ 600</td><td className="num neg">৳ 510</td><td><Pill tone="danger">short −৳90</Pill></td></tr>
          </tbody>
        </TableWrap>
      </Card>
      <Note kind="warn" icon="⚑" style={{ marginTop: 16 }}>
        INV-80a2 recorded commission on the discounted total, not room_total — a coupon-gaming signature. Jol Kolol flagged coupon-heavy this week.
      </Note>
    </>
  );
}
