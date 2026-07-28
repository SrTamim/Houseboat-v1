import { PageHead, Card, TableWrap, Note } from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';
import Link from 'next/link';

export default function Jobs() {
  return (
    <>
      <PageHead
        title="Jobs & system health"
        desc="Three cron jobs keep money and inventory correct. They run on UTC; times shown in BST. Re-runs are idempotent — safe to trigger manually."
        actions={<button className="btn btn-o">↻ Refresh</button>}
      />

      <Card title="Scheduled jobs" flush>
        <TableWrap>
          <thead>
            <tr><th>Job</th><th>Schedule</th><th>Last run</th><th className="num">Affected</th><th>Result</th><th></th></tr>
          </thead>
          <tbody>
            <tr><td><div className="t1">Hold sweeper</div><div className="t2">releases expired holds, restores availability</div></td><td className="t2">every minute</td><td className="t2">21 Jul 01:58</td><td className="num">—</td><td><Pill tone="danger">errored</Pill></td><td className="rowact"><button className="btn btn-sm btn-b">Run now</button></td></tr>
            <tr><td><div className="t1">Departure status advance</div><div className="t2">scheduled → in_progress → completed</div></td><td className="t2">every 5 min</td><td className="t2">21 Jul 12:55</td><td className="num">4</td><td><Pill tone="ok">ok · 240ms</Pill></td><td className="rowact"><button className="btn btn-sm btn-o">Run now</button></td></tr>
            <tr><td><div className="t1">Subscription overdue</div><div className="t2">issued → overdue after 14-day grace</div></td><td className="t2">daily 01:00</td><td className="t2">21 Jul 01:00</td><td className="num">1</td><td><Pill tone="ok">ok · 90ms</Pill></td><td className="rowact"><button className="btn btn-sm btn-o">Run now</button></td></tr>
          </tbody>
        </TableWrap>
      </Card>

      <div className="grid-2" style={{ marginTop: 20 }}>
        <Card title="Consequences of a stalled sweeper">
          <div className="stack" style={{ gap: 12 }}>
            <Note kind="danger" icon="✕">Holds may be stuck past their 10-min TTL — cabins falsely unavailable.</Note>
            <Note kind="warn" icon="⚑"><code>available_count</code> can drift. Reconcile from <Link href="/admin/waitlist" style={{ color: 'inherit', textDecoration: 'underline' }}>Waitlist</Link>.</Note>
            <Note kind="info" icon="ℹ">No Redis lock on the sweeper yet — single-runner assumption. Flagged for the real build.</Note>
          </div>
        </Card>
        <Card title="Data health">
          <dl className="kv">
            <dt>audit_log partitions</dt><dd><Pill tone="ok">2026-07 present</Pill></dd>
            <dt>Server clock (UTC)</dt><dd><Pill tone="ok">in sync</Pill></dd>
            <dt>Stuck transitions</dt><dd><Pill tone="ok">none</Pill></dd>
            <dt>Stale quotes</dt><dd>2 pending expiry</dd>
          </dl>
        </Card>
      </div>
    </>
  );
}
