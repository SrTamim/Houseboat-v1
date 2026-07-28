'use client';

import { useState } from 'react';
import { PageHead, Card, TableWrap, Search, Select } from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';
import { InvoiceDrawer } from '@/components/admin/InvoiceDrawer';
import { InvoiceEditDrawer } from '@/components/admin/InvoiceEditDrawer';
import { makeInvoice } from '@/lib/admin/mock';

const viewInvoice = makeInvoice({
  inv: 'INV-5d14', bk: 'BK-5d10', status: 'Canceled by Boat', boat: 'Bhela', trip: 'Canceled', date: '12 Jul 2026',
  customer: { name: 'Farhana Islam', phone: '+8801700889900', email: 'farhana@example.com', lead: 'Farhana Islam' },
  booking: { route: 'Nikli Haor · Kishoreganj', dates: '20 Jul 2026', duration: '1 day', notes: 'Owner cancelled — weather. Customer reported full charge.' },
  money: { room: '7,073', gatewayFee: '127', shown: '7,200', coupon: '', discount: '0', total: '7,200', advance: '7,200', due: '0', paid: '7,200', commission: '354', dueToBoat: '6,719' },
  meta: { policy: 'Moderate · blackout Eid → 0%' },
});

const editInvoice = makeInvoice({
  inv: 'INV-5d14', bk: 'BK-5d10', status: 'Canceled by Boat', boat: 'Bhela', trip: 'Canceled', method: 'Online',
  customer: { name: 'Farhana Islam', phone: '+8801700889900', email: 'farhana@example.com', lead: 'Farhana Islam' },
  booking: { route: 'Nikli Haor · Kishoreganj', dates: '20 Jul 2026', headcount: '2 adults', reference: '—' },
  money: { room: '7,073', gatewayFee: '127', discount: '0', total: '7,200', advance: '7,200', due: '0', paid: '7,200', overpaid: '0', commission: '354', dueToBoat: '6,719' },
});

export default function Disputes() {
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  return (
    <>
      <PageHead
        title="Reported invoices"
        desc={<>Invoices flagged by a customer or a boat owner, with their note. <b>View</b> opens the full invoice; <b>Edit</b> lets you correct any invoice field to resolve the dispute — every edit is logged.</>}
      />
      <div className="filterbar">
        <div className="seg">
          <button className="seg-b on">Open<span className="ct">3</span></button>
          <button className="seg-b">Resolved<span className="ct">11</span></button>
        </div>
        <Search placeholder="Invoice, booking, boat…" maxWidth={300} />
        <Select options={['Any reporter', 'Customer', 'Boat owner']} />
      </div>
      <Card flush>
        <TableWrap minWidth={960}>
          <thead>
            <tr><th>Invoice ID</th><th>Booking ID</th><th>Reported by</th><th>Boat</th><th>Reason note</th><th>Date</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            <tr><td className="t1">INV-5d14</td><td className="t2">BK-5d10</td><td><Pill tone="amb">Customer</Pill></td><td>Bhela</td><td className="t2">&quot;Charged full price but trip was cancelled by the boat.&quot;</td><td className="t2">12 Jul</td><td><Pill tone="warn">open</Pill></td><td className="rowact"><button className="btn btn-sm btn-o" onClick={() => setViewOpen(true)}>View</button><button className="btn btn-sm btn-b" onClick={() => setEditOpen(true)}>Edit</button></td></tr>
            <tr><td className="t1">INV-4b02</td><td className="t2">BK-4b02</td><td><Pill tone="blue">Boat owner</Pill></td><td>Haor Bilash</td><td className="t2">&quot;Reschedule repriced wrong — customer moved to a cheaper date.&quot;</td><td className="t2">11 Jul</td><td><Pill tone="warn">open</Pill></td><td className="rowact"><button className="btn btn-sm btn-o" onClick={() => setViewOpen(true)}>View</button><button className="btn btn-sm btn-b" onClick={() => setEditOpen(true)}>Edit</button></td></tr>
            <tr><td className="t1">INV-6a29</td><td className="t2">BK-6a29</td><td><Pill tone="amb">Customer</Pill></td><td>Jol Kolol</td><td className="t2">&quot;Paid extra for an open seat that was later filled — want the surplus back.&quot;</td><td className="t2">19 Jul</td><td><Pill tone="warn">open</Pill></td><td className="rowact"><button className="btn btn-sm btn-o" onClick={() => setViewOpen(true)}>View</button><button className="btn btn-sm btn-b" onClick={() => setEditOpen(true)}>Edit</button></td></tr>
            <tr><td className="t1">INV-3f80</td><td className="t2">BK-3f80</td><td><Pill tone="blue">Boat owner</Pill></td><td>Meghduar</td><td className="t2">&quot;Commission looks too high on this invoice.&quot;</td><td className="t2">04 Jul</td><td><Pill tone="ok">resolved</Pill></td><td className="rowact"><button className="btn btn-sm btn-o" onClick={() => setViewOpen(true)}>View</button></td></tr>
          </tbody>
        </TableWrap>
      </Card>

      <InvoiceDrawer
        inv={viewInvoice}
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        footer={
          <>
            <button className="btn btn-o" onClick={() => setViewOpen(false)}>Close</button>
            <button className="btn btn-b" onClick={() => { setViewOpen(false); setEditOpen(true); }}>Edit invoice</button>
          </>
        }
      />
      <InvoiceEditDrawer
        inv={editInvoice}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <button className="btn btn-o" onClick={() => setEditOpen(false)}>Cancel</button>
            <button className="btn btn-danger">Mark resolved</button>
            <button className="btn btn-b">Save changes</button>
          </>
        }
      />
    </>
  );
}
