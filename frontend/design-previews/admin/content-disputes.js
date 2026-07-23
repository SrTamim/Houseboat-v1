/* eslint-disable */
// Disputes & risk group: disputes, idor (security), coupons, reschedules, cutoff
module.exports = [

{ key:'disputes', out:'admin-disputes.html', title:'Disputes', crumb:'Resolution workspace', body:`
      <div class="page-head">
        <div><h1>Dispute resolution</h1><p>Disputes cite what was agreed that day — the frozen policy snapshot on the invoice, not the boat's current policy. The full reschedule chain and audit trail sit beside it.</p></div>
      </div>
      <div class="filterbar"><div class="seg"><button class="seg-b on">Open<span class="ct">2</span></button><button class="seg-b">Resolved<span class="ct">11</span></button></div></div>
      <div class="grid-2">
        <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Case</th><th>Invoice</th><th>Type</th><th></th></tr></thead>
          <tbody>
            <tr><td class="t1">DP-104</td><td class="t2">INV-5d14 · Bhela</td><td><span class="pill warn">refund %</span></td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>Open</button></td></tr>
            <tr><td class="t1">DP-103</td><td class="t2">INV-4b02 · Haor Bilash</td><td><span class="pill warn">reschedule price</span></td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>Open</button></td></tr>
          </tbody>
        </table></div></div></div>
        <div class="card2"><div class="ch"><h3>DP-104 · snapshot vs live</h3></div><div class="cb stack" style="gap:14px">
          <div class="note info"><span class="ic">🧾</span> Cite the snapshot, not the current policy.</div>
          <dl class="kv">
            <dt>Agreed (snapshot)</dt><dd>Moderate · 50% if &gt;7d</dd>
            <dt>Live policy now</dt><dd>Strict · 0% if &lt;14d</dd>
            <dt>Blackout that day</dt><dd><span class="pill danger">Eid → 0%</span></dd>
            <dt>Amount paid</dt><dd class="money">৳ 7,200</dd>
          </dl>
          <div class="note warn"><span class="ic">⚑</span> Blackout overrides the template — refund is 0% regardless of "Moderate".</div>
          <a href="admin-audit.html" style="color:var(--blue);font-weight:700;font-size:13px">View audit trail →</a>
        </div></div>
      </div>
      <div class="drawer-sc" id="drawerScrim"></div>
      <aside class="drawer" id="drawer"><div class="dh"><h3>Dispute case</h3><button class="x" data-drawer-close>✕</button></div><div class="db"><p class="muted">Full case — policy snapshot, reschedule chain, audit trail, audited bank-detail reveal.</p></div><div class="df"><button class="btn btn-o" data-drawer-close>Close</button><button class="btn btn-b">Record resolution</button></div></aside>
`},

{ key:'idor', out:'admin-idor.html', title:'Security', crumb:'Authorization monitor', body:`
      <div class="page-head">
        <div><h1>Security posture</h1><p>Every object fetch re-checks authorization — the role map alone is not enough. IDs are non-enumerable UUIDv7. Denied attempts and separation-of-duties violations land here.</p></div>
      </div>
      <div class="kpis">
        <div class="kpi"><div class="l"><span class="ic">🛡</span> Auth denials (24h)</div><div class="n">23</div><div class="d">cross-boat access blocked</div></div>
        <div class="kpi alert"><div class="l"><span class="ic">⚖</span> SoD violations</div><div class="n">2</div><div class="d down">same-person money chain</div></div>
        <div class="kpi"><div class="l"><span class="ic">🚦</span> Rate-limit hits</div><div class="n">140</div><div class="d">hold spikes absorbed</div></div>
      </div>
      <div class="card2"><div class="ch"><h3>Blocked attempts</h3></div><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Actor</th><th>Attempt</th><th>Reason</th><th class="num">At</th></tr></thead>
        <tbody>
          <tr><td class="t1">Manager (Haor Bilash)</td><td class="t2">GET invoice · Jol Kolol</td><td><span class="pill danger">IDOR · cross-boat</span></td><td class="num">14:31</td></tr>
          <tr><td class="t1">Nusrat J.</td><td class="t2">approve own prepared batch</td><td><span class="pill danger">SoD · preparer=approver</span></td><td class="num">12:08</td></tr>
          <tr><td class="t1">Ex-manager (Bhela)</td><td class="t2">mark_paid (replay)</td><td><span class="pill danger">permission lost</span></td><td class="num">14:05</td></tr>
          <tr><td class="t1">anon</td><td class="t2">42 hold attempts / cabin</td><td><span class="pill warn">rate-limited</span></td><td class="num">11:50</td></tr>
        </tbody>
      </table></div></div></div>
`},

{ key:'coupons', out:'admin-coupons.html', title:'Coupons', crumb:'Referral abuse', body:`
      <div class="page-head">
        <div><h1>Coupons &amp; referrals</h1><p>The boat absorbs its own coupon — commission is unaffected. Watch referral coupons and free-text reference names for self-referral and anomaly patterns.</p></div>
      </div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Code</th><th>Boat</th><th>Kind</th><th class="num">Uses</th><th>Reference pattern</th><th>Flag</th></tr></thead>
        <tbody>
          <tr><td class="t1">EID10</td><td>Jol Kolol</td><td><span class="tag">percent</span></td><td class="num">142</td><td class="t2">varied</td><td><span class="pill ok">normal</span></td></tr>
          <tr><td class="t1">FRIEND</td><td>Jol Kolol</td><td><span class="tag">referral</span></td><td class="num">61</td><td class="t2">28× same name "Rakib"</td><td><span class="pill danger">self-referral?</span></td></tr>
          <tr><td class="t1">MONSOON</td><td>Haor Bilash</td><td><span class="tag">flat</span></td><td class="num">34</td><td class="t2">varied</td><td><span class="pill ok">normal</span></td></tr>
          <tr><td class="t1">WELCOME</td><td>Meghduar</td><td><span class="tag">referral</span></td><td class="num">9</td><td class="t2">varied</td><td><span class="pill ok">normal</span></td></tr>
        </tbody>
      </table></div></div></div>
      <div class="note info" style="margin-top:16px"><span class="ic">ℹ</span> Coupons never reduce platform commission — this view is fraud oversight, not a cost to the platform.</div>
`},

{ key:'reschedules', out:'admin-reschedules.html', title:'Reschedules', crumb:'Repricing trail', body:`
      <div class="page-head">
        <div><h1>Reschedule oversight</h1><p>Rescheduling reprices at the new date; the advance carries over as credit and the previous trip stays on record. Moving to an Eid date costs Eid prices.</p></div>
      </div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Booking</th><th>From → to</th><th class="num">Old price</th><th class="num">New price</th><th>Change</th><th>By</th></tr></thead>
        <tbody>
          <tr><td class="t1">#BK-4b02</td><td class="t2">12 Jul → 19 Jul</td><td class="num">৳ 18,340</td><td class="num">৳ 18,340</td><td><span class="pill mut">no change</span></td><td class="t2">Owner</td></tr>
          <tr><td class="t1">#BK-3a90</td><td class="t2">14 Jul → 17 Jul (Eid)</td><td class="num">৳ 10,180</td><td class="num">৳ 15,200</td><td><span class="pill warn">repriced up</span></td><td class="t2">Owner</td></tr>
          <tr><td class="t1">#BK-2f70</td><td class="t2">10 Jul → 24 Jul</td><td class="num">৳ 22,000</td><td class="num">৳ 20,600</td><td><span class="pill ok">repriced down</span></td><td class="t2">Platform</td></tr>
        </tbody>
      </table></div></div></div>
      <div class="note warn" style="margin-top:16px"><span class="ic">⚑</span> #BK-3a90 repriced up for Eid — the advance is credit, not a locked price. Difference is due at checkout.</div>
`},

{ key:'cutoff', out:'admin-cutoff.html', title:'Cutoff', crumb:'Finalize monitor', body:`
      <div class="page-head">
        <div><h1>Cutoff &amp; finalize</h1><p>When departure time arrives, holds stop; one minute later the invoice freezes and finalizes. Watch for departures stuck past cutoff, unfilled buyouts, and stale quotes.</p></div>
      </div>
      <div class="kpis">
        <div class="kpi alert"><div class="l"><span class="ic">⏹</span> Pending finalize</div><div class="n">2</div><div class="d down">past cutoff +1min</div></div>
        <div class="kpi"><div class="l"><span class="ic">🔀</span> Stuck transitions</div><div class="n">0</div><div class="d">time passed, status ok</div></div>
        <div class="kpi"><div class="l"><span class="ic">💬</span> Stale quotes</div><div class="n">2</div><div class="d">24h / date-filled</div></div>
      </div>
      <div class="card2"><div class="ch"><h3>Departures at cutoff</h3></div><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Departure</th><th>Cutoff</th><th>Open seats</th><th>State</th><th></th></tr></thead>
        <tbody>
          <tr><td><div class="t1">Jol Kolol · 21 Jul</div><div class="t2">2d1n</div></td><td class="t2">18:00</td><td class="t2">1 unfilled buyout</td><td><span class="pill warn">awaiting finalize</span></td><td class="rowact"><button class="btn btn-sm btn-b">Finalize now</button></td></tr>
          <tr><td><div class="t1">Haor Bilash · 21 Jul</div><div class="t2">1d</div></td><td class="t2">17:30</td><td class="t2">0</td><td><span class="pill warn">awaiting finalize</span></td><td class="rowact"><button class="btn btn-sm btn-b">Finalize now</button></td></tr>
          <tr><td><div class="t1">Meghduar · 20 Jul</div><div class="t2">2d1n</div></td><td class="t2">18:00</td><td class="t2">—</td><td><span class="pill ok">finalized</span></td><td></td></tr>
        </tbody>
      </table></div></div></div>
      <div class="note info" style="margin-top:16px"><span class="ic">ℹ</span> Unfilled buyout stands — nothing is refunded because the full amount was never charged. Whatever the invoice reads at finalize is final.</div>
`},

];
