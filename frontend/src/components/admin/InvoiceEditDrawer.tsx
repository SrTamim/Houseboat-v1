import type { Invoice } from '@/lib/admin/mock';
import { Drawer } from './Drawer';
import { INVOICE_STATUS_LIST } from '@/lib/admin/status';

// Editable full-invoice drawer (dispute → Edit): every field an input.
// Uncontrolled inputs (defaultValue) — this is a design preview; wiring is later.
export function InvoiceEditDrawer({
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
  const MoneyRow = ({ label, val, neg }: { label: string; val: string; neg?: boolean }) => (
    <>
      <span className="lbl">{label}</span>
      <span className={`val${neg ? ' neg' : ''}`}>
        <input defaultValue={val} />
      </span>
    </>
  );
  return (
    <Drawer open={open} onClose={onClose} wide title={`Edit invoice · ${inv.inv}`} footer={footer}>
      <div className="note warn" style={{ marginBottom: 6 }}>
        <span className="ic">⚑</span>
        <span>Editing a disputed invoice is logged to the audit trail. Every field below is editable.</span>
      </div>

      <div className="dsec">
        <h4>Status</h4>
        <dl className="kv">
          <dt>Invoice status</dt>
          <dd>
            <select defaultValue={inv.status}>
              {INVOICE_STATUS_LIST.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </dd>
          <dt>Trip status</dt>
          <dd>
            <select defaultValue={inv.trip}>
              <option>Completed</option>
              <option>Canceled</option>
            </select>
          </dd>
          <dt>Payment method</dt>
          <dd>
            <select defaultValue={inv.method}>
              <option>Online</option>
              <option>Cash</option>
            </select>
          </dd>
        </dl>
      </div>

      <div className="dsec">
        <h4>Customer</h4>
        <dl className="kv">
          <dt>Name</dt><dd><input defaultValue={inv.customer.name} /></dd>
          <dt>Phone</dt><dd><input defaultValue={inv.customer.phone} /></dd>
          <dt>Email</dt><dd><input defaultValue={inv.customer.email} /></dd>
          <dt>Lead guest</dt><dd><input defaultValue={inv.customer.lead} /></dd>
        </dl>
      </div>

      <div className="dsec">
        <h4>Booking</h4>
        <dl className="kv">
          <dt>Booking ID</dt><dd><input defaultValue={inv.bk} /></dd>
          <dt>Boat</dt><dd><input defaultValue={inv.boat} /></dd>
          <dt>Route</dt><dd><input defaultValue={inv.booking.route} /></dd>
          <dt>Trip dates</dt><dd><input defaultValue={inv.booking.dates} /></dd>
          <dt>Headcount</dt><dd><input defaultValue={inv.booking.headcount} /></dd>
          <dt>Reference name</dt><dd><input defaultValue={inv.booking.reference} /></dd>
        </dl>
      </div>

      <div className="dsec">
        <h4>Payment breakdown</h4>
        <div className="bd">
          <MoneyRow label="Room total" val={m.room} />
          <MoneyRow label="Gateway fee" val={m.gatewayFee} />
          <MoneyRow label="Discount / coupon" val={m.discount} neg />
          <MoneyRow label="Customer total" val={m.total} />
          <MoneyRow label="Advance paid" val={m.advance} />
          <MoneyRow label="Due" val={m.due} />
          <MoneyRow label="Total paid" val={m.paid} />
          <MoneyRow label="Overpaid" val={m.overpaid || '0'} />
          <MoneyRow label="Commission" val={m.commission} />
          <MoneyRow label="Payable to boat" val={m.dueToBoat} />
        </div>
      </div>

      <div className="dsec">
        <h4>Resolution note</h4>
        <div className="field">
          <label>Why this invoice is being edited</label>
          <input defaultValue="Refund % corrected after owner-cancel dispute." />
        </div>
      </div>
    </Drawer>
  );
}
