/* eslint-disable */
// Finance group: verify, refunds, payouts, overpayments, credits, commission,
// billing (subscriptions), billing-config, debtors.
// The four invoice queues share one table + one drawer from ./partials.js
const P = require("./partials.js");
module.exports = [

{ key:'verify', out:'admin-finance-verify.html', title:'Verify payments', crumb:'Payment queue', body:`
      <div class="page-head">
        <div><h1>Payment verification</h1><p>A deliberate human check against the gateway portal — it catches gateway bugs and fraud. Cash payments are verified by the boat manager, not here.</p></div>
      </div>
${P.invoiceFilters(['Advance Paid','Due Paid','Over Paid'])}${P.invoiceTable([
  {inv:'INV-9a11', bk:'BK-9c02', status:'Advance Paid', boat:'Meghduar',    date:'21 Jul 2026', trip:'Completed', method:'Online', amount:'1,84,000', token:'sslcz_7f…c204', primary:true},
  {inv:'INV-88f2', bk:'BK-88a1', status:'Due Paid',     boat:'Jol Kolol',   date:'20 Jul 2026', trip:'Completed', method:'Online', amount:'96,500',   token:'sslcz_2b…9a71', primary:true},
  {inv:'INV-8410', bk:'BK-8f3a', status:'Due Paid',     boat:'Jol Kolol',   date:'18 Jul 2026', trip:'Completed', method:'Online', amount:'9,162',    token:'sslcz_a0…4d12', primary:true},
  {inv:'INV-7d55', bk:'BK-7d10', status:'Advance Paid', boat:'Haor Bilash', date:'17 Jul 2026', trip:'Completed', method:'Cash',   amount:'18,340',   token:'— (cash)'},
  {inv:'INV-7c02', bk:'BK-7c00', status:'Due Paid',     boat:'Haor Bilash', date:'16 Jul 2026', trip:'Completed', method:'Online', amount:'12,700',   token:'sslcz_11…2f30', primary:true},
  {inv:'INV-6b44', bk:'BK-6b40', status:'Canceled',     boat:'Jol Kolol',   date:'14 Jul 2026', trip:'Canceled',  method:'Online', amount:'7,400',    token:'sslcz_cc…10a4'},
], 'View')}${P.invoiceDrawer(P.SAMPLE_INVOICE,
  '<button class="btn btn-o" data-drawer-close>Close</button><button class="btn btn-danger">Flag fraud</button><button class="btn btn-ok">Mark verified</button>')}`},

{ key:'refunds', out:'admin-finance-refunds.html', title:'Refunds', crumb:'Refund requested · 6-day window', body:`
      <div class="page-head">
        <div><h1>Refunds</h1><p>Invoices with <b>Refund Requested</b>. Reachable when the owner cancelled a trip, within 6 days. Three-person separation of duties: request → verify → complete must be different people.</p></div>
      </div>
${P.invoiceFilters(['Refund Requested','Refund Verified','Refunded'])}${P.invoiceTable([
  {inv:'INV-5d14', bk:'BK-5d10', status:'Refund Requested', boat:'Haor Bilash', date:'12 Jul 2026', trip:'Canceled', method:'Online', amount:'7,200',  token:'sslcz_3e…7711', primary:true},
  {inv:'INV-5c98', bk:'BK-5c90', status:'Refund Requested', boat:'Bhela',       date:'11 Jul 2026', trip:'Canceled', method:'Online', amount:'5,400',  token:'sslcz_9a…22b0', primary:true},
  {inv:'INV-5a70', bk:'BK-5a70', status:'Refund Verified',  boat:'Jol Kolol',   date:'09 Jul 2026', trip:'Canceled', method:'Online', amount:'11,000', token:'sslcz_4d…8c31'},
  {inv:'INV-5920', bk:'BK-5920', status:'Refunded',         boat:'Meghduar',    date:'06 Jul 2026', trip:'Canceled', method:'Online', amount:'3,000',  token:'sslcz_7b…04ff'},
  {inv:'INV-58f0', bk:'BK-58f0', status:'Canceled by Boat', boat:'Bhela',       date:'05 Jul 2026', trip:'Canceled', method:'Cash',   amount:'4,200',  token:'— (cash)'},
], 'Verify')}${P.invoiceDrawer(Object.assign({}, P.SAMPLE_INVOICE, {
  inv:'INV-5d14', bk:'BK-5d10', status:'Refund Requested', boat:'Haor Bilash', trip:'Canceled', date:'12 Jul 2026',
  customer:{name:'Farhana Islam', phone:'+8801700889900', email:'farhana@example.com', lead:'Farhana Islam'},
  booking:Object.assign({}, P.SAMPLE_INVOICE.booking, {route:'Nikli Haor · Kishoreganj', dates:'20 Jul 2026', duration:'1 day', notes:'Owner cancelled — weather warning.'}),
  money:Object.assign({}, P.SAMPLE_INVOICE.money, {room:'7,073', gatewayFee:'127', shown:'7,200', coupon:'', discount:'0', total:'7,200', advance:'7,200', due:'0', paid:'7,200', commission:'354', dueToBoat:'6,719'}),
  meta:Object.assign({}, P.SAMPLE_INVOICE.meta, {policy:'Moderate · blackout Eid → 0%'}),
}), '<button class="btn btn-o" data-drawer-close>Close</button><button class="btn btn-ok">Mark verified</button>')}`},

{ key:'payouts', out:'admin-finance-payouts.html', title:'Payouts', crumb:'Ready for payout', body:`
      <div class="page-head">
        <div><h1>Payouts</h1><p>Invoices with <b>Ready for Payout</b>. Verify each, then batch per boat — the preparer must not be the approver, and a boat with no bank account cannot be paid.</p></div>
        <div class="acts"><button class="btn btn-o">Batch view</button><button class="btn btn-b">+ Prepare batch</button></div>
      </div>
${P.invoiceFilters(['Ready for Payout','Payout Verified','Paid to Boat'])}${P.invoiceTable([
  {inv:'INV-8410', bk:'BK-8f3a', status:'Ready for Payout', boat:'Jol Kolol',   date:'18 Jul 2026', trip:'Completed', method:'Online', amount:'8,482',    token:'sslcz_a0…4d12', primary:true},
  {inv:'INV-88f2', bk:'BK-88a1', status:'Ready for Payout', boat:'Jol Kolol',   date:'20 Jul 2026', trip:'Completed', method:'Online', amount:'89,300',   token:'sslcz_2b…9a71', primary:true},
  {inv:'INV-7c02', bk:'BK-7c00', status:'Ready for Payout', boat:'Haor Bilash', date:'16 Jul 2026', trip:'Completed', method:'Online', amount:'11,750',   token:'sslcz_11…2f30', primary:true},
  {inv:'INV-9a11', bk:'BK-9c02', status:'Payout Verified',  boat:'Meghduar',    date:'21 Jul 2026', trip:'Completed', method:'Online', amount:'1,74,800', token:'sslcz_7f…c204'},
  {inv:'INV-6f20', bk:'BK-6f20', status:'Paid to Boat',     boat:'Haor Bilash', date:'10 Jul 2026', trip:'Completed', method:'Online', amount:'16,900',   token:'sslcz_dd…5510'},
], 'Verify')}
      <div class="note warn" style="margin-top:16px"><span class="ic">⚑</span> <b>Meghduar</b> has no bank account on file — its verified invoices cannot enter a payout batch until one is added. <b>Bhela</b>'s batch total is negative (owes the platform); settle it in <a href="admin-debtors.html" style="color:inherit;text-decoration:underline">Debtors</a>.</div>
${P.invoiceDrawer(Object.assign({}, P.SAMPLE_INVOICE, {status:'Ready for Payout', lock:true,
  meta:Object.assign({}, P.SAMPLE_INVOICE.meta, {batch:'PB-0192 · prepared by Nusrat J.'})}),
  '<button class="btn btn-o" data-drawer-close>Close</button><button class="btn btn-danger">Pull from batch</button><button class="btn btn-ok">Verify payout</button>')}`},

{ key:'overpayments', out:'admin-finance-overpayments.html', title:'Overpayments', crumb:'Over paid', body:`
      <div class="page-head">
        <div><h1>Overpayments</h1><p>Invoices with <b>Over Paid</b> — an open-seat buyout filled after payment, or a reschedule surplus. A human decides: convert to customer credit, or refund.</p></div>
      </div>
${P.invoiceFilters(['Over Paid'])}${P.invoiceTable([
  {inv:'INV-6a29', bk:'BK-6a29', status:'Over Paid', boat:'Jol Kolol',   date:'19 Jul 2026', trip:'Completed', method:'Online', amount:'5,000', token:'sslcz_5f…9021', primary:true},
  {inv:'INV-6110', bk:'BK-6110', status:'Over Paid', boat:'Haor Bilash', date:'15 Jul 2026', trip:'Completed', method:'Online', amount:'2,000', token:'sslcz_2c…7788', primary:true},
  {inv:'INV-5m20', bk:'BK-5m20', status:'Over Paid', boat:'Meghduar',    date:'08 Jul 2026', trip:'Completed', method:'Cash',   amount:'3,000', token:'— (cash)',      primary:true},
], 'Verify')}
      <div class="note info" style="margin-top:16px"><span class="ic">ℹ</span> An open-seat invoice only ever moves down. The surplus lands here first — it never becomes a negative payable to the boat.</div>
${P.invoiceDrawer(Object.assign({}, P.SAMPLE_INVOICE, {
  inv:'INV-6a29', bk:'BK-6a29', status:'Over Paid', date:'19 Jul 2026',
  customer:{name:'Imran Kabir', phone:'+8801933220011', email:'imran@example.com', lead:'Imran Kabir'},
  booking:Object.assign({}, P.SAMPLE_INVOICE.booking, {type:'Cabin booking · open seat', headcount:'1 adult (capacity 3)', notes:'Open seat later filled by another party — invoice reduced.'}),
  money:Object.assign({}, P.SAMPLE_INVOICE.money, {room:'15,000', gatewayFee:'270', shown:'15,270', coupon:'', discount:'0', total:'10,270', advance:'5,000', due:'0', paid:'15,270', overpaid:'5,000', commission:'500', dueToBoat:'9,770'}),
}), '<button class="btn btn-o" data-drawer-close>Close</button><button class="btn btn-o">Refund surplus</button><button class="btn btn-b">Convert to credit</button>')}`},

{ key:'credits', out:'admin-finance-credits.html', title:'Credits', crumb:'Customer-credit ledger', body:`
      <div class="page-head">
        <div><h1>Customer-credit ledger</h1><p>Platform liability — money owed to customers as credit toward future bookings. Fed by overpayments and reschedule advances.</p></div>
      </div>
      <div class="kpis">
        <div class="kpi"><div class="l"><span class="ic">🎫</span> Open credit</div><div class="n"><span class="u">৳</span>34,500</div><div class="d">outstanding liability</div></div>
        <div class="kpi"><div class="l"><span class="ic">✅</span> Used this month</div><div class="n"><span class="u">৳</span>18,000</div><div class="d">6 bookings</div></div>
        <div class="kpi"><div class="l"><span class="ic">⏳</span> Aging &gt; 90d</div><div class="n"><span class="u">৳</span>4,000</div><div class="d">2 credits</div></div>
      </div>
      <div class="filterbar">
        <div class="seg"><button class="seg-b on">All<span class="ct">4</span></button><button class="seg-b">Credited<span class="ct">2</span></button><button class="seg-b">Withdraw requested<span class="ct">1</span></button><button class="seg-b">Withdrawn<span class="ct">1</span></button></div>
        <div class="search" style="max-width:300px"><span class="mag">🔍</span><input placeholder="Customer, invoice id…"></div>
        <select class="select"><option>Jul</option><option>Jun</option><option>All months</option></select>
        <select class="select"><option>2026</option><option>2025</option></select>
      </div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl" style="min-width:820px">
        <thead><tr><th>Customer</th><th class="num">Amount</th><th>Source</th><th>Used in</th><th>Status</th><th class="num">Age</th><th></th></tr></thead>
        <tbody>
          <tr><td class="t1">Imran Kabir</td><td class="num">৳ 5,000</td><td class="t2">INV-6a29 · overpay</td><td class="t2">—</td><td><span class="pill blue">Credited</span></td><td class="num">3d</td><td class="rowact"><button class="btn btn-sm btn-o">View</button></td></tr>
          <tr><td class="t1">Sultana Begum</td><td class="num">৳ 2,000</td><td class="t2">INV-6110 · reschedule</td><td class="t2">—</td><td><span class="pill warn">Withdraw Requested</span></td><td class="num">9d</td><td class="rowact"><button class="btn btn-sm btn-b">Process</button></td></tr>
          <tr><td class="t1">Nadia Haque</td><td class="num">৳ 3,000</td><td class="t2">INV-5m20 · overpay</td><td class="t2">INV-7c02</td><td><span class="pill ok">Withdrawn</span></td><td class="num">—</td><td class="rowact"><button class="btn btn-sm btn-o">Receipt</button></td></tr>
          <tr><td class="t1">Rezaul Karim</td><td class="num">৳ 2,000</td><td class="t2">INV-4b90 · overpay</td><td class="t2">—</td><td><span class="pill blue">Credited</span></td><td class="num">104d</td><td class="rowact"><button class="btn btn-sm btn-o">View</button></td></tr>
        </tbody>
      </table></div></div></div>
`},

{ key:'commission', out:'admin-finance-commission.html', title:'Commission audit', crumb:'Integrity check', body:`
      <div class="page-head">
        <div><h1>Commission integrity</h1><p>Commission must equal room_total × rate — on the <b>original</b> price, never the discounted amount. This catches coupon-gaming and computation bugs.</p></div>
      </div>
      <div class="kpis">
        <div class="kpi"><div class="l"><span class="ic">৳</span> Commission earned</div><div class="n"><span class="u">৳</span>12.1L</div><div class="d up">▲ 11% vs last month</div></div>
        <div class="kpi"><div class="l"><span class="ic">📅</span> This month</div><div class="n"><span class="u">৳</span>3,12,025</div><div class="d">1,284 invoices</div></div>
        <div class="kpi"><div class="l"><span class="ic">%</span> Average rate</div><div class="n">4.9<span class="u">%</span></div><div class="d">across 28 boats</div></div>
        <div class="kpi alert"><div class="l"><span class="ic">⚠</span> Mismatches</div><div class="n">1</div><div class="d down">৳90 short · 1 boat</div></div>
      </div>
      <div class="filterbar">
        <div class="search" style="max-width:300px"><span class="mag">🔍</span><input placeholder="Invoice id or boat…"></div>
        <select class="select"><option>All checks</option><option>Mismatches only</option><option>Matches only</option></select>
        <select class="select"><option>Any date</option><option>Last 7 days</option><option>Last 30 days</option></select>
        <select class="select"><option>Jul</option><option>Jun</option><option>All months</option></select>
        <select class="select"><option>2026</option><option>2025</option></select>
      </div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Invoice</th><th>Boat</th><th class="num">Room total</th><th class="num">Rate</th><th class="num">Expected</th><th class="num">Recorded</th><th>Check</th></tr></thead>
        <tbody>
          <tr><td class="t1">INV-8410</td><td>Jol Kolol</td><td class="num">৳ 10,000</td><td class="num">5%</td><td class="num">৳ 500</td><td class="num">৳ 500</td><td><span class="pill ok">match</span></td></tr>
          <tr><td class="t1">INV-7d55</td><td>Haor Bilash</td><td class="num">৳ 20,000</td><td class="num">5%</td><td class="num">৳ 1,000</td><td class="num">৳ 1,000</td><td><span class="pill ok">match</span></td></tr>
          <tr><td class="t1">INV-80a2</td><td>Jol Kolol</td><td class="num">৳ 12,000</td><td class="num">5%</td><td class="num">৳ 600</td><td class="num neg">৳ 510</td><td><span class="pill danger">short −৳90</span></td></tr>
        </tbody>
      </table></div></div></div>
      <div class="note warn" style="margin-top:16px"><span class="ic">⚑</span> INV-80a2 recorded commission on the discounted total, not room_total — a coupon-gaming signature. Jol Kolol flagged coupon-heavy this week.</div>
`},

{ key:'billing', out:'admin-billing.html', title:'Subscriptions', crumb:'Monthly platform bills', body:`
      <div class="page-head">
        <div><h1>Subscription invoices</h1><p>The monthly bill the platform sends each boat — separate from booking commission. Billing is per boat, never combined across a multi-boat owner.</p></div>
        <div class="acts"><button class="btn btn-b">+ Issue for period</button></div>
      </div>
      <div class="filterbar">
        <div class="search" style="max-width:300px"><span class="mag">🔍</span><input placeholder="Boat or period…"></div>
        <select class="select"><option>All statuses</option><option>Issued</option><option>Paid</option><option>Overdue</option></select>
        <select class="select"><option>Jul</option><option>Jun</option><option>All months</option></select>
        <select class="select"><option>2026</option><option>2025</option></select>
      </div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Period</th><th>Boat</th><th class="num">Monthly fee</th><th class="num">Commission</th><th class="num">Amount due</th><th class="num">Balance</th><th>Status</th><th></th></tr></thead>
        <tbody>
          <tr><td class="t1">2026-07</td><td>Jol Kolol</td><td class="num">৳ 5,000</td><td class="num">৳ 2,06,000</td><td class="num">৳ 5,000</td><td class="num">৳ 0</td><td><span class="pill warn">issued</span></td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>Preview</button><button class="btn btn-sm btn-ok">Mark paid</button></td></tr>
          <tr><td class="t1">2026-07</td><td>Haor Bilash</td><td class="num">৳ 5,000</td><td class="num">৳ 1,43,200</td><td class="num">৳ 5,000</td><td class="num">৳ 8,200</td><td><span class="pill ok">paid</span></td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>Preview</button></td></tr>
          <tr><td class="t1">2026-06</td><td>Bhela</td><td class="num">৳ 5,000</td><td class="num">৳ 15,500</td><td class="num">৳ 5,000</td><td class="num neg">−৳ 12,400</td><td><span class="pill danger">overdue</span></td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>Preview</button><button class="btn btn-sm btn-o">Chase</button></td></tr>
        </tbody>
      </table></div></div></div>
${P.subscriptionDrawer({
  id:'SUB-2607-JK', boat:'Jol Kolol', owner:'Kamrul Owner', period:'July 2026', status:'issued', tone:'warn',
  monthly:'5,000', commission:'2,06,000', due:'5,000', issued:'01 Jul 2026', paid:'—',
}, '<button class="btn btn-o" data-drawer-close>Close</button><button class="btn btn-o" data-print>🖨 Print</button><button class="btn btn-ok">Mark paid</button>')}
`},

{ key:'billing-config', out:'admin-billing-config.html', title:'Billing config', crumb:'Per boat', body:`
      <div class="page-head">
        <div><h1>Billing config</h1><p>Platform-set, per boat. Commission and monthly fee can both apply. Never combine billing across a multi-boat owner.</p></div>
      </div>
      <div class="filterbar">
        <div class="search" style="max-width:340px"><span class="mag">🔍</span><input placeholder="Search a boat to configure…" value="Jol Kolol"></div>
      </div>
      <div class="grid-2">
        <div class="card2"><div class="ch"><h3>Jol Kolol — rates</h3></div><div class="cb">
          <div class="form-grid">
            <div class="field"><label>Commission %</label><input value="5.0"></div>
            <div class="field"><label>Monthly fee (৳)</label><input value="5000"></div>
            <div class="field"><label>Trial start</label><input type="date" value="2026-06-01"></div>
            <div class="field"><label>Trial end</label><input type="date" value="2026-06-30"></div>
          </div>
          <div style="margin-top:16px;display:flex;gap:10px"><button class="btn btn-b">Save config</button><span class="pill ok" style="align-self:center">write path pending in backend</span></div>
        </div></div>
        <div class="card2"><div class="ch"><h3>Effect on the bill</h3></div><div class="cb"><dl class="kv">
          <dt>Room total</dt><dd class="money">৳ 10,000</dd>
          <dt>Commission (5%)</dt><dd class="money">৳ 500</dd>
          <dt>Monthly fee</dt><dd class="money">৳ 5,000</dd>
          <dt>Platform balance</dt><dd class="money">৳ 0</dd>
        </dl>
        <div class="note info" style="margin-top:14px"><span class="ic">ℹ</span> A boat with no config silently defaults commission to 0 — this editor prevents that gap. The gateway fee is a platform-wide setting, not per boat.</div>
        </div></div>
      </div>
`},

{ key:'debtors', out:'admin-debtors.html', title:'Debtors', crumb:'Access-denial control', body:`
      <div class="page-head">
        <div><h1>Debtors &amp; access control</h1><p>Boats with a negative platform_balance owe the platform. The debt offsets the platform fee; if it exceeds the fee, access is denied until settled.</p></div>
      </div>
      <div class="filterbar">
        <div class="search" style="max-width:300px"><span class="mag">🔍</span><input placeholder="Search boat…"></div>
        <select class="select"><option>All access</option><option>Denied</option><option>Grace</option><option>Within fee</option></select>
        <select class="select"><option>Any amount</option><option>Exceeds fee</option><option>Within fee</option></select>
      </div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Boat</th><th class="num">Balance</th><th class="num">Platform fee</th><th>Debt vs fee</th><th>Access</th><th></th></tr></thead>
        <tbody>
          <tr><td class="t1">Bhela</td><td class="num neg">−৳ 12,400</td><td class="num">৳ 5,000</td><td><span class="pill danger">exceeds fee</span></td><td><span class="pill danger">denied</span></td><td class="rowact"><button class="btn btn-sm btn-ok">Restore</button></td></tr>
          <tr><td class="t1">Shonar Tori</td><td class="num neg">−৳ 3,100</td><td class="num">৳ 5,000</td><td><span class="pill warn">within fee</span></td><td><span class="pill ok">allowed</span></td><td class="rowact"><button class="btn btn-sm btn-danger">Deny</button></td></tr>
          <tr><td class="t1">Haor Bilash</td><td class="num neg">−৳ 8,200</td><td class="num">৳ 5,000</td><td><span class="pill danger">exceeds fee</span></td><td><span class="pill warn">grace</span></td><td class="rowact"><button class="btn btn-sm btn-danger">Deny</button></td></tr>
        </tbody>
      </table></div></div></div>
      <div class="note danger" style="margin-top:16px"><span class="ic">▲</span> Denying access blocks all boat operations except paying the outstanding bill. It is logged and reversible.</div>
`},

];
