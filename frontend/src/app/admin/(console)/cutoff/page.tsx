import { PageHead, Card, TableWrap, Note } from '@/components/admin/ui';
import { StatRow } from '@/components/admin/StatCard';
import { Pill } from '@/components/admin/Pill';

export default function Cutoff() {
  return (
    <>
      <PageHead
        title="Cutoff & finalize"
        desc="When departure time arrives, holds stop; one minute later the invoice freezes and finalizes. Watch for departures stuck past cutoff, unfilled buyouts, and stale quotes."
      />

      <StatRow
        stats={[
          { icon: '⏹', label: 'Pending finalize', value: '2', delta: 'past cutoff +1min', deltaDir: 'down', alert: true },
          { icon: '🔀', label: 'Stuck transitions', value: '0', delta: 'time passed, status ok' },
          { icon: '💬', label: 'Stale quotes', value: '2', delta: '24h / date-filled' },
        ]}
      />

      <Card title="Departures at cutoff" flush>
        <TableWrap>
          <thead>
            <tr><th>Departure</th><th>Cutoff</th><th>Open seats</th><th>State</th><th></th></tr>
          </thead>
          <tbody>
            <tr><td><div className="t1">Jol Kolol · 21 Jul</div><div className="t2">2d1n</div></td><td className="t2">18:00</td><td className="t2">1 unfilled buyout</td><td><Pill tone="warn">awaiting finalize</Pill></td><td className="rowact"><button className="btn btn-sm btn-b">Finalize now</button></td></tr>
            <tr><td><div className="t1">Haor Bilash · 21 Jul</div><div className="t2">1d</div></td><td className="t2">17:30</td><td className="t2">0</td><td><Pill tone="warn">awaiting finalize</Pill></td><td className="rowact"><button className="btn btn-sm btn-b">Finalize now</button></td></tr>
            <tr><td><div className="t1">Meghduar · 20 Jul</div><div className="t2">2d1n</div></td><td className="t2">18:00</td><td className="t2">—</td><td><Pill tone="ok">finalized</Pill></td><td></td></tr>
          </tbody>
        </TableWrap>
      </Card>

      <Note kind="info" icon="ℹ" style={{ marginTop: 16 }}>
        Unfilled buyout stands — nothing is refunded because the full amount was never charged. Whatever the invoice reads at finalize is final.
      </Note>
    </>
  );
}
