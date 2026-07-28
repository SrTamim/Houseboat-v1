import { PageHead, Card, TableWrap } from '@/components/admin/ui';
import { StatRow } from '@/components/admin/StatCard';
import { Pill } from '@/components/admin/Pill';

export default function Waitlist() {
  return (
    <>
      <PageHead
        title="Waitlist & availability"
        desc={<>When a cabin frees, all waitlisted customers are notified at once — first to hold wins. Watch for <code>available_count</code> drift against the real held/booked count.</>}
        actions={<button className="btn btn-o">↻ Recompute all counts</button>}
      />

      <StatRow
        stats={[
          { icon: '⏳', label: 'Waitlisted (all)', value: '37', delta: 'across 9 departures' },
          { icon: '📣', label: 'Last notify-all', value: '12', delta: 'sent 17:41 · Jol Kolol' },
          { icon: '⚠', label: 'Count drift', value: '1', delta: '1 departure off by 1', deltaDir: 'down', alert: true },
        ]}
      />

      <Card title="Departures" sub="denormalized vs recomputed availability" flush>
        <TableWrap>
          <thead>
            <tr><th>Departure</th><th className="num">Waitlist</th><th className="num">avail (stored)</th><th className="num">avail (recomputed)</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            <tr><td><div className="t1">Jol Kolol · 24 Jul</div><div className="t2">2d1n</div></td><td className="num">12</td><td className="num">0</td><td className="num">0</td><td><Pill tone="ok">in sync</Pill></td><td className="rowact"><button className="btn btn-sm btn-o">Recompute</button></td></tr>
            <tr><td><div className="t1">Haor Bilash · 25 Jul</div><div className="t2">1d</div></td><td className="num">8</td><td className="num">3</td><td className="num neg">2</td><td><Pill tone="danger">drift −1</Pill></td><td className="rowact"><button className="btn btn-sm btn-b">Reconcile</button></td></tr>
            <tr><td><div className="t1">Meghduar · 28 Jul</div><div className="t2">2d1n</div></td><td className="num">5</td><td className="num">4</td><td className="num">4</td><td><Pill tone="ok">in sync</Pill></td><td className="rowact"><button className="btn btn-sm btn-o">Recompute</button></td></tr>
          </tbody>
        </TableWrap>
      </Card>
    </>
  );
}
