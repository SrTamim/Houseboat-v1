'use client';

import { useState } from 'react';
import { PageHead, Card, TableWrap, Note, Search, Select } from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';
import { Drawer } from '@/components/admin/Drawer';

export default function Bookings() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHead
        title="Bookings & invoices"
        desc="Find any booking across all boats. Every open re-checks authorization (no enumeration by ID). Platform can cancel or reschedule a trip — an owner-cancel triggers the refund path."
      />
      <div className="filterbar">
        <Search placeholder="Booking id, phone, lead guest, invoice…" maxWidth={420} />
        <Select options={['All boats', 'Jol Kolol', 'Haor Bilash']} />
        <Select options={['Any status', 'customer_due', 'paid', 'payment_verified', 'in_payout', 'bill_cleared', 'cancelled', 'refund_*']} />
      </div>
      <Card flush>
        <TableWrap>
          <thead>
            <tr><th>Booking</th><th>Boat · departure</th><th>Lead guest</th><th>Invoice status</th><th className="num">Display total</th><th></th></tr>
          </thead>
          <tbody>
            <tr><td><div className="t1">#BK-8f3a</div><div className="t2">cabin · 2 rooms</div></td><td><div>Jol Kolol</div><div className="t2">24 Jul · 2d1n</div></td><td>Tanvir Hasan<div className="t2">+8801711002200</div></td><td><Pill tone="ok">payment_verified</Pill></td><td className="num">৳ 9,162</td><td className="rowact"><button className="btn btn-sm btn-o" onClick={() => setOpen(true)}>Open</button></td></tr>
            <tr><td><div className="t1">#BK-71c0</div><div className="t2">group · 18 pax</div></td><td><div>Haor Bilash</div><div className="t2">25 Jul · 1d</div></td><td>Sadia Rahman<div className="t2">+8801822114455</div></td><td><Pill tone="blue" lock>in_payout</Pill></td><td className="num">৳ 1,50,000</td><td className="rowact"><button className="btn btn-sm btn-o" onClick={() => setOpen(true)}>Open</button></td></tr>
            <tr><td><div className="t1">#BK-6a29</div><div className="t2">cabin · open seat</div></td><td><div>Jol Kolol</div><div className="t2">28 Jul · 2d1n</div></td><td>Imran Kabir<div className="t2">+8801933220011</div></td><td><Pill tone="amb">customer_due</Pill></td><td className="num">৳ 10,180</td><td className="rowact"><button className="btn btn-sm btn-o" onClick={() => setOpen(true)}>Open</button></td></tr>
            <tr><td><div className="t1">#BK-5d14</div><div className="t2">cabin</div></td><td><div>Bhela</div><div className="t2">20 Jul · 1d</div></td><td>Farhana Islam<div className="t2">+8801700889900</div></td><td><Pill tone="danger">refund_requested</Pill></td><td className="num">৳ 7,200</td><td className="rowact"><button className="btn btn-sm btn-o" onClick={() => setOpen(true)}>Open</button></td></tr>
            <tr><td><div className="t1">#BK-4b02</div><div className="t2">cabin</div></td><td><div>Haor Bilash</div><div className="t2">12 Jul · 2d1n</div></td><td>Mahin Chowdhury<div className="t2">+8801600445566</div></td><td><Pill tone="mut">bill_cleared</Pill></td><td className="num">৳ 18,340</td><td className="rowact"><button className="btn btn-sm btn-o" onClick={() => setOpen(true)}>Open</button></td></tr>
          </tbody>
        </TableWrap>
      </Card>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="#BK-8f3a · invoice"
        footer={
          <>
            <button className="btn btn-o">Reschedule</button>
            <button className="btn btn-danger">Cancel trip</button>
          </>
        }
      >
        <div className="stack" style={{ gap: 16 }}>
          <Pill tone="ok">payment_verified</Pill>
          <div>
            <h4 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)', marginBottom: 8 }}>Bill breakdown (fixed order)</h4>
            <dl className="kv">
              <dt>Room total</dt><dd className="money">৳ 10,000</dd>
              <dt>+ Gateway fee (1.8%)</dt><dd className="money">৳ 180</dd>
              <dt>= Price shown</dt><dd className="money">৳ 10,180</dd>
              <dt>− Coupon (10%)</dt><dd className="money neg">−৳ 1,018</dd>
              <dt>= Customer pays</dt><dd className="money">৳ 9,162</dd>
              <dt>Commission (5% of room)</dt><dd className="money">৳ 500</dd>
              <dt>Due to boat</dt><dd className="money">৳ 8,482</dd>
            </dl>
          </div>
          <Note kind="info" icon="ℹ">Commission is on the original room total, not the discounted amount — the boat absorbs its own coupon.</Note>
        </div>
      </Drawer>
    </>
  );
}
