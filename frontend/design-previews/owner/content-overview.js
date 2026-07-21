/* eslint-disable */
// Overview group: dashboard, calendar. (login is a standalone file, not generated)
module.exports = [

{ key:'dashboard', out:'owner-dashboard.html', title:'Dashboard', crumb:'Jol Kolol · today, Tue 21 Jul 2026', body:`
      <div class="page-head">
        <div><h1>Good evening, Kamal</h1><p>What Jol Kolol needs from you right now — before the next departure leaves the ghat.</p></div>
        <div class="acts"><a class="btn btn-o" href="owner-costs.html">＋ Log a cost</a><a class="btn btn-b" href="owner-pos.html">🧾 Counter sale →</a></div>
      </div>

      <div class="kpis">
        <div class="kpi"><div class="l"><span class="ic">⛴️</span> Departing today</div><div class="n">2</div><div class="d">14 of 16 cabins sold</div></div>
        <div class="kpi alert"><div class="l"><span class="ic">💵</span> Cash to verify</div><div class="n">2</div><div class="d down">৳12,000 taken at counter</div></div>
        <div class="kpi"><div class="l"><span class="ic">💸</span> Payout this week</div><div class="n"><span class="u">৳</span>84,820</div><div class="d up">6 invoices cleared</div></div>
        <div class="kpi alert"><div class="l"><span class="ic">💰</span> Crew unpaid</div><div class="n">3</div><div class="d down">Jul wages pending</div></div>
        <div class="kpi alert"><div class="l"><span class="ic">📦</span> Low stock</div><div class="n">2</div><div class="d down">rice · gas below reorder</div></div>
        <div class="kpi"><div class="l"><span class="ic">💬</span> Quotes waiting</div><div class="n">3</div><div class="d">1 expires in 4h</div></div>
      </div>

      <div class="grid-2">
        <div class="stack">
          <div class="card2">
            <div class="ch"><h3>Needs you now</h3><span class="sub">most urgent first</span></div>
            <div class="cb flush"><div class="tbl-wrap"><table class="tbl">
              <thead><tr><th>What</th><th>Detail</th><th></th></tr></thead>
              <tbody>
                <tr><td><span class="pill warn">Verify cash</span></td><td>Farhana Akter · ৳7,000 · Cabin 102</td><td class="rowact"><a class="btn btn-sm btn-b" href="owner-payments.html">Verify</a></td></tr>
                <tr><td><span class="pill danger">Billing</span></td><td>Platform balance −৳3,200 · settle before 25 Jul</td><td class="rowact"><a class="btn btn-sm btn-o" href="owner-billing.html">Open</a></td></tr>
                <tr><td><span class="pill danger">Low stock</span></td><td>Rice 8kg (reorder 15) · Gas 1 cyl (reorder 2)</td><td class="rowact"><a class="btn btn-sm btn-o" href="owner-inventory.html">Open</a></td></tr>
                <tr><td><span class="pill warn">Refund</span></td><td>Owner-cancelled trip · 1 day left in claim window</td><td class="rowact"><a class="btn btn-sm btn-o" href="owner-refunds.html">Open</a></td></tr>
                <tr><td><span class="pill blue">Quote</span></td><td>Group of 18 · 2 Aug · expires 22:00</td><td class="rowact"><a class="btn btn-sm btn-o" href="owner-quotes.html">Price it</a></td></tr>
                <tr><td><span class="pill warn">Sync</span></td><td>Offline paid-vs-void conflict · needs your call</td><td class="rowact"><a class="btn btn-sm btn-o" href="owner-sync.html">Resolve</a></td></tr>
              </tbody>
            </table></div></div>
          </div>

          <div class="card2">
            <div class="ch"><h3>Today's departures</h3><span class="sub">status is time-driven</span></div>
            <div class="cb flush"><div class="tbl-wrap"><table class="tbl">
              <thead><tr><th>Trip</th><th>Depart</th><th>Cabins</th><th>Crew</th><th>Status</th></tr></thead>
              <tbody>
                <tr><td><div class="t1">Tanguar Haor · 2D1N</div><div class="t2">Tahirpur ghat</div></td><td class="t2">07:30</td><td><b class="money">8 / 8</b></td><td><span class="pill ok">6 present</span></td><td><span class="pill blue">in progress</span></td></tr>
                <tr><td><div class="t1">Tanguar Haor · Day trip</div><div class="t2">Tahirpur ghat</div></td><td class="t2">09:00</td><td><b class="money">6 / 8</b><span class="t2"> · 2 spare</span></td><td><span class="pill ok">5 present</span></td><td><span class="pill warn">boarding</span></td></tr>
              </tbody>
            </table></div></div>
          </div>
        </div>

        <div class="stack">
          <div class="card2">
            <div class="ch"><h3>This week</h3></div>
            <div class="cb">
              <dl class="kv">
                <dt>Bookings</dt><dd>27</dd>
                <dt>Room revenue</dt><dd class="money">৳ 2,64,000</dd>
                <dt>Commission paid</dt><dd class="money">৳ 13,200</dd>
                <dt>Costs logged</dt><dd class="money">৳ 41,900</dd>
                <dt>Net (est.)</dt><dd class="money">৳ 2,08,900</dd>
              </dl>
              <div class="note info" style="margin-top:14px"><span class="ic">ℹ️</span> Cash never touches the platform, so it isn't in the weekly payout — verify it at the counter and it lands in your reports.</div>
            </div>
          </div>

          <div class="card2">
            <div class="ch"><h3>Recent activity</h3><span class="sub">from audit log</span></div>
            <div class="cb flush"><div class="tbl-wrap"><table class="tbl" style="min-width:0">
              <tbody>
                <tr><td class="t1">You</td><td><span class="pill ok">mark_paid</span></td><td class="num">18:42</td></tr>
                <tr><td class="t1">Nur (mgr)</td><td><span class="pill blue">cash_verified</span></td><td class="num">18:20</td></tr>
                <tr><td class="t1">system</td><td><span class="pill mut">departure→in_progress</span></td><td class="num">07:30</td></tr>
                <tr><td class="t1">You</td><td><span class="pill amb">price_change</span></td><td class="num">yest</td></tr>
              </tbody>
            </table></div></div>
          </div>

          <div class="card2">
            <div class="ch"><h3>Go-live health</h3></div>
            <div class="cb stack" style="gap:10px">
              <div class="note ok"><span class="ic">✓</span> Profile 100% · bank account on file · approved.</div>
              <div class="note warn"><span class="ic">⚠️</span> Trial ends 4 Aug — first monthly bill previews at ৳2,000 + commission.</div>
            </div>
          </div>
        </div>
      </div>
`},

{ key:'calendar', out:'owner-calendar.html', title:'Calendar', crumb:'Jol Kolol · July 2026', body:`
      <div class="page-head">
        <div><h1>Trip calendar</h1><p>Only dates in your <b>operating dates</b> generate bookable departures. Everything else is invisible to customers. Status is time-driven — no manual flipping.</p></div>
        <div class="acts"><a class="btn btn-o" href="owner-schedule.html">Schedule editor</a><a class="btn btn-b" href="owner-profile.html">Edit operating dates</a></div>
      </div>
      <div class="filterbar">
        <div class="seg"><button class="seg-b on">July</button><button class="seg-b">August</button><button class="seg-b">September</button></div>
        <span class="tag">● scheduled</span><span class="tag">● in progress</span><span class="tag">● completed</span><span class="tag">● cancelled</span>
      </div>
      <div class="card2"><div class="cb">
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:8px">
          <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px">
          ${calDays()}
        </div>
      </div></div>
`},

];

