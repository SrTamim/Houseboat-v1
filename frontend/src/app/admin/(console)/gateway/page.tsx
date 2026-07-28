import { PageHead, Card, TableWrap } from '@/components/admin/ui';
import { StatRow } from '@/components/admin/StatCard';
import { Pill } from '@/components/admin/Pill';

export default function Gateway() {
  return (
    <>
      <PageHead
        title="Payment gateway"
        desc="SSLCommerz. IPN is authoritative — the raw callback is never trusted, only re-validation by val_id. Replays are idempotent no-ops via the unique gateway token."
      />

      <StatRow
        stats={[
          { icon: '🧪', label: 'Mode', value: <Pill tone="amb">SANDBOX</Pill>, delta: 'switch in Settings' },
          { icon: '📨', label: 'IPNs today', value: '312', delta: '308 confirmed', deltaDir: 'up' },
          { icon: '⚠', label: 'Failed / unmatched', value: '4', delta: 'dropped, not recorded', deltaDir: 'down', alert: true },
          { icon: '🔁', label: 'Replay no-ops', value: '17', delta: 'idempotent' },
        ]}
      />

      <Card title="Recent IPN events" sub="+5-min hold window covers the gateway round-trip" flush>
        <TableWrap>
          <thead>
            <tr><th>val_id</th><th>Invoice</th><th className="num">Amount</th><th>Result</th><th className="num">At</th></tr>
          </thead>
          <tbody>
            <tr><td className="t2">2507211841…</td><td>INV-9a11</td><td className="num">৳ 1,84,000</td><td><Pill tone="ok">confirmed</Pill></td><td className="num">18:41</td></tr>
            <tr><td className="t2">2507211820…</td><td>INV-88f2</td><td className="num">৳ 96,500</td><td><Pill tone="mut">replay no-op</Pill></td><td className="num">18:20</td></tr>
            <tr><td className="t2">2507211802…</td><td>—</td><td className="num">৳ 12,700</td><td><Pill tone="danger">validation failed</Pill></td><td className="num">18:02</td></tr>
            <tr><td className="t2">2507211750…</td><td>—</td><td className="num">—</td><td><Pill tone="danger">unmatched</Pill></td><td className="num">17:50</td></tr>
          </tbody>
        </TableWrap>
      </Card>
    </>
  );
}
