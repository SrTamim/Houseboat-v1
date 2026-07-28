'use client';

import { useState } from 'react';
import { PageHead, Card, TableWrap, Search } from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';
import { BoatDetailDrawer } from '@/components/admin/BoatDetailDrawer';

export default function Boats() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHead
        title="Boat moderation"
        desc={<>Approve a boat only when its profile is 100% complete <b>and</b> a bank account is on file. Suspend or reinstate with a reason — it lands in the audit log.</>}
      />
      <div className="filterbar">
        <div className="seg">
          <button className="seg-b">All<span className="ct">32</span></button>
          <button className="seg-b on">Pending<span className="ct">3</span></button>
          <button className="seg-b">Draft<span className="ct">6</span></button>
          <button className="seg-b">Live<span className="ct">28</span></button>
          <button className="seg-b">Suspended<span className="ct">1</span></button>
        </div>
        <Search placeholder="Search boat or slug…" />
      </div>
      <Card flush>
        <TableWrap>
          <thead>
            <tr><th>Boat</th><th>Route</th><th>Status</th><th>Profile</th><th>Bank</th><th>Submitted</th><th></th></tr>
          </thead>
          <tbody>
            <tr><td><div className="t1">Meghduar</div><div className="t2">/meghduar</div></td><td>Tanguar Haor</td><td><Pill tone="warn">pending</Pill></td><td><b className="money">100%</b></td><td><Pill tone="ok">on file</Pill></td><td className="t2">19 Jul</td><td className="rowact"><button className="btn btn-sm btn-o" onClick={() => setOpen(true)}>View</button><button className="btn btn-sm btn-ok">Approve</button></td></tr>
            <tr><td><div className="t1">Shapla Nao</div><div className="t2">/shapla-nao</div></td><td>Nikli Haor</td><td><Pill tone="warn">pending</Pill></td><td><b className="money">100%</b></td><td><Pill tone="danger">missing</Pill></td><td className="t2">18 Jul</td><td className="rowact"><button className="btn btn-sm btn-o" onClick={() => setOpen(true)}>View</button><button className="btn btn-sm" disabled title="Bank account required">Approve</button></td></tr>
            <tr><td><div className="t1">Bonolota</div><div className="t2">/bonolota</div></td><td>Tanguar Haor</td><td><Pill tone="warn">pending</Pill></td><td><b className="money">82%</b></td><td><Pill tone="danger">missing</Pill></td><td className="t2">17 Jul</td><td className="rowact"><button className="btn btn-sm btn-o" onClick={() => setOpen(true)}>View</button><button className="btn btn-sm" disabled>Approve</button></td></tr>
            <tr><td><div className="t1">Ashroy</div><div className="t2">/ashroy · draft</div></td><td>—</td><td><Pill tone="mut">draft</Pill></td><td><b className="money">60%</b></td><td><Pill tone="danger">missing</Pill></td><td className="t2">—</td><td className="rowact"><button className="btn btn-sm btn-o" onClick={() => setOpen(true)}>View</button></td></tr>
            <tr><td><div className="t1">Jol Kolol</div><div className="t2">/jol-kolol</div></td><td>Tanguar Haor</td><td><Pill tone="ok">live</Pill></td><td><b className="money">100%</b></td><td><Pill tone="ok">on file</Pill></td><td className="t2">—</td><td className="rowact"><button className="btn btn-sm btn-o" onClick={() => setOpen(true)}>View</button><button className="btn btn-sm btn-danger">Suspend</button></td></tr>
            <tr><td><div className="t1">Bhela</div><div className="t2">/bhela · debt</div></td><td>Nikli Haor</td><td><Pill tone="danger">suspended</Pill></td><td><b className="money">100%</b></td><td><Pill tone="ok">on file</Pill></td><td className="t2">—</td><td className="rowact"><button className="btn btn-sm btn-o" onClick={() => setOpen(true)}>View</button><button className="btn btn-sm btn-ok">Reinstate</button></td></tr>
          </tbody>
        </TableWrap>
      </Card>
      <BoatDetailDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
