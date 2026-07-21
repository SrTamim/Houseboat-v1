/* eslint-disable */
// Overview group: dashboard, analytics. (login is a standalone file, not generated)
module.exports = [

{ key:'dashboard', out:'admin-dashboard.html', title:'Dashboard', crumb:'Platform overview · week of 20 Jul 2026', body:`
      <div class="page-head">
        <div><h1>Good evening, Rafiq</h1><p>What needs a human right now across all boats.</p></div>
        <div class="acts"><a class="btn btn-o" href="admin-analytics.html">📈 Analytics</a><a class="btn btn-b" href="admin-finance-verify.html">Verification queue →</a></div>
      </div>

      <div class="kpis">
        <div class="kpi"><div class="l"><span class="ic">🚤</span> Boats pending</div><div class="n">3</div><div class="d">1 ready to approve</div></div>
        <div class="kpi alert"><div class="l"><span class="ic">✓</span> Payments to verify</div><div class="n">5</div><div class="d down">2 large · risk-sorted</div></div>
        <div class="kpi"><div class="l"><span class="ic">↩</span> Refunds in flight</div><div class="n">2</div><div class="d">1 near 6-day deadline</div></div>
        <div class="kpi"><div class="l"><span class="ic">💸</span> Payout this week</div><div class="n"><span class="u">৳</span>4,82,140</div><div class="d up">6 boats · 1 negative batch</div></div>
        <div class="kpi alert"><div class="l"><span class="ic">🩺</span> Failed jobs</div><div class="n">1</div><div class="d down">hold-sweeper last run errored</div></div>
        <div class="kpi"><div class="l"><span class="ic">🔔</span> Undelivered</div><div class="n">4</div><div class="d down">3 SMS · 1 e-ticket</div></div>
      </div>

      <div class="grid-2">
        <div class="stack">
          <div class="card2">
            <div class="ch"><h3>Action queue</h3><span class="sub">most urgent first</span></div>
            <div class="cb flush"><div class="tbl-wrap"><table class="tbl">
              <thead><tr><th>What</th><th>Boat</th><th>Detail</th><th></th></tr></thead>
              <tbody>
                <tr><td><span class="pill danger">Job failed</span></td><td class="t1">—</td><td>Hold sweeper errored 01:58, holds may be stuck</td><td class="rowact"><a class="btn btn-sm btn-o" href="admin-jobs.html">Open</a></td></tr>
                <tr><td><span class="pill warn">Verify</span></td><td class="t1">Meghduar</td><td>৳1,84,000 gateway payment · first-time boat</td><td class="rowact"><a class="btn btn-sm btn-b" href="admin-finance-verify.html">Review</a></td></tr>
                <tr><td><span class="pill blue">Approve</span></td><td class="t1">Meghduar</td><td>Profile 100% · bank account present</td><td class="rowact"><a class="btn btn-sm btn-o" href="admin-boats.html">Open</a></td></tr>
                <tr><td><span class="pill warn">Refund</span></td><td class="t1">Haor Bilash</td><td>Owner-cancelled · 1 day left to claim</td><td class="rowact"><a class="btn btn-sm btn-o" href="admin-finance-refunds.html">Open</a></td></tr>
                <tr><td><span class="pill danger">Debtor</span></td><td class="t1">Bhela</td><td>Balance −৳12,400 · access denied</td><td class="rowact"><a class="btn btn-sm btn-o" href="admin-debtors.html">Open</a></td></tr>
                <tr><td><span class="pill warn">Sync</span></td><td class="t1">Jol Kolol</td><td>paid vs void conflict · needs a human</td><td class="rowact"><a class="btn btn-sm btn-o" href="admin-sync.html">Resolve</a></td></tr>
              </tbody>
            </table></div></div>
          </div>

          <div class="card2">
            <div class="ch"><h3>Recent activity</h3><span class="sub">append-only · from audit log</span></div>
            <div class="cb flush"><div class="tbl-wrap"><table class="tbl">
              <thead><tr><th>Actor</th><th>Action</th><th>Entity</th><th class="num">Server time</th></tr></thead>
              <tbody>
                <tr><td class="t1">Nusrat J.</td><td><span class="pill ok">payment_verified</span></td><td>invoice · Jol Kolol</td><td class="num">18:41:07</td></tr>
                <tr><td class="t1">Rafiq A.</td><td><span class="pill blue">payout_approved</span></td><td>batch · Haor Bilash</td><td class="num">18:22:55</td></tr>
                <tr><td class="t1">system</td><td><span class="pill mut">departure→completed</span></td><td>3 departures</td><td class="num">18:00:12</td></tr>
                <tr><td class="t1">Owner (Jol Kolol)</td><td><span class="pill amb">price_change</span></td><td>pricing_rule</td><td class="num">17:35:40</td></tr>
                <tr><td class="t1">Nusrat J.</td><td><span class="pill danger">refund_completed</span></td><td>invoice · Bhela</td><td class="num">16:50:19</td></tr>
              </tbody>
            </table></div></div>
          </div>
        </div>

        <div class="stack">
          <div class="card2">
            <div class="ch"><h3>This week</h3></div>
            <div class="cb">
              <dl class="kv">
                <dt>Bookings</dt><dd>1,284</dd>
                <dt>GMV</dt><dd class="money">৳ 62,40,500</dd>
                <dt>Commission</dt><dd class="money">৳ 3,12,025</dd>
                <dt>Gateway fees</dt><dd class="money">৳ 1,12,329</dd>
                <dt>Live boats</dt><dd>28</dd>
                <dt>Departures today</dt><dd>17</dd>
              </dl>
            </div>
          </div>
          <div class="card2">
            <div class="ch"><h3>System health</h3><a class="sub" href="admin-jobs.html" style="color:var(--blue)">Details →</a></div>
            <div class="cb stack" style="gap:12px">
              <div class="note danger"><span class="ic">✕</span> Hold sweeper — last run errored 01:58 UTC</div>
              <div class="note ok"><span class="ic">✓</span> Departure status — ran 12:55, 4 advanced</div>
              <div class="note ok"><span class="ic">✓</span> Subscription overdue — ran 01:00, 1 flagged</div>
              <div class="note info"><span class="ic">ℹ</span> Gateway: <b>SANDBOX</b> · SMS provider live · SMTP live</div>
            </div>
          </div>
        </div>
      </div>
`},

{ key:'analytics', out:'admin-analytics.html', title:'Analytics', crumb:'Platform revenue · Jul 2026', body:`
      <div class="page-head">
        <div><h1>Platform analytics</h1><p>Revenue, receivables and the risk signals that feed the verification queue. Read-only — no per-boat data leaves this view without an authorization re-check.</p></div>
        <div class="acts"><select class="select"><option>This month</option><option>Last 30 days</option><option>This quarter</option><option>Year to date</option></select><button class="btn btn-o">⤓ Export CSV</button></div>
      </div>

      <div class="kpis">
        <div class="kpi"><div class="l"><span class="ic">৳</span> GMV</div><div class="n"><span class="u">৳</span>2.41Cr</div><div class="d up">▲ 14% vs last month</div></div>
        <div class="kpi"><div class="l"><span class="ic">%</span> Commission rev</div><div class="n"><span class="u">৳</span>12.1L</div><div class="d up">▲ 11%</div></div>
        <div class="kpi"><div class="l"><span class="ic">🧾</span> Subscription rev</div><div class="n"><span class="u">৳</span>2.8L</div><div class="d up">▲ 4 boats</div></div>
        <div class="kpi alert"><div class="l"><span class="ic">🔻</span> Receivables</div><div class="n"><span class="u">৳</span>41,900</div><div class="d down">3 debtor boats</div></div>
        <div class="kpi"><div class="l"><span class="ic">💸</span> Payout volume</div><div class="n"><span class="u">৳</span>19.3L</div><div class="d">wk avg</div></div>
        <div class="kpi"><div class="l"><span class="ic">🚤</span> Active boats</div><div class="n">28</div><div class="d up">▲ 2 approved</div></div>
      </div>

      <div class="grid-2">
        <div class="card2">
          <div class="ch"><h3>Revenue by boat</h3><span class="sub">commission + subscription, this month</span></div>
          <div class="cb flush"><div class="tbl-wrap"><table class="tbl">
            <thead><tr><th>Boat</th><th>Route</th><th class="num">Bookings</th><th class="num">GMV</th><th class="num">Commission</th><th>Standing</th></tr></thead>
            <tbody>
              <tr><td class="t1">Jol Kolol</td><td class="t2">Tanguar Haor</td><td class="num">412</td><td class="num">৳ 41,20,000</td><td class="num">৳ 2,06,000</td><td><span class="pill ok">settled</span></td></tr>
              <tr><td class="t1">Haor Bilash</td><td class="t2">Nikli Haor</td><td class="num">308</td><td class="num">৳ 28,64,000</td><td class="num">৳ 1,43,200</td><td><span class="pill warn">−৳8,200</span></td></tr>
              <tr><td class="t1">Meghduar</td><td class="t2">Tanguar Haor</td><td class="num">96</td><td class="num">৳ 9,84,000</td><td class="num">৳ 49,200</td><td><span class="pill blue">new</span></td></tr>
              <tr><td class="t1">Bhela</td><td class="t2">Nikli Haor</td><td class="num">44</td><td class="num">৳ 3,10,000</td><td class="num">৳ 15,500</td><td><span class="pill danger">−৳12,400</span></td></tr>
            </tbody>
          </table></div></div>
        </div>
        <div class="card2">
          <div class="ch"><h3>Risk signals</h3><span class="sub">feed the verify queue</span></div>
          <div class="cb stack" style="gap:12px">
            <div class="note warn"><span class="ic">⚑</span> <b>Meghduar</b> — first-time boat, first payout pending. Float large payments to top.</div>
            <div class="note warn"><span class="ic">⚑</span> <b>Jol Kolol</b> — coupon usage 3× median this week. Commission-gaming check advised.</div>
            <div class="note info"><span class="ic">ℹ</span> Largest single unverified payment: <b class="money">৳ 1,84,000</b> (Meghduar).</div>
            <div class="note danger"><span class="ic">▲</span> <b>Bhela</b> — negative balance exceeds platform fee → access denied.</div>
          </div>
        </div>
      </div>
`},

];
