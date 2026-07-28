import { PageHead, Card, TableWrap, Note } from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';

export default function Sync() {
  return (
    <>
      <PageHead
        title="Offline-sync conflicts"
        desc="Replayed intents are re-authorized against permissions as of device time. Failures land here for a human — never silently applied or dropped. A manipulated clock can reorder but never erase."
      />

      <Note kind="ok" icon="✓" style={{ marginBottom: 16 }}>Last batch: <b>7 actions synced, 1 needs review</b> — device &quot;Manager · Redmi&quot; reconnected 14:05.</Note>

      <div className="filterbar">
        <div className="seg">
          <button className="seg-b on">Needs review<span className="ct">1</span></button>
          <button className="seg-b">Clock skew<span className="ct">1</span></button>
          <button className="seg-b">Permission-lost<span className="ct">1</span></button>
          <button className="seg-b">Resolved<span className="ct">6</span></button>
        </div>
      </div>

      <Card flush>
        <TableWrap>
          <thead>
            <tr><th>Intent</th><th>Actor · boat</th><th>Conflict</th><th>Device vs server</th><th></th></tr>
          </thead>
          <tbody>
            <tr><td><div className="t1">mark_cash_paid</div><div className="t2">INV-5d14</div></td><td>Manager · Bhela</td><td><Pill tone="danger">paid vs void</Pill></td><td className="t2">09:00 → 14:05</td><td className="rowact"><button className="btn btn-sm btn-o">Reject</button><button className="btn btn-sm btn-b">Resolve</button></td></tr>
            <tr><td><div className="t1">mark_paid</div><div className="t2">INV-5d14</div></td><td>Ex-manager · Bhela</td><td><Pill tone="danger">permission lost</Pill></td><td className="t2">02:59 → 14:05</td><td className="rowact"><button className="btn btn-sm btn-danger">Discard</button></td></tr>
            <tr><td><div className="t1">cost_add</div><div className="t2">fuel ৳4,200</div></td><td>Manager · Haor Bilash</td><td><Pill tone="warn">clock skew 5h</Pill></td><td className="t2">09:12 → 14:05</td><td className="rowact"><button className="btn btn-sm btn-ok">Accept</button></td></tr>
          </tbody>
        </TableWrap>
      </Card>
    </>
  );
}
