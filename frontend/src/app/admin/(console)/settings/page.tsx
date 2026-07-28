import { PageHead, Card } from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';

export default function Settings() {
  return (
    <>
      <PageHead
        title="Platform settings"
        desc="Provider credentials and platform-wide knobs. These live in environment config today — this editor is the intended in-app surface."
      />

      <div className="stack">
        <Card title="Payment gateway" head={<Pill tone="amb">sandbox</Pill>}>
          <div className="form-grid">
            <div className="field"><label>Provider</label><input defaultValue="SSLCommerz" /></div>
            <div className="field"><label>Mode</label><select><option>Sandbox</option><option>Live</option></select></div>
            <div className="field"><label>Store ID</label><input defaultValue="haorboat_test" /></div>
            <div className="field"><label>Store password</label><input type="password" defaultValue="••••••••" /></div>
          </div>
        </Card>

        <Card title="Notifications" head={<Pill tone="ok">live</Pill>}>
          <div className="form-grid">
            <div className="field"><label>SMS API URL</label><input defaultValue="https://sms.bd-provider.com/send" /></div>
            <div className="field"><label>SMS sender ID</label><input defaultValue="HAORBOAT" /></div>
            <div className="field"><label>SMTP URL</label><input defaultValue="smtp://mail.haorboat.app:587" /></div>
            <div className="field"><label>Email from</label><input defaultValue="tickets@haorboat.app" /></div>
          </div>
        </Card>

        <div className="grid-2">
          <Card title="Billing & security">
            <div className="form-grid">
              <div className="field"><label>Billing grace (days)</label><input defaultValue="14" /></div>
              <div className="field"><label>Access token TTL</label><input defaultValue="15m" /></div>
              <div className="field"><label>Refresh token TTL</label><input defaultValue="30d" /></div>
              <div className="field"><label>Refund claim window</label><input defaultValue="6 days" /></div>
            </div>
          </Card>
          <Card title="Secrets present">
            <dl className="kv">
              <dt>JWT secret</dt><dd><Pill tone="ok">set</Pill></dd>
              <dt>Refresh secret</dt><dd><Pill tone="ok">set</Pill></dd>
              <dt>CSRF secret</dt><dd><Pill tone="ok">set</Pill></dd>
              <dt>Encryption key (PII)</dt><dd><Pill tone="ok">set</Pill></dd>
              <dt>R2 / S3 storage</dt><dd><Pill tone="ok">set</Pill></dd>
            </dl>
          </Card>
        </div>

        <div><button className="btn btn-b">Save settings</button></div>
      </div>
    </>
  );
}
