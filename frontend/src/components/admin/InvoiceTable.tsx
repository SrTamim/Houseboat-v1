import type { InvoiceRow } from '@/lib/admin/mock';
import { INVOICE_STATUS_LIST, statusTone, tripTone } from '@/lib/admin/status';
import { Pill, Tag } from './Pill';
import { Card, TableWrap, Search, Select } from './ui';

// Shared filter bar for the four finance queues.
export function InvoiceFilters({ statusOptions }: { statusOptions: string[] }) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return (
    <div className="filterbar">
      <Search placeholder="Invoice ID, booking ID, boat, txn id…" maxWidth={360} />
      <Select options={['All statuses', ...statusOptions]} />
      <Select options={['Any date', 'Today', 'Last 7 days', 'Last 30 days']} />
      <select className="select" defaultValue="Jul">
        {months.map((m) => (
          <option key={m}>{m}</option>
        ))}
      </select>
      <Select options={['2026', '2025', '2024']} />
    </div>
  );
}

// The invoice table shared by verify / refunds / payouts / overpayments.
export function InvoiceTable({
  rows,
  actionLabel,
  onAction,
}: {
  rows: InvoiceRow[];
  actionLabel: string;
  onAction: (row: InvoiceRow) => void;
}) {
  return (
    <Card flush>
      <TableWrap minWidth={1100}>
        <thead>
          <tr>
            <th>Invoice ID</th>
            <th>Booking ID</th>
            <th>Invoice status</th>
            <th>Boat</th>
            <th>Booking date</th>
            <th>Trip status</th>
            <th>Payment</th>
            <th className="num">Amount</th>
            <th>Gateway / txn id</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.inv}>
              <td className="t1">{r.inv}</td>
              <td className="t2">{r.bk}</td>
              <td><Pill tone={statusTone(r.status)}>{r.status}</Pill></td>
              <td>{r.boat}</td>
              <td className="t2">{r.date}</td>
              <td><Pill tone={tripTone(r.trip)}>{r.trip}</Pill></td>
              <td><Tag>{r.method}</Tag></td>
              <td className="num">৳ {r.amount}</td>
              <td className="t2">{r.token}</td>
              <td className="rowact">
                <button
                  className={`btn btn-sm ${r.primary ? 'btn-b' : 'btn-o'}`}
                  onClick={() => onAction(r)}
                >
                  {actionLabel}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </Card>
  );
}

export { INVOICE_STATUS_LIST };
