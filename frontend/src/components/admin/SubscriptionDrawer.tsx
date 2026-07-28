import { Drawer } from './Drawer';
import { Pill } from './Pill';
import type { PillTone } from '@/lib/admin/status';

export type Subscription = {
  id: string;
  boat: string;
  owner: string;
  period: string;
  status: string;
  tone: PillTone;
  monthly: string;
  commission: string;
  due: string;
  issued: string;
  paid: string;
};

// Printable subscription (platform → boat) invoice drawer.
export function SubscriptionDrawer({
  sub,
  open,
  onClose,
  footer,
}: {
  sub: Subscription;
  open: boolean;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  return (
    <Drawer open={open} onClose={onClose} wide title={`${sub.id} · subscription invoice`} footer={footer}>
      <div className="dsec">
        <h4>Status</h4>
        <div style={{ display: 'flex', gap: 8 }}>
          <Pill tone={sub.tone}>{sub.status}</Pill>
        </div>
      </div>
      <div className="dsec">
        <h4>Billed to</h4>
        <dl className="kv">
          <dt>Boat</dt><dd>{sub.boat}</dd>
          <dt>Owner</dt><dd>{sub.owner}</dd>
          <dt>Period</dt><dd>{sub.period}</dd>
        </dl>
      </div>
      <div className="dsec">
        <h4>From</h4>
        <dl className="kv">
          <dt>HaorBoat Platform Ltd.</dt><dd>Dhaka, Bangladesh</dd>
          <dt>BIN</dt><dd>0012-3456-7890</dd>
        </dl>
      </div>
      <div className="dsec">
        <h4>Charges</h4>
        <div className="bd">
          <span className="lbl">Monthly platform fee</span><span className="val">৳ {sub.monthly}</span>
          <span className="lbl">Commission (period total)</span><span className="val">৳ {sub.commission}</span>
          <div className="rule" />
          <span className="lbl sum">Amount due</span><span className="val sum">৳ {sub.due}</span>
        </div>
      </div>
      <div className="dsec">
        <h4>Record</h4>
        <dl className="kv">
          <dt>Issued</dt><dd>{sub.issued}</dd>
          <dt>Paid</dt><dd>{sub.paid}</dd>
        </dl>
        <div className="note info" style={{ marginTop: 12 }}>
          <span className="ic">🖨</span>
          <span>Use Print for a PDF copy — the sidebar and controls are hidden in the printout.</span>
        </div>
      </div>
    </Drawer>
  );
}
