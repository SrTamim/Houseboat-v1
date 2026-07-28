import { PageHead, Card, TableWrap, Search, Select } from '@/components/admin/ui';
import { StatRow } from '@/components/admin/StatCard';
import { Pill } from '@/components/admin/Pill';

export default function Credits() {
  return (
    <>
      <PageHead
        title="Customer-credit ledger"
        desc="Platform liability — money owed to customers as credit toward future bookings. Fed by overpayments and reschedule advances."
      />
      <StatRow
        stats={[
          { icon: '🎫', label: 'Open credit', value: <><span className="u">৳</span>34,500</>, delta: 'outstanding liability' },
          { icon: '✅', label: 'Used this month', value: <><span className="u">৳</span>18,000</>, delta: '6 bookings' },
          { icon: '⏳', label: 'Aging > 90d', value: <><span className="u">৳</span>4,000</>, delta: '2 credits' },
        ]}
      />
      <div className="filterbar">
        <div className="seg">
          <button className="seg-b on">All<span className="ct">4</span></button>
          <button className="seg-b">Credited<span className="ct">2</span></button>
          <button className="seg-b">Withdraw requested<span className="ct">1</span></button>
          <button className="seg-b">Withdrawn<span className="ct">1</span></button>
        </div>
        <Search placeholder="Customer, invoice id…" maxWidth={300} />
        <Select options={['Jul', 'Jun', 'All months']} />
        <Select options={['2026', '2025']} />
      </div>
      <Card flush>
        <TableWrap minWidth={820}>
          <thead>
            <tr><th>Customer</th><th className="num">Amount</th><th>Source</th><th>Used in</th><th>Status</th><th className="num">Age</th><th></th></tr>
          </thead>
          <tbody>
            <tr><td className="t1">Imran Kabir</td><td className="num">৳ 5,000</td><td className="t2">INV-6a29 · overpay</td><td className="t2">—</td><td><Pill tone="blue">Credited</Pill></td><td className="num">3d</td><td className="rowact"><button className="btn btn-sm btn-o">View</button></td></tr>
            <tr><td className="t1">Sultana Begum</td><td className="num">৳ 2,000</td><td className="t2">INV-6110 · reschedule</td><td className="t2">—</td><td><Pill tone="warn">Withdraw Requested</Pill></td><td className="num">9d</td><td className="rowact"><button className="btn btn-sm btn-b">Process</button></td></tr>
            <tr><td className="t1">Nadia Haque</td><td className="num">৳ 3,000</td><td className="t2">INV-5m20 · overpay</td><td className="t2">INV-7c02</td><td><Pill tone="ok">Withdrawn</Pill></td><td className="num">—</td><td className="rowact"><button className="btn btn-sm btn-o">Receipt</button></td></tr>
            <tr><td className="t1">Rezaul Karim</td><td className="num">৳ 2,000</td><td className="t2">INV-4b90 · overpay</td><td className="t2">—</td><td><Pill tone="blue">Credited</Pill></td><td className="num">104d</td><td className="rowact"><button className="btn btn-sm btn-o">View</button></td></tr>
          </tbody>
        </TableWrap>
      </Card>
    </>
  );
}
