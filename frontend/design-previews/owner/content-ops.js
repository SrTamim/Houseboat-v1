/* eslint-disable */
// Operations group: costs, inventory, maintenance, reports, notifications, audit, sync, settings
module.exports = [

{ key:'costs', out:'owner-costs.html', title:'Costs', crumb:'Jol Kolol · the spreadsheet-killer', body:`
      <div class="page-head">
        <div><h1>Costs</h1><p>One row, faster than a sheet. No forced categories — bazar, fuel, repair, whatever. Bangla numerals accepted. Link a cost to a trip or leave it loose. Who paid is captured automatically.</p></div>
      </div>
      <div class="card2" style="margin-bottom:20px"><div class="ch"><h3>Quick add</h3></div><div class="cb">
        <div style="display:grid;grid-template-columns:1fr 1.4fr 1fr auto;gap:12px;align-items:end">
          <div class="field"><label>Date</label><input value="21 Jul 2026"></div>
          <div class="field"><label>What for</label><input placeholder="Bazar, fuel, repair…"></div>
          <div class="field"><label>Amount ৳</label><input placeholder="৩৫০০ or 3500"></div>
          <button class="btn btn-b" style="height:44px">＋ Add</button>
        </div>
        <div class="note info" style="margin-top:12px"><span class="ic">ℹ️</span> Type ৩৫০০ or 3500 — both work. Optionally link a trip or add a vendor due; no vendor management to set up.</div>
      </div></div>
      <div class="filterbar"><div class="seg"><button class="seg-b on">This week</button><button class="seg-b">This month</button><button class="seg-b">By trip</button></div><div class="search"><span class="mag">🔍</span><input placeholder="Search…"></div></div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Date</th><th>Description</th><th>Trip</th><th>Paid by</th><th class="num">Vendor due</th><th class="num">Amount</th></tr></thead>
        <tbody>
          <tr><td class="t2">21 Jul</td><td class="t1">Diesel · 60L</td><td class="t2">21 Jul 2D1N</td><td class="t2">Nur</td><td class="num">—</td><td class="num">৳6,300</td></tr>
          <tr><td class="t2">21 Jul</td><td class="t1">Bazar — fish, veg, rice</td><td class="t2">21 Jul 2D1N</td><td class="t2">Ripon</td><td class="num">৳1,200</td><td class="num">৳8,400</td></tr>
          <tr><td class="t2">20 Jul</td><td class="t1">Generator belt repair</td><td class="t2">—</td><td class="t2">You</td><td class="num">—</td><td class="num">৳2,500</td></tr>
          <tr><td class="t2">19 Jul</td><td class="t1">Gas cylinder × 2</td><td class="t2">—</td><td class="t2">Nur</td><td class="num">—</td><td class="num">৳2,800</td></tr>
          <tr><td class="t2">18 Jul</td><td class="t1">Ghat parking + labour</td><td class="t2">18 Jul Day</td><td class="t2">Sohel</td><td class="num">—</td><td class="num">৳900</td></tr>
        </tbody>
        <tfoot><tr><td colspan="5" class="t1" style="text-align:right">Week total</td><td class="num">৳20,900</td></tr></tfoot>
      </table></div></div></div>
`},

{ key:'inventory', out:'owner-inventory.html', title:'Inventory', crumb:'Jol Kolol · stock', body:`
      <div class="page-head">
        <div><h1>Inventory</h1><p>Consumables flag when they drop below reorder. Durables you count whenever you choose — the system compares actual against expected and flags anything missing.</p></div>
        <div class="acts"><a class="btn btn-o" href="#">＋ Log movement</a><a class="btn btn-b" href="#">Run a count</a></div>
      </div>
      <div class="card2" style="margin-bottom:20px"><div class="ch"><h3>Consumables</h3><span class="sub">reorder alert</span></div>
        <div class="cb flush"><div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Item</th><th class="num">On hand</th><th class="num">Reorder at</th><th>Status</th><th></th></tr></thead>
          <tbody>
            <tr><td class="t1">Rice</td><td class="num">8 kg</td><td class="num">15 kg</td><td><span class="pill danger">low — reorder</span></td><td class="rowact"><a class="btn btn-sm btn-o" href="#">Log out</a></td></tr>
            <tr><td class="t1">Gas cylinder</td><td class="num">1</td><td class="num">2</td><td><span class="pill danger">low — reorder</span></td><td class="rowact"><a class="btn btn-sm btn-o" href="#">Log out</a></td></tr>
            <tr><td class="t1">Cooking oil</td><td class="num">12 L</td><td class="num">8 L</td><td><span class="pill ok">ok</span></td><td class="rowact"><a class="btn btn-sm btn-o" href="#">Log out</a></td></tr>
            <tr><td class="t1">Diesel</td><td class="num">140 L</td><td class="num">50 L</td><td><span class="pill ok">ok</span></td><td class="rowact"><a class="btn btn-sm btn-o" href="#">Log out</a></td></tr>
          </tbody>
        </table></div></div>
      </div>
      <div class="card2"><div class="ch"><h3>Durables · last count 14 Jul</h3><span class="sub">missing-item check</span></div>
        <div class="cb flush"><div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Item</th><th class="num">Expected</th><th class="num">Counted</th><th class="num">Discrepancy</th><th>Flag</th></tr></thead>
          <tbody>
            <tr><td class="t1">Life jackets</td><td class="num">40</td><td class="num">40</td><td class="num">0</td><td><span class="pill ok">ok</span></td></tr>
            <tr><td class="t1">Bedsheets</td><td class="num">24</td><td class="num">21</td><td class="num neg">3</td><td><span class="pill danger">missing</span></td></tr>
            <tr><td class="t1">Plates</td><td class="num">60</td><td class="num">55</td><td class="num neg">5</td><td><span class="pill danger">missing</span></td></tr>
            <tr><td class="t1">Blankets</td><td class="num">24</td><td class="num">24</td><td class="num">0</td><td><span class="pill ok">ok</span></td></tr>
          </tbody>
        </table></div></div>
      </div>
`},

{ key:'maintenance', out:'owner-maintenance.html', title:'Maintenance', crumb:'Jol Kolol · boat log', body:`
      <div class="page-head">
        <div><h1>Maintenance</h1><p>Engine hours, service reminders, and a damage log for the boat itself. Keep the hull, engine and generator on schedule so a breakdown never strands a trip.</p></div>
        <div class="acts"><a class="btn btn-b" href="#">＋ Log service</a></div>
      </div>
      <div class="note info" style="margin-bottom:16px"><span class="ic">ℹ️</span> New module — not backed by a schema table yet. Design preview of what boat upkeep tracking would look like alongside the rest of the console.</div>
      <div class="kpis">
        <div class="kpi"><div class="l"><span class="ic">⚙</span> Engine hours</div><div class="n">1,284</div><div class="d">since last overhaul</div></div>
        <div class="kpi alert"><div class="l"><span class="ic">🛠</span> Service due</div><div class="n">1</div><div class="d down">oil change at 1,300h</div></div>
        <div class="kpi"><div class="l"><span class="ic">🩹</span> Open damage</div><div class="n">2</div><div class="d">logged, not fixed</div></div>
        <div class="kpi"><div class="l"><span class="ic">📋</span> Last inspection</div><div class="n">3 Jul</div><div class="d up">passed</div></div>
      </div>
      <div class="grid-2">
        <div class="card2"><div class="ch"><h3>Service schedule</h3></div>
          <div class="cb flush"><div class="tbl-wrap"><table class="tbl">
            <thead><tr><th>Task</th><th>Interval</th><th>Due</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td class="t1">Engine oil change</td><td class="t2">every 100h</td><td class="t2">1,300h · 16h away</td><td><span class="pill warn">due soon</span></td></tr>
              <tr><td class="t1">Hull inspection</td><td class="t2">monthly</td><td class="t2">1 Aug</td><td><span class="pill ok">scheduled</span></td></tr>
              <tr><td class="t1">Life-jacket check</td><td class="t2">before each trip</td><td class="t2">21 Jul</td><td><span class="pill ok">done</span></td></tr>
              <tr><td class="t1">Generator service</td><td class="t2">every 250h</td><td class="t2">1,450h</td><td><span class="pill mut">upcoming</span></td></tr>
            </tbody>
          </table></div></div>
        </div>
        <div class="card2"><div class="ch"><h3>Damage log</h3><a class="btn btn-sm btn-o" href="#">＋ Report</a></div>
          <div class="cb flush"><div class="tbl-wrap"><table class="tbl" style="min-width:0">
            <thead><tr><th>Issue</th><th>Reported</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td class="t1">Generator belt worn</td><td class="t2">20 Jul</td><td><span class="pill ok">fixed ৳2,500</span></td></tr>
              <tr><td class="t1">Cabin 203 door latch</td><td class="t2">17 Jul</td><td><span class="pill warn">open</span></td></tr>
              <tr><td class="t1">Deck rail loose (upper)</td><td class="t2">11 Jul</td><td><span class="pill warn">open</span></td></tr>
            </tbody>
          </table></div></div>
        </div>
      </div>
`},

{ key:'reports', out:'owner-reports.html', title:'Reports', crumb:'Jol Kolol · cost & profit', body:`
      <div class="page-head">
        <div><h1>Reports</h1><p>Cost and profit per trip and per period. Trace where the money went — cash included, since verified cash counts even though it never enters the payout.</p></div>
        <div class="acts"><div class="seg"><button class="seg-b on">Per trip</button><button class="seg-b">Monthly</button></div><a class="btn btn-o" href="#">Export</a></div>
      </div>
      <div class="card2"><div class="ch"><h3>Profit per trip · July</h3></div>
        <div class="cb flush"><div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Departure</th><th class="num">Revenue</th><th class="num">Commission</th><th class="num">Costs</th><th class="num">Crew</th><th class="num">Net</th></tr></thead>
          <tbody>
            <tr><td class="t1">21 Jul · 2D1N</td><td class="num">৳62,400</td><td class="num">৳3,120</td><td class="num">৳14,700</td><td class="num">৳8,600</td><td class="num">৳35,980</td></tr>
            <tr><td class="t1">18 Jul · Day</td><td class="num">৳48,000</td><td class="num">৳2,400</td><td class="num">৳6,900</td><td class="num">৳5,100</td><td class="num">৳33,600</td></tr>
            <tr><td class="t1">17 Jul · 2D1N</td><td class="num">৳54,900</td><td class="num">৳2,745</td><td class="num">৳12,100</td><td class="num">৳8,600</td><td class="num">৳31,455</td></tr>
            <tr><td class="t1">11 Jul · Day</td><td class="num">৳51,200</td><td class="num">৳2,560</td><td class="num">৳7,400</td><td class="num">৳5,100</td><td class="num">৳36,140</td></tr>
          </tbody>
          <tfoot><tr><td class="t1" style="text-align:right">July total</td><td class="num">৳9,64,000</td><td class="num">৳48,200</td><td class="num">৳2,08,900</td><td class="num">৳1,42,000</td><td class="num">৳5,47,550</td></tr></tfoot>
        </table></div></div>
      </div>
      <div class="grid-3" style="margin-top:20px">
        <div class="kpi"><div class="l"><span class="ic">📈</span> Avg cabin fill</div><div class="n">86%</div><div class="d up">+9% vs Jun</div></div>
        <div class="kpi"><div class="l"><span class="ic">৳</span> Revenue / trip</div><div class="n"><span class="u">৳</span>54,100</div><div class="d">18 trips</div></div>
        <div class="kpi"><div class="l"><span class="ic">💰</span> Margin</div><div class="n">57%</div><div class="d up">after all costs</div></div>
      </div>
`},

{ key:'notifications', out:'owner-notifications.html', title:'Notifications', crumb:'Jol Kolol · this boat', body:`
      <div class="page-head">
        <div><h1>Notifications</h1><p>Everything the system sent about this boat — bookings, payment due, low stock, refunds, offers — by SMS and email.</p></div>
        <div class="acts"><a class="btn btn-o" href="owner-settings.html">Preferences</a></div>
      </div>
      <div class="filterbar"><div class="seg"><button class="seg-b on">All</button><button class="seg-b">Bookings</button><button class="seg-b">Payments</button><button class="seg-b">Stock</button><button class="seg-b">Failed</button></div></div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Event</th><th>To</th><th>Channel</th><th>When</th><th>Delivered</th></tr></thead>
        <tbody>
          <tr><td><span class="pill blue">booking</span> New cabin sold · 102</td><td class="t2">You</td><td><span class="pill mut">sms</span></td><td class="t2">18:20</td><td><span class="pill ok">✓</span></td></tr>
          <tr><td><span class="pill danger">low_stock</span> Rice below reorder</td><td class="t2">You</td><td><span class="pill mut">email</span></td><td class="t2">17:10</td><td><span class="pill ok">✓</span></td></tr>
          <tr><td><span class="pill amb">payment_due</span> Sabbir · ৳7,000</td><td class="t2">Guest</td><td><span class="pill mut">sms</span></td><td class="t2">16:40</td><td><span class="pill danger">failed</span></td></tr>
          <tr><td><span class="pill ok">refund_sent</span> Selina · ৳9,162</td><td class="t2">Guest</td><td><span class="pill mut">sms</span></td><td class="t2">yest</td><td><span class="pill ok">✓</span></td></tr>
          <tr><td><span class="pill blue">offer</span> Waitlist freed · 24 Jul</td><td class="t2">4 guests</td><td><span class="pill mut">sms</span></td><td class="t2">yest</td><td><span class="pill ok">✓</span></td></tr>
        </tbody>
      </table></div></div></div>
`},

{ key:'audit', out:'owner-audit.html', title:'Audit log', crumb:'Jol Kolol · append-only', body:`
      <div class="page-head">
        <div><h1>Audit log</h1><p>Append-only — nobody, not you nor the platform, can rewrite it. Every action carries the device clock and the authoritative server clock, so a fiddled device can reorder but never erase.</p></div>
        <div class="acts"><a class="btn btn-o" href="#">Export evidence</a></div>
      </div>
      <div class="filterbar"><div class="search"><span class="mag">🔍</span><input placeholder="Actor, action, entity…"></div><select class="select"><option>All actions</option><option>mark_paid</option><option>price_change</option><option>role_change</option></select></div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Actor</th><th>Action</th><th>Entity</th><th class="num">Device time</th><th class="num">Server time</th><th>Src</th></tr></thead>
        <tbody>
          <tr><td class="t1">You</td><td><span class="pill ok">mark_paid</span></td><td class="t2">invoice #JK-1042</td><td class="num">18:42:03</td><td class="num">18:42:07</td><td><span class="pill blue">online</span></td></tr>
          <tr><td class="t1">Nur (mgr)</td><td><span class="pill blue">cash_verified</span></td><td class="t2">invoice #JK-1042</td><td class="num">18:20:55</td><td class="num">18:20:58</td><td><span class="pill blue">online</span></td></tr>
          <tr><td class="t1">You</td><td><span class="pill amb">price_change</span></td><td class="t2">pricing_rule · Luxury AC</td><td class="num">yest 22:14</td><td class="num">yest 22:14</td><td><span class="pill blue">online</span></td></tr>
          <tr><td class="t1">Sohel</td><td><span class="pill mut">cost_entry</span></td><td class="t2">cost · ghat labour</td><td class="num">18 Jul 08:30</td><td class="num">18 Jul 14:02</td><td><span class="pill amb">offline replay</span></td></tr>
          <tr><td class="t1">You</td><td><span class="pill danger">role_change</span></td><td class="t2">member · Faruk exited</td><td class="num">May 12</td><td class="num">May 12</td><td><span class="pill blue">online</span></td></tr>
        </tbody>
      </table></div></div></div>
      <div class="note warn" style="margin-top:16px"><span class="ic">🔒</span> The offline cost above shows a 5½-hour gap between device and server time — logged truthfully, never rewritten. Bank details are stored as references, never raw.</div>
`},

{ key:'sync', out:'owner-sync.html', title:'Sync', crumb:'Jol Kolol · offline replay', body:`
      <div class="page-head">
        <div><h1>Offline sync</h1><p>Costs, stock, cash-paid and date-changes can be done offline and replayed on reconnect. Each replayed action is re-authorized against the actor's permissions <b>as of when they did it</b> — a fired manager's queued actions don't apply.</p></div>
      </div>
      <div class="note ok" style="margin-bottom:16px"><span class="ic">✓</span> Last reconnect: 7 actions synced, 1 needs your review.</div>
      <div class="card2" style="margin-bottom:20px"><div class="ch"><h3>Conflict queue</h3><span class="sub">never auto-merged</span></div>
        <div class="cb flush"><div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Conflict</th><th>Actors</th><th>Detail</th><th></th></tr></thead>
          <tbody>
            <tr><td><span class="pill danger">paid vs void</span></td><td class="t2">Nur · You</td><td>Invoice #JK-1033 — one marked paid, one marked void offline</td><td class="rowact"><button class="btn btn-sm btn-b">Resolve</button></td></tr>
          </tbody>
        </table></div></div>
      </div>
      <div class="card2"><div class="ch"><h3>Recently replayed</h3></div>
        <div class="cb flush"><div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Action</th><th>Actor</th><th>Device time</th><th>Outcome</th></tr></thead>
          <tbody>
            <tr><td>Cost · ghat labour ৳900</td><td class="t2">Sohel</td><td class="t2">18 Jul 08:30</td><td><span class="pill ok">applied</span></td></tr>
            <tr><td>Mark cash paid · #JK-1044</td><td class="t2">Nur</td><td class="t2">18 Jul 09:05</td><td><span class="pill ok">applied</span></td></tr>
            <tr><td>Stock out · rice 5kg</td><td class="t2">Ripon</td><td class="t2">18 Jul 09:10</td><td><span class="pill ok">applied</span></td></tr>
            <tr><td>Mark cash paid · #JK-1044 (dup)</td><td class="t2">You</td><td class="t2">18 Jul 09:12</td><td><span class="pill mut">idempotent — both logged</span></td></tr>
            <tr><td>Date change · #JK-1029</td><td class="t2">ex-manager</td><td class="t2">17 Jul 20:00</td><td><span class="pill danger">rejected — permission lost</span></td></tr>
          </tbody>
        </table></div></div>
      </div>
`},

{ key:'settings', out:'owner-settings.html', title:'Settings', crumb:'Jol Kolol · boat settings', body:`
      <div class="page-head">
        <div><h1>Settings</h1><p>Boat-level preferences. Billing config (commission, gateway %, monthly fee) is set by the platform — you can see it but not change it.</p></div>
      </div>
      <div class="grid-2">
        <div class="stack">
          <div class="card2"><div class="ch"><h3>Notification preferences</h3></div><div class="cb stack" style="gap:10px">
            ${toggle('New booking','SMS + email',true)}
            ${toggle('Payment due reminder','SMS to guest',true)}
            ${toggle('Low stock alert','email to you',true)}
            ${toggle('Waitlist freed','SMS to guests',true)}
            ${toggle('Weekly payout summary','email',false)}
          </div></div>
          <div class="card2"><div class="ch"><h3>Boat display</h3></div><div class="cb">
            <div class="form-grid">
              <div class="field"><label>Timezone</label><input value="UTC+6 (BST)" readonly></div>
              <div class="field"><label>Currency</label><input value="৳ BDT" readonly></div>
            </div>
          </div></div>
        </div>
        <div class="stack">
          <div class="card2"><div class="ch"><h3>Billing config</h3><span class="sub">set by platform</span></div><div class="cb">
            <dl class="kv">
              <dt>Commission</dt><dd>5% of room</dd>
              <dt>Gateway fee</dt><dd>1.8%</dd>
              <dt>Monthly fee</dt><dd>৳2,000 (after trial)</dd>
              <dt>Trial ends</dt><dd>4 Aug 2026</dd>
              <dt>Platform balance</dt><dd class="money neg">−৳3,200</dd>
            </dl>
            <div class="note info" style="margin-top:12px"><span class="ic">🔒</span> Only a platform admin changes these. Contact support to renegotiate.</div>
          </div></div>
          <div class="card2"><div class="ch"><h3>Danger zone</h3></div><div class="cb stack" style="gap:10px">
            <button class="btn btn-o">Request boat suspension</button>
            <div class="note warn" style="margin:0"><span class="ic">⚠️</span> Suspension stops new bookings. Existing trips still run.</div>
          </div></div>
        </div>
      </div>
`},

];

function toggle(label,sub,on){
  return `<div style="display:flex;align-items:center;gap:12px">
    <div style="flex:1"><div style="font-weight:700;color:var(--ink);font-size:13.5px">${label}</div><div style="font-size:12px;color:var(--muted)">${sub}</div></div>
    <span style="width:42px;height:24px;border-radius:999px;background:${on?'var(--blue)':'var(--line)'};position:relative;flex:none;display:inline-block"><span style="position:absolute;top:3px;${on?'right:3px':'left:3px'};width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3)"></span></span>
  </div>`;
}
