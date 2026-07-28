'use client';

import { useState } from 'react';
import { PageHead, Note } from '@/components/admin/ui';
import { InvoiceFilters, InvoiceTable } from '@/components/admin/InvoiceTable';
import { InvoiceDrawer } from '@/components/admin/InvoiceDrawer';
import { makeInvoice, type InvoiceRow } from '@/lib/admin/mock';

const rows: InvoiceRow[] = [
  { inv: 'INV-6a29', bk: 'BK-6a29', status: 'Over Paid', boat: 'Jol Kolol', date: '19 Jul 2026', trip: 'Completed', method: 'Online', amount: '5,000', token: 'sslcz_5f…9021', primary: true },
  { inv: 'INV-6110', bk: 'BK-6110', status: 'Over Paid', boat: 'Haor Bilash', date: '15 Jul 2026', trip: 'Completed', method: 'Online', amount: '2,000', token: 'sslcz_2c…7788', primary: true },
  { inv: 'INV-5m20', bk: 'BK-5m20', status: 'Over Paid', boat: 'Meghduar', date: '08 Jul 2026', trip: 'Completed', method: 'Cash', amount: '3,000', token: '— (cash)', primary: true },
];

const invoice = makeInvoice({
  inv: 'INV-6a29', bk: 'BK-6a29', status: 'Over Paid', date: '19 Jul 2026',
  customer: { name: 'Imran Kabir', phone: '+8801933220011', email: 'imran@example.com', lead: 'Imran Kabir' },
  booking: { type: 'Cabin booking · open seat', headcount: '1 adult (capacity 3)', notes: 'Open seat later filled by another party — invoice reduced.' },
  money: { room: '15,000', gatewayFee: '270', shown: '15,270', coupon: '', discount: '0', total: '10,270', advance: '5,000', due: '0', paid: '15,270', overpaid: '5,000', commission: '500', dueToBoat: '9,770' },
});

export default function Overpayments() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHead
        title="Overpayments"
        desc={<>Invoices with <b>Over Paid</b> — an open-seat buyout filled after payment, or a reschedule surplus. A human decides: convert to customer credit, or refund.</>}
      />
      <InvoiceFilters statusOptions={['Over Paid']} />
      <InvoiceTable rows={rows} actionLabel="Verify" onAction={() => setOpen(true)} />
      <Note kind="info" icon="ℹ" style={{ marginTop: 16 }}>
        An open-seat invoice only ever moves down. The surplus lands here first — it never becomes a negative payable to the boat.
      </Note>
      <InvoiceDrawer
        inv={invoice}
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-o" onClick={() => setOpen(false)}>Close</button>
            <button className="btn btn-o">Refund surplus</button>
            <button className="btn btn-b">Convert to credit</button>
          </>
        }
      />
    </>
  );
}
