import { PageHead, Card, Note } from '@/components/admin/ui';

export default function BillingConfig() {
  return (
    <>
      <PageHead
        title="Billing config"
        desc="Platform-set, per boat. Commission and monthly fee can both apply. Never combine billing across a multi-boat owner."
      />
      <div className="filterbar">
        <div className="search" style={{ maxWidth: 340 }}>
          <span className="mag">🔍</span>
          <input placeholder="Search a boat to configure…" defaultValue="Jol Kolol" />
        </div>
      </div>
      <div className="grid-2">
        <Card title="Jol Kolol — rates">
          <div className="form-grid">
            <div className="field"><label>Commission %</label><input defaultValue="5.0" /></div>
            <div className="field"><label>Monthly fee (৳)</label><input defaultValue="5000" /></div>
            <div className="field"><label>Trial start</label><input type="date" defaultValue="2026-06-01" /></div>
            <div className="field"><label>Trial end</label><input type="date" defaultValue="2026-06-30" /></div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button className="btn btn-b">Save config</button>
            <span className="pill ok" style={{ alignSelf: 'center' }}>write path pending in backend</span>
          </div>
        </Card>
        <Card title="Effect on the bill">
          <dl className="kv">
            <dt>Room total</dt><dd className="money">৳ 10,000</dd>
            <dt>Commission (5%)</dt><dd className="money">৳ 500</dd>
            <dt>Monthly fee</dt><dd className="money">৳ 5,000</dd>
            <dt>Platform balance</dt><dd className="money">৳ 0</dd>
          </dl>
          <Note kind="info" icon="ℹ" style={{ marginTop: 14 }}>
            A boat with no config silently defaults commission to 0 — this editor prevents that gap. The gateway fee is a platform-wide setting, not per boat.
          </Note>
        </Card>
      </div>
    </>
  );
}
