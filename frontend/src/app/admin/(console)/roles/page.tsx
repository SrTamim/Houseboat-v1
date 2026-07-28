import { PageHead, Card, Note } from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';
import { PermMatrix } from '@/components/admin/PermMatrix';

export default function Roles() {
  return (
    <>
      <PageHead
        title="Roles"
        desc={<>The platform defines role <b>names</b> for boats — each boat owner sets what those roles can do. For <b>platform</b> staff, the platform sets both the name and the exact permissions.</>}
      />

      <Card title="Boat role names" sub="names only · owners set the permissions">
        <Note kind="info" icon="ℹ" style={{ marginBottom: 14 }}>These names appear in every boat&apos;s role generator. Each owner decides the permissions per boat — the platform never sets a boat&apos;s permissions.</Note>
        <div className="filterbar" style={{ marginBottom: 14 }}>
          <div className="field" style={{ flex: 1, maxWidth: 320 }}><label>New role name</label><input placeholder="e.g. Reservations Desk" /></div>
          <button className="btn btn-b" style={{ alignSelf: 'flex-end' }}>+ Add role name</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Pill tone="mut">Owner</Pill><Pill tone="mut">Shareholder</Pill><Pill tone="mut">Manager</Pill>
          <Pill tone="mut">Accountant</Pill><Pill tone="mut">Reservations Desk</Pill><Pill tone="mut">Crew Lead</Pill>
        </div>
      </Card>

      <Card
        title="Platform roles"
        head={
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="select" style={{ height: 34, fontSize: 12.5 }}>
              <option>Finance Officer</option>
              <option>Moderator</option>
              <option>Read-only Auditor</option>
              <option>+ New platform role…</option>
            </select>
          </div>
        }
        style={{ marginTop: 20 }}
      >
        <div className="filterbar" style={{ marginBottom: 6 }}>
          <div className="field" style={{ flex: 1, maxWidth: 320 }}><label>Role name</label><input defaultValue="Finance Officer" /></div>
        </div>
        <Note kind="info" icon="🔑" style={{ margin: '6px 0 4px' }}>Tick a whole tab, or individual operations under it. Grouped by the console&apos;s sections.</Note>
        <PermMatrix />
        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <button className="btn btn-b">Save role & permissions</button>
          <button className="btn btn-o">Duplicate</button>
        </div>
      </Card>
    </>
  );
}