function calDays(){
  // July 2026: 1st is a Wed. Build 5 weeks; mark operating dates with departures.
  const meta = {
    3:[['Fri','2D1N','8/8','ok']], 4:[['Sat','Day','6/8','ok']],
    10:[['Fri','2D1N','7/8','ok']], 11:[['Sat','Day','8/8','ok']],
    17:[['Fri','2D1N','5/8','warn']], 18:[['Sat','Day','8/8','ok']],
    19:[['Sun','Day','—','mut']],
    21:[['Tue','2D1N','8/8','ok'],['Tue','Day','6/8','warn']],
    24:[['Fri','2D1N','3/8','warn']], 25:[['Sat','Day','2/8','danger']],
    31:[['Fri','2D1N','0/8','mut']],
  };
  const firstDow = 3; // Wed
  const days = 31;
  let cells = '';
  for (let i=0;i<firstDow;i++) cells += `<div style="min-height:92px"></div>`;
  for (let d=1; d<=days; d++){
    const trips = meta[d];
    const today = d===21;
    const border = today ? 'border:2px solid var(--blue)' : 'border:1px solid var(--line)';
    let inner = `<div style="font-weight:800;color:${today?'var(--blue)':'var(--ink)'};font-size:13px">${d}${today?' · today':''}</div>`;
    if (trips){
      for (const [dow,label,cab,tone] of trips){
        inner += `<div style="margin-top:5px;font-size:10.5px;font-weight:700;padding:2px 6px;border-radius:5px;background:var(--${tone==='ok'?'ok-050':tone==='warn'?'warn-050':tone==='danger'?'danger-050':'chip'});color:var(--${tone==='mut'?'muted':tone})">${label} · ${cab}</div>`;
      }
    } else {
      inner += `<div style="margin-top:5px;font-size:10px;color:var(--muted)">not operating</div>`;
    }
    cells += `<div style="min-height:92px;${border};border-radius:10px;padding:8px;background:${trips?'var(--surface)':'var(--bg-2)'}">${inner}</div>`;
  }
  return cells;
}
