'use client';

import { useState } from 'react';
import { PageHead, Card, TableWrap, Note, Search } from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';
import { Drawer } from '@/components/admin/Drawer';

export default function Accounts() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHead
        title="Account support"
        desc="One login per person. A single account can be a customer, an owner and crew at once — identity derives from relations, not a type field."
      />
      <div className="filterbar">
        <Search placeholder="Search phone, name or email…" defaultValue="+88017110" maxWidth={420} />
      </div>
      <div className="grid-2">
        <Card flush>
          <TableWrap>
            <thead>
              <tr><th>Account</th><th>Phone</th><th>Verified</th><th>Roles</th><th></th></tr>
            </thead>
            <tbody>
              <tr><td className="t1">Tanvir Hasan</td><td className="t2">+8801711002200</td><td><Pill tone="ok">verified</Pill></td><td className="t2">customer</td><td className="rowact"><button className="btn btn-sm btn-o" onClick={() => setOpen(true)}>Open</button><button className="btn btn-sm btn-danger">Remove</button></td></tr>
              <tr><td className="t1">Kamrul Owner</td><td className="t2">+8801711554433</td><td><Pill tone="ok">verified</Pill></td><td className="t2">owner ×2 · crew ×1</td><td className="rowact"><button className="btn btn-sm btn-o" onClick={() => setOpen(true)}>Open</button><button className="btn btn-sm btn-danger">Remove</button></td></tr>
              <tr><td className="t1">Rina Akter</td><td className="t2">+8801711778899</td><td><Pill tone="warn">pending</Pill></td><td className="t2">customer</td><td className="rowact"><button className="btn btn-sm btn-o" onClick={() => setOpen(true)}>Open</button><button className="btn btn-sm btn-danger">Remove</button></td></tr>
              <tr><td className="t1">Sohel Rana</td><td className="t2">+8801711334455</td><td><Pill tone="danger">access revoked</Pill></td><td className="t2">— (was manager)</td><td className="rowact"><button className="btn btn-sm btn-o" onClick={() => setOpen(true)}>Open</button><button className="btn btn-sm btn-ok">Restore</button></td></tr>
            </tbody>
          </TableWrap>
        </Card>
        <Card head={<><h3>Kamrul Owner</h3><Pill tone="ok">verified</Pill></>}>
          <div className="stack" style={{ gap: 14 }}>
            <dl className="kv"><dt>Phone</dt><dd>+8801711554433</dd><dt>Email</dt><dd>kamrul@example.com</dd><dt>Joined</dt><dd>Mar 2026</dd></dl>
            <div>
              <h4 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)', marginBottom: 8 }}>Boat access</h4>
              <table className="tbl" style={{ minWidth: 0 }}><tbody>
                <tr><td className="t1">Jol Kolol</td><td><Pill tone="blue">Owner</Pill></td></tr>
                <tr><td className="t1">Haor Bilash</td><td><Pill tone="mut">Manager (restricted)</Pill></td></tr>
                <tr><td className="t1">Meghduar</td><td><Pill tone="amb">Crew · sukani</Pill></td></tr>
              </tbody></table>
            </div>
            <div className="acts" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><button className="btn btn-o">Resend verification</button><button className="btn btn-o">Force-verify phone</button><button className="btn btn-danger">Remove access</button></div>
            <Note kind="warn" icon="⚑">Removing access revokes every boat role and blocks sign-in. The account and its booking history are kept for audit.</Note>
          </div>
        </Card>
      </div>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Account"
        footer={<button className="btn btn-o" onClick={() => setOpen(false)}>Close</button>}
      >
        <p className="muted">Full account detail — cross-boat roles, verification, booking history.</p>
      </Drawer>
    </>
  );
}
