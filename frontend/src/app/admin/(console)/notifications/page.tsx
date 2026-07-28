import { PageHead, Card, TableWrap, Note } from '@/components/admin/ui';
import { Pill, Tag } from '@/components/admin/Pill';

export default function Notifications() {
  return (
    <>
      <PageHead
        title="Notifications"
        desc="Platform feed and delivery monitor. Undelivered SMS/email — especially e-tickets and waitlist blasts — surface here to resend. Sending is best-effort with no automatic retry today."
      />

      <div className="filterbar">
        <div className="seg">
          <button className="seg-b on">All<span className="ct">1,204</span></button>
          <button className="seg-b">Failed<span className="ct">4</span></button>
          <button className="seg-b">SMS</button>
          <button className="seg-b">Email</button>
        </div>
      </div>

      <Note kind="warn" icon="⚑" style={{ marginBottom: 16 }}>SMS provider healthy · SMTP healthy. 4 messages failed on the customer side (invalid number / bounce).</Note>

      <Card flush>
        <TableWrap>
          <thead>
            <tr><th>Event</th><th>Recipient</th><th>Channel</th><th>Status</th><th className="num">At</th><th></th></tr>
          </thead>
          <tbody>
            <tr><td className="t1">e-ticket</td><td className="t2">+8801933220011</td><td><Tag>SMS</Tag></td><td><Pill tone="danger">failed</Pill></td><td className="num">18:40</td><td className="rowact"><button className="btn btn-sm btn-b">Resend</button></td></tr>
            <tr><td className="t1">waitlist_open</td><td className="t2">+8801822114455</td><td><Tag>SMS</Tag></td><td><Pill tone="danger">failed</Pill></td><td className="num">17:41</td><td className="rowact"><button className="btn btn-sm btn-b">Resend</button></td></tr>
            <tr><td className="t1">refund_sent</td><td className="t2">farhana@example.com</td><td><Tag>Email</Tag></td><td><Pill tone="danger">bounced</Pill></td><td className="num">16:50</td><td className="rowact"><button className="btn btn-sm btn-b">Resend</button></td></tr>
            <tr><td className="t1">payment_due</td><td className="t2">+8801711002200</td><td><Tag>SMS</Tag></td><td><Pill tone="ok">delivered</Pill></td><td className="num">15:22</td><td></td></tr>
            <tr><td className="t1">booking</td><td className="t2">tanvir@example.com</td><td><Tag>Email</Tag></td><td><Pill tone="ok">delivered</Pill></td><td className="num">15:22</td><td></td></tr>
          </tbody>
        </TableWrap>
      </Card>
    </>
  );
}
