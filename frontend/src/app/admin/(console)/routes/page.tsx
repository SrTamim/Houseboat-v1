import { PageHead, Card, TableWrap } from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';

export default function Routes() {
  return (
    <>
      <PageHead
        title="Routes"
        desc="Platform-curated. Owners pick from these — they cannot create routes. Retire a route to hide it from new boats without deleting history."
        actions={<button className="btn btn-b">+ New route</button>}
      />
      <Card>
        <div className="form-grid" style={{ marginBottom: 6 }}>
          <div className="field"><label>Route name</label><input placeholder="e.g. Tanguar Haor" /></div>
          <div className="field"><label>Region</label><input placeholder="e.g. Sunamganj" /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}><button className="btn btn-b btn-block" style={{ width: '100%', justifyContent: 'center' }}>Create route</button></div>
        </div>
      </Card>
      <Card flush style={{ marginTop: 20 }}>
        <TableWrap>
          <thead>
            <tr><th>Route</th><th>Region</th><th>Boats</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            <tr><td className="t1">Tanguar Haor</td><td>Sunamganj</td><td className="t2">14 boats</td><td><Pill tone="ok">active</Pill></td><td className="rowact"><button className="btn btn-sm btn-o">Edit</button><button className="btn btn-sm btn-o">Retire</button></td></tr>
            <tr><td className="t1">Nikli Haor</td><td>Kishoreganj</td><td className="t2">9 boats</td><td><Pill tone="ok">active</Pill></td><td className="rowact"><button className="btn btn-sm btn-o">Edit</button><button className="btn btn-sm btn-o">Retire</button></td></tr>
            <tr><td className="t1">Tahirpur</td><td>Sunamganj</td><td className="t2">4 boats</td><td><Pill tone="ok">active</Pill></td><td className="rowact"><button className="btn btn-sm btn-o">Edit</button><button className="btn btn-sm btn-o">Retire</button></td></tr>
            <tr><td className="t1">Mohanganj</td><td>Netrokona</td><td className="t2">1 boat</td><td><Pill tone="ok">active</Pill></td><td className="rowact"><button className="btn btn-sm btn-o">Edit</button><button className="btn btn-sm btn-o">Retire</button></td></tr>
            <tr><td className="t1">Baulai River</td><td>Sunamganj</td><td className="t2">0 boats</td><td><Pill tone="mut">retired</Pill></td><td className="rowact"><button className="btn btn-sm btn-o">Reactivate</button></td></tr>
          </tbody>
        </TableWrap>
      </Card>
    </>
  );
}
