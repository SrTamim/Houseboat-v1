import { PageHead, Card, TableWrap } from '@/components/admin/ui';
import { StatRow } from '@/components/admin/StatCard';
import { Pill } from '@/components/admin/Pill';

export default function Security() {
  return (
    <>
      <PageHead
        title="Security posture"
        desc="Every object fetch re-checks authorization — the role map alone is not enough. IDs are non-enumerable UUIDv7. Denied attempts and separation-of-duties violations land here."
      />

      <StatRow
        stats={[
          { icon: '🛡', label: 'Auth denials (24h)', value: '23', delta: 'cross-boat access blocked' },
          { icon: '⚖', label: 'SoD violations', value: '2', delta: 'same-person money chain', deltaDir: 'down', alert: true },
          { icon: '🚦', label: 'Rate-limit hits', value: '140', delta: 'hold spikes absorbed' },
        ]}
      />

      <Card title="Blocked attempts" flush>
        <TableWrap>
          <thead>
            <tr><th>Actor</th><th>Attempt</th><th>Reason</th><th className="num">At</th></tr>
          </thead>
          <tbody>
            <tr><td className="t1">Manager (Haor Bilash)</td><td className="t2">GET invoice · Jol Kolol</td><td><Pill tone="danger">IDOR · cross-boat</Pill></td><td className="num">14:31</td></tr>
            <tr><td className="t1">Nusrat J.</td><td className="t2">approve own prepared batch</td><td><Pill tone="danger">SoD · preparer=approver</Pill></td><td className="num">12:08</td></tr>
            <tr><td className="t1">Ex-manager (Bhela)</td><td className="t2">mark_paid (replay)</td><td><Pill tone="danger">permission lost</Pill></td><td className="num">14:05</td></tr>
            <tr><td className="t1">anon</td><td className="t2">42 hold attempts / cabin</td><td><Pill tone="warn">rate-limited</Pill></td><td className="num">11:50</td></tr>
          </tbody>
        </TableWrap>
      </Card>
    </>
  );
}
