import { PageHead, Card, TableWrap, Search, Select } from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';

export default function Memberships() {
  return (
    <>
      <PageHead
        title="Membership oversight"
        desc="Per-boat co-owners for dispute support. An exited shareholder keeps read access to their own period only. Distributions are recorded, never auto-split."
      />
      <div className="filterbar">
        <Search placeholder="Search by boat name…" defaultValue="Jol Kolol" maxWidth={320} />
        <Select options={['All members', 'Active only', 'Exited only']} />
      </div>
      <div className="grid-2">
        <Card title="Members · Jol Kolol" flush>
          <TableWrap>
            <thead>
              <tr><th>Member</th><th>Role</th><th className="num">Share</th><th>Period</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr><td className="t1">Kamrul Owner</td><td><Pill tone="blue">Owner</Pill></td><td className="num">50%</td><td className="t2">since Mar 26</td><td><Pill tone="ok">active</Pill></td></tr>
              <tr><td className="t1">Selim Mia</td><td><Pill tone="mut">Shareholder</Pill></td><td className="num">30%</td><td className="t2">since Mar 26</td><td><Pill tone="ok">active</Pill></td></tr>
              <tr><td className="t1">Jahid Uddin</td><td><Pill tone="mut">Shareholder</Pill></td><td className="num">20%</td><td className="t2">Mar–Jun 26</td><td><Pill tone="warn">exited · read-only</Pill></td></tr>
            </tbody>
          </TableWrap>
        </Card>
        <Card
          title="Distributions"
          head={
            <div style={{ display: 'flex', gap: 8 }}>
              <Select options={['Jun', 'Jul', 'All months']} style={{ height: 34, fontSize: 12.5 }} />
              <Select options={['2026', '2025']} style={{ height: 34, fontSize: 12.5 }} />
            </div>
          }
          flush
        >
          <TableWrap>
            <thead>
              <tr><th>Member</th><th className="num">Amount</th><th>Note</th><th className="num">Date</th></tr>
            </thead>
            <tbody>
              <tr><td className="t1">Kamrul Owner</td><td className="num">৳ 1,20,000</td><td className="t2">Jun profit</td><td className="num">30 Jun</td></tr>
              <tr><td className="t1">Selim Mia</td><td className="num">৳ 72,000</td><td className="t2">Jun profit</td><td className="num">30 Jun</td></tr>
              <tr><td className="t1">Jahid Uddin</td><td className="num">৳ 48,000</td><td className="t2">exit settlement</td><td className="num">30 Jun</td></tr>
            </tbody>
          </TableWrap>
        </Card>
      </div>
    </>
  );
}
