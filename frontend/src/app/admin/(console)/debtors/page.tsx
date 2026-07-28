import { PageHead, Card, TableWrap, Search, Select, Note } from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';

export default function Debtors() {
  return (
    <>
      <PageHead
        title="Debtors & access control"
        desc="Boats with a negative platform_balance owe the platform. The debt offsets the platform fee; if it exceeds the fee, access is denied until settled."
      />
      <div className="filterbar">
        <Search placeholder="Search boat…" maxWidth={300} />
        <Select options={['All access', 'Denied', 'Grace', 'Within fee']} />
        <Select options={['Any amount', 'Exceeds fee', 'Within fee']} />
      </div>
      <Card flush>
        <TableWrap>
          <thead>
            <tr><th>Boat</th><th className="num">Balance</th><th className="num">Platform fee</th><th>Debt vs fee</th><th>Access</th><th></th></tr>
          </thead>
          <tbody>
            <tr><td className="t1">Bhela</td><td className="num neg">−৳ 12,400</td><td className="num">৳ 5,000</td><td><Pill tone="danger">exceeds fee</Pill></td><td><Pill tone="danger">denied</Pill></td><td className="rowact"><button className="btn btn-sm btn-ok">Restore</button></td></tr>
            <tr><td className="t1">Shonar Tori</td><td className="num neg">−৳ 3,100</td><td className="num">৳ 5,000</td><td><Pill tone="warn">within fee</Pill></td><td><Pill tone="ok">allowed</Pill></td><td className="rowact"><button className="btn btn-sm btn-danger">Deny</button></td></tr>
            <tr><td className="t1">Haor Bilash</td><td className="num neg">−৳ 8,200</td><td className="num">৳ 5,000</td><td><Pill tone="danger">exceeds fee</Pill></td><td><Pill tone="warn">grace</Pill></td><td className="rowact"><button className="btn btn-sm btn-danger">Deny</button></td></tr>
          </tbody>
        </TableWrap>
      </Card>
      <Note kind="danger" icon="▲" style={{ marginTop: 16 }}>
        Denying access blocks all boat operations except paying the outstanding bill. It is logged and reversible.
      </Note>
    </>
  );
}
