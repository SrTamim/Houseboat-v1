/* eslint-disable */
// System group: jobs, audit, sync, notifications, gateway, settings, roles
module.exports = [

{ key:'jobs', out:'admin-jobs.html', title:'Jobs & health', crumb:'Schedulers · UTC', body:`
      <div class="page-head">
        <div><h1>Jobs &amp; system health</h1><p>Three cron jobs keep money and inventory correct. They run on UTC; times shown in BST. Re-runs are idempotent — safe to trigger manually.</p></div>
        <div class="acts"><button class="btn btn-o">↻ Refresh</button></div>
      </div>
      <div class="card2"><div class="ch"><h3>Scheduled jobs</h3></div><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Job</th><th>Schedule</th><th>Last run</th><th class="num">Affected</th><th>Result</th><th></th></tr></thead>
        <tbody>
          <tr><td><div class="t1">Hold sweeper</div><div class="t2">releases expired holds, restores availability</div></td><td class="t2">every minute</td><td class="t2">21 Jul 01:58</td><td class="num">—</td><td><span class="pill danger">errored</span></td><td class="rowact"><button class="btn btn-sm btn-b">Run now</button></td></tr>
          <tr><td><div class="t1">Departure status advance</div><div class="t2">scheduled → in_progress → completed</div></td><td class="t2">every 5 min</td><td class="t2">21 Jul 12:55</td><td class="num">4</td><td><span class="pill ok">ok · 240ms</span></td><td class="rowact"><button class="btn btn-sm btn-o">Run now</button></td></tr>
          <tr><td><div class="t1">Subscription overdue</div><div class="t2">issued → overdue after 14-day grace</div></td><td class="t2">daily 01:00</td><td class="t2">21 Jul 01:00</td><td class="num">1</td><td><span class="pill ok">ok · 90ms</span></td><td class="rowact"><button class="btn btn-sm btn-o">Run now</button></td></tr>
        </tbody>
      </table></div></div></div>
      <div class="grid-2" style="margin-top:20px">
        <div class="card2"><div class="ch"><h3>Consequences of a stalled sweeper</h3></div><div class="cb stack" style="gap:12px">
          <div class="note danger"><span class="ic">✕</span> Holds may be stuck past their 10-min TTL — cabins falsely unavailable.</div>
          <div class="note warn"><span class="ic">⚑</span> <code>available_count</code> can drift. Reconcile from <a href="admin-waitlist.html" style="color:inherit;text-decoration:underline">Waitlist</a>.</div>
          <div class="note info"><span class="ic">ℹ</span> No Redis lock on the sweeper yet — single-runner assumption. Flagged for the real build.</div>
        </div></div>
        <div class="card2"><div class="ch"><h3>Data health</h3></div><div class="cb"><dl class="kv">
          <dt>audit_log partitions</dt><dd><span class="pill ok">2026-07 present</span></dd>
          <dt>Server clock (UTC)</dt><dd><span class="pill ok">in sync</span></dd>
          <dt>Stuck transitions</dt><dd><span class="pill ok">none</span></dd>
          <dt>Stale quotes</dt><dd>2 pending expiry</dd>
        </dl></div></div>
      </div>
`},

{ key:'audit', out:'admin-audit.html', title:'Audit log', crumb:'Append-only', body:`
      <div class="page-head">
        <div><h1>Audit log</h1><p>Append-only fraud evidence — nobody, not even the platform, can rewrite it. Device time may be manipulated; server time is authoritative. PII is masked; bank details are stored as references.</p></div>
        <div class="acts"><button class="btn btn-o">⤓ Export evidence bundle</button></div>
      </div>
      <div class="filterbar">
        <select class="select"><option>All boats</option><option>Platform-level (null)</option><option>Jol Kolol</option></select>
        <select class="select"><option>All actions</option><option>mark_paid</option><option>price_change</option><option>role_change</option><option>void</option></select>
        <div class="search"><span class="mag">🔍</span><input placeholder="Actor or entity…"></div>
      </div>
      <div class="note ok" style="margin-bottom:16px"><span class="ic">✓</span> Integrity check passed — no UPDATE or DELETE detected on this partition.</div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Actor</th><th>Action</th><th>Entity</th><th>Boat</th><th>Device time</th><th>Server time</th><th>Src</th></tr></thead>
        <tbody>
          <tr><td class="t1">Nusrat J.</td><td><span class="pill ok">mark_paid</span></td><td class="t2">invoice INV-8410</td><td>Jol Kolol</td><td class="t2">18:41:05</td><td class="num">18:41:07</td><td><span class="pill mut">online</span></td></tr>
          <tr><td class="t1">Owner</td><td><span class="pill amb">price_change</span></td><td class="t2">pricing_rule</td><td>Jol Kolol</td><td class="t2">17:35:38</td><td class="num">17:35:40</td><td><span class="pill mut">online</span></td></tr>
          <tr><td class="t1">Manager</td><td><span class="pill blue">cost_add</span></td><td class="t2">cost · fuel</td><td>Haor Bilash</td><td class="t2">09:12:00</td><td class="num">14:05:33</td><td><span class="pill amb">offline</span></td></tr>
          <tr><td class="t1">Ex-manager</td><td><span class="pill danger">mark_paid (rejected)</span></td><td class="t2">invoice</td><td>Bhela</td><td class="t2">02:59:00</td><td class="num">14:05:34</td><td><span class="pill danger">offline · perm-lost</span></td></tr>
          <tr><td class="t1">Rafiq A.</td><td><span class="pill blue">role_change</span></td><td class="t2">membership</td><td>Jol Kolol</td><td class="t2">—</td><td class="num">11:20:01</td><td><span class="pill mut">platform</span></td></tr>
        </tbody>
      </table></div></div></div>
`},

{ key:'sync', out:'admin-sync.html', title:'Sync conflicts', crumb:'Offline replay', body:`
      <div class="page-head">
        <div><h1>Offline-sync conflicts</h1><p>Replayed intents are re-authorized against permissions as of device time. Failures land here for a human — never silently applied or dropped. A manipulated clock can reorder but never erase.</p></div>
      </div>
      <div class="note ok" style="margin-bottom:16px"><span class="ic">✓</span> Last batch: <b>7 actions synced, 1 needs review</b> — device "Manager · Redmi" reconnected 14:05.</div>
      <div class="filterbar"><div class="seg"><button class="seg-b on">Needs review<span class="ct">1</span></button><button class="seg-b">Clock skew<span class="ct">1</span></button><button class="seg-b">Permission-lost<span class="ct">1</span></button><button class="seg-b">Resolved<span class="ct">6</span></button></div></div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Intent</th><th>Actor · boat</th><th>Conflict</th><th>Device vs server</th><th></th></tr></thead>
        <tbody>
          <tr><td><div class="t1">mark_cash_paid</div><div class="t2">INV-5d14</div></td><td>Manager · Bhela</td><td><span class="pill danger">paid vs void</span></td><td class="t2">09:00 → 14:05</td><td class="rowact"><button class="btn btn-sm btn-o">Reject</button><button class="btn btn-sm btn-b">Resolve</button></td></tr>
          <tr><td><div class="t1">mark_paid</div><div class="t2">INV-5d14</div></td><td>Ex-manager · Bhela</td><td><span class="pill danger">permission lost</span></td><td class="t2">02:59 → 14:05</td><td class="rowact"><button class="btn btn-sm btn-danger">Discard</button></td></tr>
          <tr><td><div class="t1">cost_add</div><div class="t2">fuel ৳4,200</div></td><td>Manager · Haor Bilash</td><td><span class="pill warn">clock skew 5h</span></td><td class="t2">09:12 → 14:05</td><td class="rowact"><button class="btn btn-sm btn-ok">Accept</button></td></tr>
        </tbody>
      </table></div></div></div>
`},

{ key:'notifications', out:'admin-notifications.html', title:'Notifications', crumb:'Delivery monitor', body:`
      <div class="page-head">
        <div><h1>Notifications</h1><p>Platform feed and delivery monitor. Undelivered SMS/email — especially e-tickets and waitlist blasts — surface here to resend. Sending is best-effort with no automatic retry today.</p></div>
      </div>
      <div class="filterbar"><div class="seg"><button class="seg-b on">All<span class="ct">1,204</span></button><button class="seg-b">Failed<span class="ct">4</span></button><button class="seg-b">SMS</button><button class="seg-b">Email</button></div></div>
      <div class="note warn" style="margin-bottom:16px"><span class="ic">⚑</span> SMS provider healthy · SMTP healthy. 4 messages failed on the customer side (invalid number / bounce).</div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Event</th><th>Recipient</th><th>Channel</th><th>Status</th><th class="num">At</th><th></th></tr></thead>
        <tbody>
          <tr><td class="t1">e-ticket</td><td class="t2">+8801933220011</td><td><span class="tag">SMS</span></td><td><span class="pill danger">failed</span></td><td class="num">18:40</td><td class="rowact"><button class="btn btn-sm btn-b">Resend</button></td></tr>
          <tr><td class="t1">waitlist_open</td><td class="t2">+8801822114455</td><td><span class="tag">SMS</span></td><td><span class="pill danger">failed</span></td><td class="num">17:41</td><td class="rowact"><button class="btn btn-sm btn-b">Resend</button></td></tr>
          <tr><td class="t1">refund_sent</td><td class="t2">farhana@example.com</td><td><span class="tag">Email</span></td><td><span class="pill danger">bounced</span></td><td class="num">16:50</td><td class="rowact"><button class="btn btn-sm btn-b">Resend</button></td></tr>
          <tr><td class="t1">payment_due</td><td class="t2">+8801711002200</td><td><span class="tag">SMS</span></td><td><span class="pill ok">delivered</span></td><td class="num">15:22</td><td></td></tr>
          <tr><td class="t1">booking</td><td class="t2">tanvir@example.com</td><td><span class="tag">Email</span></td><td><span class="pill ok">delivered</span></td><td class="num">15:22</td><td></td></tr>
        </tbody>
      </table></div></div></div>
`},

{ key:'gateway', out:'admin-gateway.html', title:'Gateway', crumb:'SSLCommerz', body:`
      <div class="page-head">
        <div><h1>Payment gateway</h1><p>SSLCommerz. IPN is authoritative — the raw callback is never trusted, only re-validation by val_id. Replays are idempotent no-ops via the unique gateway token.</p></div>
      </div>
      <div class="kpis">
        <div class="kpi"><div class="l">Mode</div><div class="n" style="font-size:22px"><span class="pill amb">SANDBOX</span></div><div class="d">switch in Settings</div></div>
        <div class="kpi"><div class="l">IPNs today</div><div class="n">312</div><div class="d up">308 confirmed</div></div>
        <div class="kpi alert"><div class="l">Failed / unmatched</div><div class="n">4</div><div class="d down">dropped, not recorded</div></div>
        <div class="kpi"><div class="l">Replay no-ops</div><div class="n">17</div><div class="d">idempotent</div></div>
      </div>
      <div class="card2"><div class="ch"><h3>Recent IPN events</h3><span class="sub">+5-min hold window covers the gateway round-trip</span></div><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>val_id</th><th>Invoice</th><th class="num">Amount</th><th>Result</th><th class="num">At</th></tr></thead>
        <tbody>
          <tr><td class="t2">2507211841…</td><td>INV-9a11</td><td class="num">৳ 1,84,000</td><td><span class="pill ok">confirmed</span></td><td class="num">18:41</td></tr>
          <tr><td class="t2">2507211820…</td><td>INV-88f2</td><td class="num">৳ 96,500</td><td><span class="pill mut">replay no-op</span></td><td class="num">18:20</td></tr>
          <tr><td class="t2">2507211802…</td><td>—</td><td class="num">৳ 12,700</td><td><span class="pill danger">validation failed</span></td><td class="num">18:02</td></tr>
          <tr><td class="t2">2507211750…</td><td>—</td><td class="num">—</td><td><span class="pill danger">unmatched</span></td><td class="num">17:50</td></tr>
        </tbody>
      </table></div></div></div>
`},

{ key:'settings', out:'admin-settings.html', title:'Settings', crumb:'Platform config', body:`
      <div class="page-head">
        <div><h1>Platform settings</h1><p>Provider credentials and platform-wide knobs. These live in environment config today — this editor is the intended in-app surface.</p></div>
      </div>
      <div class="stack">
        <div class="card2"><div class="ch"><h3>Payment gateway</h3><span class="pill amb">sandbox</span></div><div class="cb">
          <div class="form-grid">
            <div class="field"><label>Provider</label><input value="SSLCommerz"></div>
            <div class="field"><label>Mode</label><select><option>Sandbox</option><option>Live</option></select></div>
            <div class="field"><label>Store ID</label><input value="haorboat_test"></div>
            <div class="field"><label>Store password</label><input type="password" value="••••••••"></div>
          </div>
        </div></div>
        <div class="card2"><div class="ch"><h3>Notifications</h3><span class="pill ok">live</span></div><div class="cb">
          <div class="form-grid">
            <div class="field"><label>SMS API URL</label><input value="https://sms.bd-provider.com/send"></div>
            <div class="field"><label>SMS sender ID</label><input value="HAORBOAT"></div>
            <div class="field"><label>SMTP URL</label><input value="smtp://mail.haorboat.app:587"></div>
            <div class="field"><label>Email from</label><input value="tickets@haorboat.app"></div>
          </div>
        </div></div>
        <div class="grid-2">
          <div class="card2"><div class="ch"><h3>Billing &amp; security</h3></div><div class="cb"><div class="form-grid">
            <div class="field"><label>Billing grace (days)</label><input value="14"></div>
            <div class="field"><label>Access token TTL</label><input value="15m"></div>
            <div class="field"><label>Refresh token TTL</label><input value="30d"></div>
            <div class="field"><label>Refund claim window</label><input value="6 days"></div>
          </div></div></div>
          <div class="card2"><div class="ch"><h3>Secrets present</h3></div><div class="cb"><dl class="kv">
            <dt>JWT secret</dt><dd><span class="pill ok">set</span></dd>
            <dt>Refresh secret</dt><dd><span class="pill ok">set</span></dd>
            <dt>CSRF secret</dt><dd><span class="pill ok">set</span></dd>
            <dt>Encryption key (PII)</dt><dd><span class="pill ok">set</span></dd>
            <dt>R2 / S3 storage</dt><dd><span class="pill ok">set</span></dd>
          </dl></div></div>
        </div>
        <div><button class="btn btn-b">Save settings</button></div>
      </div>
`},

{ key:'roles', out:'admin-roles.html', title:'Role templates', crumb:'Permission library', body:`
      <div class="page-head">
        <div><h1>Role templates</h1><p>Platform-seeded starter roles owners clone via the role generator. Permissions are a per-module view/edit map across the 10 fixed modules.</p></div>
        <div class="acts"><button class="btn btn-b">+ New template</button></div>
      </div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Template</th><th>Summary</th><th class="num">Cloned by</th><th></th></tr></thead>
        <tbody>
          <tr><td class="t1">Owner</td><td class="t2">Full view + edit on all modules</td><td class="num">28 boats</td><td class="rowact"><button class="btn btn-sm btn-o">Edit</button></td></tr>
          <tr><td class="t1">Shareholder</td><td class="t2">View all · edit money &amp; reports</td><td class="num">19 boats</td><td class="rowact"><button class="btn btn-sm btn-o">Edit</button></td></tr>
          <tr><td class="t1">Manager</td><td class="t2">Edit bookings/trips/staff/costs · view money</td><td class="num">24 boats</td><td class="rowact"><button class="btn btn-sm btn-o">Edit</button></td></tr>
          <tr><td class="t1">Accountant</td><td class="t2">Money + reports only</td><td class="num">7 boats</td><td class="rowact"><button class="btn btn-sm btn-o">Edit</button></td></tr>
        </tbody>
      </table></div></div></div>
      <div class="card2" style="margin-top:20px"><div class="ch"><h3>Manager · permission map</h3></div><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Module</th><th>View</th><th>Edit</th></tr></thead>
        <tbody>
          <tr><td class="t1">bookings</td><td><span class="pill ok">yes</span></td><td><span class="pill ok">yes</span></td></tr>
          <tr><td class="t1">trips</td><td><span class="pill ok">yes</span></td><td><span class="pill ok">yes</span></td></tr>
          <tr><td class="t1">pricing</td><td><span class="pill ok">yes</span></td><td><span class="pill mut">no</span></td></tr>
          <tr><td class="t1">money</td><td><span class="pill ok">yes</span></td><td><span class="pill mut">no</span></td></tr>
          <tr><td class="t1">staff</td><td><span class="pill ok">yes</span></td><td><span class="pill ok">yes</span></td></tr>
          <tr><td class="t1">settings</td><td><span class="pill mut">no</span></td><td><span class="pill mut">no</span></td></tr>
        </tbody>
      </table></div></div></div>
`},

];
