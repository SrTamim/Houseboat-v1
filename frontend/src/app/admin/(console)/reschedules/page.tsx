import { PageHead, Card, TableWrap, Note } from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';

export default function Reschedules() {
  return (
    <>
      <PageHead
        title="Reschedule oversight"
        desc="Rescheduling reprices at the new date; the advance carries over as credit and the previous trip stays on record. Moving to an Eid date costs Eid prices."
      />

      <Card flush>
        <TableWrap>
          <thead>
            <tr><th>Booking</th><th>From → to</th><th className="num">Old price</th><th className="num">New price</th><th>Change</th><th>By</th></tr>
          </thead>
          <tbody>
            <tr><td className="t1">#BK-4b02</td><td className="t2">12 Jul → 19 Jul</td><td className="num">৳ 18,340</td><td className="num">৳ 18,340</td><td><Pill tone="mut">no change</Pill></td><td className="t2">Owner</td></tr>
            <tr><td className="t1">#BK-3a90</td><td className="t2">14 Jul → 17 Jul (Eid)</td><td className="num">৳ 10,180</td><td className="num">৳ 15,200</td><td><Pill tone="warn">repriced up</Pill></td><td className="t2">Owner</td></tr>
            <tr><td className="t1">#BK-2f70</td><td className="t2">10 Jul → 24 Jul</td><td className="num">৳ 22,000</td><td className="num">৳ 20,600</td><td><Pill tone="ok">repriced down</Pill></td><td className="t2">Platform</td></tr>
          </tbody>
        </TableWrap>
      </Card>

      <Note kind="warn" icon="⚑" style={{ marginTop: 16 }}>
        #BK-3a90 repriced up for Eid — the advance is credit, not a locked price. Difference is due at checkout.
      </Note>
    </>
  );
}
