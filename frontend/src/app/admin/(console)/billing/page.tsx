'use client';

import { useState } from 'react';
import { PageHead, Card, TableWrap, Search, Select } from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';
import { SubscriptionDrawer, type Subscription } from '@/components/admin/SubscriptionDrawer';

const sub: Subscription = {
  id: 'SUB-2607-JK', boat: 'Jol Kolol', owner: 'Kamrul Owner', period: 'July 2026', status: 'issued', tone: 'warn',
  monthly: '5,000', commission: '2,06,000', due: '5,000', issued: '01 Jul 2026', paid: '—',
};

export default function Billing() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHead
        title="Subscription invoices"
        desc="The monthly bill the platform sends each boat — separate from booking commission. Billing is per boat, never combined across a multi-boat owner."
        actions={<button className="btn btn-b">+ Issue for period</button>}
      />
      <div className="filterbar">
        <Search placeholder="Boat or period…" maxWidth={300} />
        <Select options={['All statuses', 'Issued', 'Paid', 'Overdue']} />
        <Select options={['Jul', 'Jun', 'All months']} />
        <Select options={['2026', '2025']} />
      </div>
      <Card flush>
        <TableWrap>
          <thead>
            <tr><th>Period</th><th>Boat</th><th className="num">Monthly fee</th><th className="num">Commission</th><th className="num">Amount due</th><th className="num">Balance</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            <tr><td className="t1">2026-07</td><td>Jol Kolol</td><td className="num">৳ 5,000</td><td className="num">৳ 2,06,000</td><td className="num">৳ 5,000</td><td className="num">৳ 0</td><td><Pill tone="warn">issued</Pill></td><td className="rowact"><button className="btn btn-sm btn-o" onClick={() => setOpen(true)}>Preview</button><button className="btn btn-sm btn-ok">Mark paid</button></td></tr>
            <tr><td className="t1">2026-07</td><td>Haor Bilash</td><td className="num">৳ 5,000</td><td className="num">৳ 1,43,200</td><td className="num">৳ 5,000</td><td className="num">৳ 8,200</td><td><Pill tone="ok">paid</Pill></td><td className="rowact"><button className="btn btn-sm btn-o" onClick={() => setOpen(true)}>Preview</button></td></tr>
            <tr><td className="t1">2026-06</td><td>Bhela</td><td className="num">৳ 5,000</td><td className="num">৳ 15,500</td><td className="num">৳ 5,000</td><td className="num neg">−৳ 12,400</td><td><Pill tone="danger">overdue</Pill></td><td className="rowact"><button className="btn btn-sm btn-o" onClick={() => setOpen(true)}>Preview</button><button className="btn btn-sm btn-o">Chase</button></td></tr>
          </tbody>
        </TableWrap>
      </Card>
      <SubscriptionDrawer
        sub={sub}
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-o" onClick={() => setOpen(false)}>Close</button>
            <button className="btn btn-o" onClick={() => window.print()}>🖨 Print</button>
            <button className="btn btn-ok">Mark paid</button>
          </>
        }
      />
    </>
  );
}
