import { PageHead, Card, TableWrap, Note, Search, Select } from '@/components/admin/ui';
import { Pill, Tag } from '@/components/admin/Pill';

export default function Coupons() {
  return (
    <>
      <PageHead
        title="Coupons & referrals"
        desc="Create coupon codes and watch usage. The boat absorbs its own coupon — commission is unaffected. Referral coupons and free-text reference names are checked for self-referral patterns."
      />

      <Card title="Create coupon">
        <div className="form-grid">
          <div className="field"><label>Code</label><input placeholder="e.g. MONSOON25" /></div>
          <div className="field"><label>Boat</label><input placeholder="Search boat…" /></div>
          <div className="field"><label>Kind</label><select><option>Percent</option><option>Flat</option><option>Referral</option></select></div>
          <div className="field"><label>Value</label><input placeholder="e.g. 10% or ৳500" /></div>
          <div className="field"><label>Valid from</label><input type="date" defaultValue="2026-07-01" /></div>
          <div className="field"><label>Valid to</label><input type="date" defaultValue="2026-07-31" /></div>
        </div>
        <div style={{ marginTop: 16 }}><button className="btn btn-b">+ Create coupon</button></div>
      </Card>

      <div className="filterbar" style={{ marginTop: 20 }}>
        <Search placeholder="Code or boat…" maxWidth={300} />
        <Select options={['All kinds', 'Percent', 'Flat', 'Referral']} />
        <Select options={['Any date', 'Active now', 'Expired']} />
        <Select options={['Jul', 'Jun', 'All months']} />
        <Select options={['2026', '2025']} />
      </div>

      <Card flush>
        <TableWrap>
          <thead>
            <tr><th>Code</th><th>Boat</th><th>Kind</th><th className="num">Uses</th><th>Reference pattern</th><th>Flag</th></tr>
          </thead>
          <tbody>
            <tr><td className="t1">EID10</td><td>Jol Kolol</td><td><Tag>percent</Tag></td><td className="num">142</td><td className="t2">varied</td><td><Pill tone="ok">normal</Pill></td></tr>
            <tr><td className="t1">FRIEND</td><td>Jol Kolol</td><td><Tag>referral</Tag></td><td className="num">61</td><td className="t2">28× same name &quot;Rakib&quot;</td><td><Pill tone="danger">self-referral?</Pill></td></tr>
            <tr><td className="t1">MONSOON</td><td>Haor Bilash</td><td><Tag>flat</Tag></td><td className="num">34</td><td className="t2">varied</td><td><Pill tone="ok">normal</Pill></td></tr>
            <tr><td className="t1">WELCOME</td><td>Meghduar</td><td><Tag>referral</Tag></td><td className="num">9</td><td className="t2">varied</td><td><Pill tone="ok">normal</Pill></td></tr>
          </tbody>
        </TableWrap>
      </Card>

      <Note kind="info" icon="ℹ" style={{ marginTop: 16 }}>
        Coupons never reduce platform commission — this view is fraud oversight, not a cost to the platform.
      </Note>
    </>
  );
}
