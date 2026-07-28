import { PageHead, Card, TableWrap, Note, Search, Select } from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';

export default function Audit() {
  return (
    <>
      <PageHead
        title="Audit log"
        desc="Append-only fraud evidence — nobody, not even the platform, can rewrite it. Device time may be manipulated; server time is authoritative. PII is masked; bank details are stored as references."
        actions={<button className="btn btn-o">⤓ Export evidence bundle</button>}
      />

      <div className="filterbar">
        <Select options={['All boats', 'Platform-level (null)', 'Jol Kolol']} />
        <Select options={['All actions', 'mark_paid', 'price_change', 'role_change', 'void']} />
        <Search placeholder="Actor or entity…" />
      </div>

      <Note kind="ok" icon="✓" style={{ marginBottom: 16 }}>Integrity check passed — no UPDATE or DELETE detected on this partition.</Note>

      <Card flush>
        <TableWrap>
          <thead>
            <tr><th>Actor</th><th>Action</th><th>Entity</th><th>Boat</th><th>Device time</th><th>Server time</th><th>Src</th></tr>
          </thead>
          <tbody>
            <tr><td className="t1">Nusrat J.</td><td><Pill tone="ok">mark_paid</Pill></td><td className="t2">invoice INV-8410</td><td>Jol Kolol</td><td className="t2">18:41:05</td><td className="num">18:41:07</td><td><Pill tone="mut">online</Pill></td></tr>
            <tr><td className="t1">Owner</td><td><Pill tone="amb">price_change</Pill></td><td className="t2">pricing_rule</td><td>Jol Kolol</td><td className="t2">17:35:38</td><td className="num">17:35:40</td><td><Pill tone="mut">online</Pill></td></tr>
            <tr><td className="t1">Manager</td><td><Pill tone="blue">cost_add</Pill></td><td className="t2">cost · fuel</td><td>Haor Bilash</td><td className="t2">09:12:00</td><td className="num">14:05:33</td><td><Pill tone="amb">offline</Pill></td></tr>
            <tr><td className="t1">Ex-manager</td><td><Pill tone="danger">mark_paid (rejected)</Pill></td><td className="t2">invoice</td><td>Bhela</td><td className="t2">02:59:00</td><td className="num">14:05:34</td><td><Pill tone="danger">offline · perm-lost</Pill></td></tr>
            <tr><td className="t1">Rafiq A.</td><td><Pill tone="blue">role_change</Pill></td><td className="t2">membership</td><td>Jol Kolol</td><td className="t2">—</td><td className="num">11:20:01</td><td><Pill tone="mut">platform</Pill></td></tr>
          </tbody>
        </TableWrap>
      </Card>
    </>
  );
}
