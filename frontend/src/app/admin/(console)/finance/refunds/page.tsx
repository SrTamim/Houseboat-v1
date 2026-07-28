'use client';

import { useState } from 'react';
import { PageHead } from '@/components/admin/ui';
import { InvoiceFilters, InvoiceTable } from '@/components/admin/InvoiceTable';
import { InvoiceDrawer } from '@/components/admin/InvoiceDrawer';
import { makeInvoice, type InvoiceRow } from '@/lib/admin/mock';

const rows: InvoiceRow[] = [
  { inv: 'INV-5d14', bk: 'BK-5d10', status: 'Refund Requested', boat: 'Haor Bilash', date: '12 Jul 2026', trip: 'Canceled', method: 'Online', amount: '7,200', token: 'sslcz_3e…7711', primary: true },
  { inv: 'INV-5c98', bk: 'BK-5c90', status: 'Refund Requested', boat: 'Bhela', date: '11 Jul 2026', trip: 'Canceled', method: 'Online', amount: '5,400', token: 'sslcz_9a…22b0', primary: true },
  { inv: 'INV-5a70', bk: 'BK-5a70', status: 'Refund Verified', boat: 'Jol Kolol', date: '09 Jul 2026', trip: 'Canceled', method: 'Online', amount: '11,000', token: 'sslcz_4d…8c31' },
  { inv: 'INV-5920', bk: 'BK-5920', status: 'Refunded', boat: 'Meghduar', date: '06 Jul 2026', trip: 'Canceled', method: 'Online', amount: '3,000', token: 'sslcz_7b…04ff' },
  { inv: 'INV-58f0', bk: 'BK-58f0', status: 'Canceled by Boat', boat: 'Bhela', date: '05 Jul 2026', trip: 'Canceled', method: 'Cash', amount: '4,200', token: '— (cash)' },
];

const invoice = makeInvoice({
  inv: 'INV-5d14', bk: 'BK-5d10', status: 'Refund Requested', boat: 'Haor Bilash', trip: 'Canceled', date: '12 Jul 2026',
  customer: { name: 'Farhana Islam', phone: '+8801700889900', email: 'farhana@example.com', lead: 'Farhana Islam' },
  booking: { route: 'Nikli Haor · Kishoreganj', dates: '20 Jul 2026', duration: '1 day', notes: 'Owner cancelled — weather warning.' },
  money: { room: '7,073', gatewayFee: '127', shown: '7,200', coupon: '', discount: '0', total: '7,200', advance: '7,200', due: '0', paid: '7,200', commission: '354', dueToBoat: '6,719' },
  meta: { policy: 'Moderate · blackout Eid → 0%' },
});

export default function Refunds() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHead
        title="Refunds"
        desc={<>Invoices with <b>Refund Requested</b>. Reachable when the owner cancelled a trip, within 6 days. Three-person separation of duties: request → verify → complete must be different people.</>}
      />
      <InvoiceFilters statusOptions={['Refund Requested', 'Refund Verified', 'Refunded']} />
      <InvoiceTable rows={rows} actionLabel="Verify" onAction={() => setOpen(true)} />
      <InvoiceDrawer
        inv={invoice}
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-o" onClick={() => setOpen(false)}>Close</button>
            <button className="btn btn-ok">Mark verified</button>
          </>
        }
      />
    </>
  );
}
