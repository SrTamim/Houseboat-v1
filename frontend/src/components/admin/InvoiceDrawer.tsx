import type { Invoice } from '@/lib/admin/mock';
import { Drawer } from './Drawer';
import { Pill, Tag } from './Pill';
import { statusTone, tripTone } from '@/lib/admin/status';

// Read-only full-invoice drawer (finance queues "View", disputes "View").
export function InvoiceDrawer({
  inv,
  open,
  onClose,
  footer,
}: {
  inv: Invoice;
  open: boolean;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  const m = inv.money;
  return (
    <Drawer open={open} onClose={onClose} wide title={`${inv.inv} · full invoice`} footer={footer}>
      <div className="dsec">
        <h4>Status</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Pill tone={statusTone(inv.status)}>{inv.status}</Pill>
          <Pill tone={tripTone(inv.trip)}>{inv.trip}</Pill>
          <Tag>{inv.method}</Tag>
          {inv.lock ? <Pill tone="blue" lock>in payout batch</Pill> : null}
        </div>
      </div>

      <div className="dsec">
        <h4>Customer</h4>
        <dl className="kv">
          <dt>Name</dt><dd>{inv.customer.name}</dd>
          <dt>Phone</dt><dd>{inv.customer.phone}</dd>
          <dt>Email</dt><dd>{inv.customer.email}</dd>
          <dt>Lead guest</dt><dd>{inv.customer.lead}</dd>
        </dl>
      </div>

      <div className="dsec">
        <h4>Booking</h4>
        <dl className="kv">
          <dt>Booking ID</dt><dd>{inv.bk}</dd>
          <dt>Boat</dt><dd>{inv.boat}</dd>
          <dt>Route</dt><dd>{inv.booking.route}</dd>
          <dt>Trip dates</dt><dd>{inv.booking.dates}</dd>
          <dt>Duration</dt><dd>{inv.booking.duration}</dd>
          <dt>Booking type</dt><dd>{inv.booking.type}</dd>
          <dt>Headcount</dt><dd>{inv.booking.headcount}</dd>
          <dt>Booked on</dt><dd>{inv.date}</dd>
          <dt>Reference name</dt><dd>{inv.booking.reference}</dd>
        </dl>
        <table className="mini" style={{ marginTop: 12 }}>
          <thead>
            <tr><th>Cabin</th><th>Category</th><th>Adults</th><th>Children</th><th className="num">Room price</th></tr>
          </thead>
          <tbody>
            {inv.booking.cabins.map((c) => (
              <tr key={c.name}>
                <td className="t1">{c.name}</td><td>{c.cat}</td><td>{c.adults}</td>
                <td>{c.children}</td><td className="num">৳ {c.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {inv.booking.notes ? (
          <p className="prose" style={{ marginTop: 10 }}>
            <b>Special instructions:</b> {inv.booking.notes}
          </p>
        ) : null}
      </div>

      <div className="dsec">
        <h4>Payment breakdown</h4>
        <div className="bd">
          <span className="lbl">Room total</span><span className="val">৳ {m.room}</span>
          <span className="lbl">+ Gateway fee ({m.gatewayPct})</span><span className="val">৳ {m.gatewayFee}</span>
          <div className="rule" />
          <span className="lbl">= Price shown</span><span className="val">৳ {m.shown}</span>
          <span className="lbl">− Coupon{m.coupon ? ` (${m.coupon})` : ''}</span><span className="val">−৳ {m.discount}</span>
          <div className="rule" />
          <span className="lbl">= Customer total</span><span className="val">৳ {m.total}</span>
          <div className="rule" />
          <span className="lbl">Advance paid</span><span className="val">৳ {m.advance}</span>
          <span className="lbl">Due</span><span className="val">৳ {m.due}</span>
          <span className="lbl sum">Total paid</span><span className="val sum">৳ {m.paid}</span>
          {m.overpaid ? (
            <>
              <span className="lbl">Overpaid</span>
              <span className="val" style={{ color: 'var(--danger)' }}>৳ {m.overpaid}</span>
            </>
          ) : null}
          <div className="rule" />
          <span className="lbl">Platform commission</span><span className="val">৳ {m.commission}</span>
          <span className="lbl sum">Payable to boat</span><span className="val sum">৳ {m.dueToBoat}</span>
        </div>
      </div>

      <div className="dsec">
        <h4>Payments received</h4>
        <table className="mini">
          <thead>
            <tr><th>Method</th><th className="num">Amount</th><th>Gateway / txn id</th><th>Verified by</th><th>Paid at</th></tr>
          </thead>
          <tbody>
            {inv.payments.map((p, i) => (
              <tr key={i}>
                <td className="t1">{p.method}</td><td className="num">৳ {p.amount}</td>
                <td>{p.token}</td><td>{p.by}</td><td>{p.at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="dsec">
        <h4>Record</h4>
        <dl className="kv">
          <dt>Cancellation policy (snapshot)</dt><dd>{inv.meta.policy}</dd>
          <dt>Payout batch</dt><dd>{inv.meta.batch}</dd>
          <dt>Invoice created</dt><dd>{inv.meta.created}</dd>
          <dt>Last updated</dt><dd>{inv.meta.updated}</dd>
        </dl>
        <div className="note info" style={{ marginTop: 12 }}>
          <span className="ic">ℹ</span>
          <span>Commission is charged on the original room total, never the discounted amount — the boat absorbs its own coupon.</span>
        </div>
      </div>
    </Drawer>
  );
}
