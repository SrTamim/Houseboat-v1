/* eslint-disable */
// Disputes & risk group: disputes, idor (security), coupons, reschedules, cutoff
const P = require("./partials.js");
module.exports = [

{ key:'disputes', out:'admin-disputes.html', title:'Disputes', crumb:'Reported invoices', body:`
      <div class="page-head">
        <div><h1>Reported invoices</h1><p>Invoices flagged by a customer or a boat owner, with their note. <b>View</b> opens the full invoice; <b>Edit</b> lets you correct any invoice field to resolve the dispute — every edit is logged.</p></div>
      </div>
      <div class="filterbar">
        <div class="seg"><button class="seg-b on">Open<span class="ct">3</span></button><button class="seg-b">Resolved<span class="ct">11</span></button></div>
        <div class="search" style="max-width:300px"><span class="mag">🔍</span><input placeholder="Invoice, booking, boat…"></div>
        <select class="select"><option>Any reporter</option><option>Customer</option><option>Boat owner</option></select>
      </div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl" style="min-width:960px">
        <thead><tr><th>Invoice ID</th><th>Booking ID</th><th>Reported by</th><th>Boat</th><th>Reason note</th><th>Date</th><th>Status</th><th></th></tr></thead>
        <tbody>
          <tr><td class="t1">INV-5d14</td><td class="t2">BK-5d10</td><td><span class="pill amb">Customer</span></td><td>Bhela</td><td class="t2">"Charged full price but trip was cancelled by the boat."</td><td class="t2">12 Jul</td><td><span class="pill warn">open</span></td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>View</button><button class="btn btn-sm btn-b" data-edit>Edit</button></td></tr>
          <tr><td class="t1">INV-4b02</td><td class="t2">BK-4b02</td><td><span class="pill blue">Boat owner</span></td><td>Haor Bilash</td><td class="t2">"Reschedule repriced wrong — customer moved to a cheaper date."</td><td class="t2">11 Jul</td><td><span class="pill warn">open</span></td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>View</button><button class="btn btn-sm btn-b" data-edit>Edit</button></td></tr>
          <tr><td class="t1">INV-6a29</td><td class="t2">BK-6a29</td><td><span class="pill amb">Customer</span></td><td>Jol Kolol</td><td class="t2">"Paid extra for an open seat that was later filled — want the surplus back."</td><td class="t2">19 Jul</td><td><span class="pill warn">open</span></td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>View</button><button class="btn btn-sm btn-b" data-edit>Edit</button></td></tr>
          <tr><td class="t1">INV-3f80</td><td class="t2">BK-3f80</td><td><span class="pill blue">Boat owner</span></td><td>Meghduar</td><td class="t2">"Commission looks too high on this invoice."</td><td class="t2">04 Jul</td><td><span class="pill ok">resolved</span></td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>View</button></td></tr>
        </tbody>
      </table></div></div></div>
${P.invoiceDrawer(Object.assign({}, P.SAMPLE_INVOICE, {
  inv:'INV-5d14', bk:'BK-5d10', status:'Canceled by Boat', boat:'Bhela', trip:'Canceled', date:'12 Jul 2026',
  customer:{name:'Farhana Islam', phone:'+8801700889900', email:'farhana@example.com', lead:'Farhana Islam'},
  booking:Object.assign({}, P.SAMPLE_INVOICE.booking, {route:'Nikli Haor · Kishoreganj', dates:'20 Jul 2026', duration:'1 day', notes:'Owner cancelled — weather. Customer reported full charge.'}),
  money:Object.assign({}, P.SAMPLE_INVOICE.money, {room:'7,073', gatewayFee:'127', shown:'7,200', coupon:'', discount:'0', total:'7,200', advance:'7,200', due:'0', paid:'7,200', commission:'354', dueToBoat:'6,719'}),
  meta:Object.assign({}, P.SAMPLE_INVOICE.meta, {policy:'Moderate · blackout Eid → 0%'}),
}), '<button class="btn btn-o" data-drawer-close>Close</button><button class="btn btn-b" data-edit>Edit invoice</button>')}
${P.invoiceEditDrawer(Object.assign({}, P.SAMPLE_INVOICE, {
  inv:'INV-5d14', bk:'BK-5d10', status:'Canceled by Boat', boat:'Bhela', trip:'Canceled', method:'Online',
  customer:{name:'Farhana Islam', phone:'+8801700889900', email:'farhana@example.com', lead:'Farhana Islam'},
  booking:Object.assign({}, P.SAMPLE_INVOICE.booking, {route:'Nikli Haor · Kishoreganj', dates:'20 Jul 2026', headcount:'2 adults', reference:'—'}),
  money:Object.assign({}, P.SAMPLE_INVOICE.money, {room:'7,073', gatewayFee:'127', discount:'0', total:'7,200', advance:'7,200', due:'0', paid:'7,200', overpaid:'0', commission:'354', dueToBoat:'6,719'}),
}), '<button class="btn btn-o" data-edit-close>Cancel</button><button class="btn btn-danger">Mark resolved</button><button class="btn btn-b">Save changes</button>')}
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
        <div><h1>Coupons &amp; referrals</h1><p>Create coupon codes and watch usage. The boat absorbs its own coupon — commission is unaffected. Referral coupons and free-text reference names are checked for self-referral patterns.</p></div>
      </div>
      <div class="card2"><div class="ch"><h3>Create coupon</h3></div><div class="cb">
        <div class="form-grid">
          <div class="field"><label>Code</label><input placeholder="e.g. MONSOON25"></div>
          <div class="field"><label>Boat</label><input placeholder="Search boat…"></div>
          <div class="field"><label>Kind</label><select><option>Percent</option><option>Flat</option><option>Referral</option></select></div>
          <div class="field"><label>Value</label><input placeholder="e.g. 10% or ৳500"></div>
          <div class="field"><label>Valid from</label><input type="date" value="2026-07-01"></div>
          <div class="field"><label>Valid to</label><input type="date" value="2026-07-31"></div>
        </div>
        <div style="margin-top:16px"><button class="btn btn-b">+ Create coupon</button></div>
      </div></div>
      <div class="filterbar" style="margin-top:20px">
        <div class="search" style="max-width:300px"><span class="mag">🔍</span><input placeholder="Code or boat…"></div>
        <select class="select"><option>All kinds</option><option>Percent</option><option>Flat</option><option>Referral</option></select>
        <select class="select"><option>Any date</option><option>Active now</option><option>Expired</option></select>
        <select class="select"><option>Jul</option><option>Jun</option><option>All months</option></select>
        <select class="select"><option>2026</option><option>2025</option></select>
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
