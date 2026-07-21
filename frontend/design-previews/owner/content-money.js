/* eslint-disable */
// Money group: invoices, payments, refunds, payouts, earnings, billing
module.exports = [

{ key:'invoices', out:'owner-invoices.html', title:'Invoices', crumb:'Jol Kolol · one per booking', body:`
      <div class="page-head">
        <div><h1>Invoices</h1><p>One invoice per booking. Follow the state machine — <b>customer_due → paid → payment_verified → in_payout → bill_cleared</b>. Once in a payout batch it locks, so no refund can double-spend.</p></div>
        <div class="acts"><div class="search"><span class="mag">🔍</span><input placeholder="Invoice, guest, cabin…"></div></div>
      </div>
      <div class="filterbar">
        <div class="seg"><button class="seg-b on">All<span class="ct">142</span></button><button class="seg-b">Due<span class="ct">8</span></button><button class="seg-b">Paid<span class="ct">5</span></button><button class="seg-b">Verified<span class="ct">6</span></button><button class="seg-b">In payout<span class="ct">🔒 4</span></button><button class="seg-b">Cleared<span class="ct">115</span></button></div>
      </div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Invoice</th><th>Guest</th><th class="num">Room</th><th class="num">Pays</th><th class="num">You get</th><th>Status</th><th></th></tr></thead>
        <tbody>
          <tr><td class="t1">#JK-1042</td><td>Farhana Akter</td><td class="num">৳10,000</td><td class="num">৳9,162</td><td class="num">৳8,482</td><td><span class="pill warn">paid · cash</span></td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>View</button></td></tr>
          <tr><td class="t1">#JK-1041</td><td>Rakib Hasan</td><td class="num">৳24,000</td><td class="num">৳24,360</td><td class="num">৳23,160</td><td><span class="pill ok">verified</span></td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>View</button></td></tr>
          <tr><td class="t1">#JK-1038</td><td>Tanzila Group</td><td class="num">৳1,50,000</td><td class="num">৳1,52,700</td><td class="num">৳1,45,200</td><td><span class="pill lock">in payout</span></td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>View</button></td></tr>
          <tr><td class="t1">#JK-1035</td><td>Sabbir Ahmed</td><td class="num">৳10,000</td><td class="num">৳3,054<span class="t2"> adv</span></td><td class="num">৳2,554</td><td><span class="pill amb">due ৳7,000</span></td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>View</button></td></tr>
          <tr><td class="t1">#JK-1030</td><td>Imran Khan</td><td class="num">৳10,000</td><td class="num">৳9,162</td><td class="num">৳8,482</td><td><span class="pill danger">cancelled</span></td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>View</button></td></tr>
          <tr><td class="t1">#JK-1012</td><td>Nadia Islam</td><td class="num">৳13,740</td><td class="num">৳13,987</td><td class="num">৳13,300</td><td><span class="pill mut">cleared</span></td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>View</button></td></tr>
        </tbody>
      </table></div></div></div>

      <div class="drawer-sc" id="drawerScrim"></div>
      <aside class="drawer" id="drawer">
        <div class="dh"><h3>Invoice #JK-1042</h3><button class="x" data-drawer-close>✕</button></div>
        <div class="db stack" style="gap:16px">
          <span class="pill warn">paid · cash · unverified</span>
          <div>
            <h4 style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:10px">Bill breakdown</h4>
            <div class="bill">
              <div class="row"><span class="lbl">Room total<span class="s">2 people · Family cabin</span></span><span class="val">৳10,000</span></div>
              <div class="row sub"><span class="lbl">+ Gateway fee (1.8%)</span><span class="val">৳180</span></div>
              <div class="row"><span class="lbl">Shown to customer</span><span class="val">৳10,180</span></div>
              <div class="row neg"><span class="lbl">− Coupon MONSOON10 (10%)</span><span class="val">−৳1,018</span></div>
              <div class="row total"><span class="lbl">Customer pays</span><span class="val">৳9,162</span></div>
            </div>
            <div class="bill" style="margin-top:14px">
              <div class="row sub"><span class="lbl">Platform receives</span><span class="val">৳8,982</span></div>
              <div class="row neg"><span class="lbl">− Commission (5% of ৳10,000)</span><span class="val">−৳500</span></div>
              <div class="row total"><span class="lbl">You receive</span><span class="val">৳8,482</span></div>
            </div>
          </div>
          <div>
            <h4 style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:8px">Policy snapshot</h4>
            <div class="note info"><span class="ic">🔒</span> Moderate · stamped 21 Jul. This is what a dispute cites.</div>
          </div>
        </div>
        <div class="df"><button class="btn btn-o" data-drawer-close>Close</button><a class="btn btn-b" href="owner-payments.html">Verify cash →</a></div>
      </aside>
`},

{ key:'payments', out:'owner-payments.html', title:'Payments', crumb:'Jol Kolol · cash verification', body:`
      <div class="page-head">
        <div><h1>Payments</h1><p>Cash taken at the counter is verified <b>by you as manager</b> — it never touches the gateway. Online payments are verified by platform finance instead.</p></div>
      </div>
      <div class="kpis">
        <div class="kpi alert"><div class="l"><span class="ic">💵</span> Cash to verify</div><div class="n">2</div><div class="d down">৳12,000</div></div>
        <div class="kpi"><div class="l"><span class="ic">✓</span> Verified today</div><div class="n">5</div><div class="d up">৳46,300</div></div>
        <div class="kpi"><div class="l"><span class="ic">💳</span> Online (finance verifies)</div><div class="n">3</div><div class="d">out of your hands</div></div>
      </div>
      <div class="card2"><div class="ch"><h3>Cash awaiting your verification</h3></div>
        <div class="cb flush"><div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Invoice</th><th>Guest</th><th>Taken by</th><th class="num">Amount</th><th>When</th><th></th></tr></thead>
          <tbody>
            <tr><td class="t1">#JK-1042</td><td>Farhana Akter</td><td class="t2">Nur (mgr)</td><td class="num">৳7,000</td><td class="t2">18:20</td><td class="rowact"><button class="btn btn-sm btn-ok">Verify</button></td></tr>
            <tr><td class="t1">#JK-1044</td><td>Walk-in · 103</td><td class="t2">You</td><td class="num">৳5,000</td><td class="t2">18:55</td><td class="rowact"><button class="btn btn-sm btn-ok">Verify</button></td></tr>
          </tbody>
        </table></div></div>
      </div>
      <div class="card2" style="margin-top:20px"><div class="ch"><h3>Payment log</h3><span class="sub">gateway + cash</span></div>
        <div class="cb flush"><div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Invoice</th><th>Method</th><th class="num">Amount</th><th>Received by</th><th>Verified by</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td class="t1">#JK-1041</td><td><span class="pill blue">gateway</span></td><td class="num">৳24,360</td><td class="t2">—</td><td class="t2">Nusrat (finance)</td><td><span class="pill ok">verified</span></td></tr>
            <tr><td class="t1">#JK-1038</td><td><span class="pill blue">gateway</span></td><td class="num">৳1,52,700</td><td class="t2">—</td><td class="t2">Rafiq (finance)</td><td><span class="pill ok">verified</span></td></tr>
            <tr><td class="t1">#JK-1012</td><td><span class="pill amb">cash</span></td><td class="num">৳13,987</td><td class="t2">You</td><td class="t2">You</td><td><span class="pill ok">verified</span></td></tr>
          </tbody>
        </table></div></div>
      </div>
`},

{ key:'refunds', out:'owner-refunds.html', title:'Refunds', crumb:'Jol Kolol · owner-cancel only', body:`
      <div class="page-head">
        <div><h1>Refunds & reschedules</h1><p>A refund only opens when <b>you cancelled the trip</b>, and only within 6 days. Customer-cancels follow your policy template instead — the platform always keeps its commission.</p></div>
      </div>
      <div class="card2" style="margin-bottom:20px"><div class="ch"><h3>Owner-cancelled · customer must choose</h3><span class="sub">6-day claim window</span></div>
        <div class="cb flush"><div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Invoice</th><th>Guest</th><th class="num">Paid</th><th>Choice</th><th>Deadline</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td class="t1">#JK-0998</td><td>Selina Begum</td><td class="num">৳9,162</td><td><span class="pill blue">refund</span></td><td><span class="pill warn">1 day left</span></td><td><span class="pill amb">requested</span></td></tr>
            <tr><td class="t1">#JK-0994</td><td>Habib Rahman</td><td class="num">৳14,252</td><td><span class="pill ok">reschedule</span></td><td class="t2">—</td><td><span class="pill ok">repriced → 24 Jul</span></td></tr>
            <tr><td class="t1">#JK-0990</td><td>Arif Chowdhury</td><td class="num">৳9,162</td><td><span class="pill mut">do nothing</span></td><td class="t2">expired</td><td><span class="pill mut">kept by platform</span></td></tr>
          </tbody>
        </table></div></div>
      </div>
      <div class="grid-2">
        <div class="card2"><div class="ch"><h3>Refund flow · 3-person separation</h3></div><div class="cb stack" style="gap:10px">
          <div class="note info"><span class="ic">ℹ️</span> requested_by → verified_by → completed_by must be <b>three different people</b>. Finance collects bank details and transfers.</div>
          <div class="tbl-wrap"><table class="tbl" style="min-width:0"><tbody>
            <tr><td class="t1">Requested</td><td>Selina B</td><td class="t2">21 Jul</td></tr>
            <tr><td class="t1">Verified</td><td>Nusrat (finance)</td><td class="t2">pending</td></tr>
            <tr><td class="t1">Completed</td><td>—</td><td class="t2">—</td></tr>
          </tbody></table></div>
        </div></div>
        <div class="card2"><div class="ch"><h3>Reschedule trail · #JK-0994</h3></div><div class="cb">
          <div class="bill">
            <div class="row"><span class="lbl">Old date · 10 Jul<span class="s">General Day price</span></span><span class="val">৳9,162</span></div>
            <div class="row"><span class="lbl">New date · 24 Jul<span class="s">Weekend price</span></span><span class="val">৳11,450</span></div>
            <div class="row sub"><span class="lbl">Advance carried as credit</span><span class="val">৳9,162</span></div>
            <div class="row total"><span class="lbl">New due</span><span class="val">৳2,288</span></div>
          </div>
          <div class="note warn" style="margin-top:12px"><span class="ic">⚠️</span> Reschedule reprices at the new date — the advance is credit, not a locked price.</div>
        </div></div>
      </div>
`},

{ key:'payouts', out:'owner-payouts.html', title:'Payouts', crumb:'Jol Kolol · weekly batches', body:`
      <div class="page-head">
        <div><h1>Payouts</h1><p>Weekly. Finance batches every verified invoice for your boat, nets commission, and transfers. A batch total is <b>signed</b> — it can go negative when cash + low deposits leave you owing the platform.</p></div>
      </div>
      <div class="kpis">
        <div class="kpi"><div class="l"><span class="ic">💸</span> This week</div><div class="n"><span class="u">৳</span>84,820</div><div class="d up">6 invoices</div></div>
        <div class="kpi"><div class="l"><span class="ic">📅</span> Last transfer</div><div class="n">14 Jul</div><div class="d">৳ 72,110</div></div>
        <div class="kpi"><div class="l"><span class="ic">🏦</span> Paid into</div><div class="n">••4821</div><div class="d">City Bank</div></div>
      </div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Batch</th><th>Week</th><th>Invoices</th><th class="num">Total</th><th>Prepared</th><th>Approved</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td class="t1">#B-0291</td><td>15–21 Jul</td><td>6</td><td class="num">৳84,820</td><td class="t2">Nusrat</td><td class="t2">Rafiq</td><td><span class="pill blue">approved</span></td></tr>
          <tr><td class="t1">#B-0284</td><td>8–14 Jul</td><td>9</td><td class="num">৳72,110</td><td class="t2">Nusrat</td><td class="t2">Rafiq</td><td><span class="pill ok">paid</span></td></tr>
          <tr><td class="t1">#B-0277</td><td>1–7 Jul</td><td>4</td><td class="num neg">−৳3,200</td><td class="t2">Rafiq</td><td class="t2">Nusrat</td><td><span class="pill warn">offset to balance</span></td></tr>
          <tr><td class="t1">#B-0270</td><td>24–30 Jun</td><td>11</td><td class="num">৳98,400</td><td class="t2">Nusrat</td><td class="t2">Rafiq</td><td><span class="pill ok">paid</span></td></tr>
        </tbody>
      </table></div></div></div>
      <div class="note info" style="margin-top:16px"><span class="ic">ℹ️</span> Cash never entered the platform account, so it's never in <b>due to boat</b>. A negative batch offsets your platform balance — if that debt exceeds the platform fee, access is denied until you settle.</div>
`},

{ key:'earnings', out:'owner-earnings.html', title:'Earnings', crumb:'Jol Kolol · July 2026', body:`
      <div class="page-head">
        <div><h1>Earnings statement</h1><p>The full picture for July — what came in, what the platform took, what you paid out, and what's left. Co-owner distributions at the bottom.</p></div>
        <div class="acts"><div class="seg"><button class="seg-b">June</button><button class="seg-b on">July</button><button class="seg-b">Q3</button></div><a class="btn btn-o" href="#">Export PDF</a></div>
      </div>
      <div class="kpis">
        <div class="kpi"><div class="l"><span class="ic">৳</span> Room revenue</div><div class="n"><span class="u">৳</span>9.6L</div><div class="d up">+14% vs Jun</div></div>
        <div class="kpi"><div class="l"><span class="ic">%</span> Commission paid</div><div class="n"><span class="u">৳</span>48,200</div><div class="d">5% of room</div></div>
        <div class="kpi"><div class="l"><span class="ic">🧾</span> Costs</div><div class="n"><span class="u">৳</span>2.1L</div><div class="d">fuel · bazar · repair</div></div>
        <div class="kpi"><div class="l"><span class="ic">💰</span> Net</div><div class="n"><span class="u">৳</span>6.4L</div><div class="d up">before distributions</div></div>
      </div>
      <div class="grid-2">
        <div class="card2"><div class="ch"><h3>July statement</h3></div><div class="cb">
          <div class="bill">
            <div class="row"><span class="lbl">Room revenue<span class="s">86 completed bookings</span></span><span class="val">৳9,64,000</span></div>
            <div class="row neg"><span class="lbl">− Commission (platform)</span><span class="val">−৳48,200</span></div>
            <div class="row neg"><span class="lbl">− Gateway fees</span><span class="val">−৳17,350</span></div>
            <div class="row"><span class="lbl">Payouts received (net)</span><span class="val">৳8,98,450</span></div>
            <div class="row neg"><span class="lbl">− Operating costs</span><span class="val">−৳2,08,900</span></div>
            <div class="row neg"><span class="lbl">− Crew payroll</span><span class="val">−৳1,42,000</span></div>
            <div class="row total"><span class="lbl">Net for July</span><span class="val">৳5,47,550</span></div>
          </div>
        </div></div>
        <div class="card2"><div class="ch"><h3>Distributions</h3><span class="sub">recorded withdrawals · no auto-split</span></div>
          <div class="cb flush"><div class="tbl-wrap"><table class="tbl" style="min-width:0">
            <thead><tr><th>Shareholder</th><th>%</th><th class="num">Taken</th></tr></thead>
            <tbody>
              <tr><td class="t1">Kamal Uddin</td><td>60%</td><td class="num">৳2,40,000</td></tr>
              <tr><td class="t1">Selim Reza</td><td>25%</td><td class="num">৳1,00,000</td></tr>
              <tr><td class="t1">Anwar Hossain</td><td>15%</td><td class="num">৳0</td></tr>
            </tbody>
          </table></div>
          <div class="cb"><div class="note info" style="margin:0"><span class="ic">ℹ️</span> Shareholder % is a record only — the system never auto-splits profit. Log what each partner actually withdrew.</div></div>
        </div></div>
      </div>
`},

{ key:'billing', out:'owner-billing.html', title:'Platform billing', crumb:'Jol Kolol · what you owe the platform', body:`
      <div class="page-head">
        <div><h1>Platform billing</h1><p>The monthly bill the <b>platform</b> sends you — separate from booking commission. Both a monthly fee and commission can apply. Billing is per boat, never combined across your boats.</p></div>
      </div>
      <div class="kpis">
        <div class="kpi alert"><div class="l"><span class="ic">🔻</span> Platform balance</div><div class="n">−<span class="u">৳</span>3,200</div><div class="d down">you owe · settle by 25 Jul</div></div>
        <div class="kpi"><div class="l"><span class="ic">⏱</span> Trial ends</div><div class="n">4 Aug</div><div class="d">14 days left</div></div>
        <div class="kpi"><div class="l"><span class="ic">🎫</span> Credit held (guests)</div><div class="n"><span class="u">৳</span>6,000</div><div class="d">liability · 2 guests</div></div>
      </div>
      <div class="card2" style="margin-bottom:20px"><div class="ch"><h3>Subscription invoices</h3><span class="sub">monthly fee + commission total</span></div>
        <div class="cb flush"><div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Period</th><th class="num">Monthly fee</th><th class="num">Commission</th><th class="num">Due</th><th>Status</th><th></th></tr></thead>
          <tbody>
            <tr><td class="t1">Aug 2026</td><td class="num">৳2,000</td><td class="num">৳48,200</td><td class="num">৳50,200</td><td><span class="pill mut">preview · trial</span></td><td class="rowact"><button class="btn btn-sm btn-o" disabled>Pay</button></td></tr>
            <tr><td class="t1">Jul 2026</td><td class="num">৳0</td><td class="num">৳44,100</td><td class="num">৳44,100</td><td><span class="pill warn">issued</span></td><td class="rowact"><button class="btn btn-sm btn-b">Pay</button></td></tr>
            <tr><td class="t1">Jun 2026</td><td class="num">৳0</td><td class="num">৳38,900</td><td class="num">৳38,900</td><td><span class="pill ok">paid</span></td><td class="rowact"><button class="btn btn-sm btn-o" disabled>Paid</button></td></tr>
          </tbody>
        </table></div></div>
      </div>
      <div class="card2"><div class="ch"><h3>Customer credit ledger</h3><span class="sub">buyout overpayments held for guests</span></div>
        <div class="cb flush"><div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Guest</th><th>From invoice</th><th class="num">Amount</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td class="t1">Rakib Hasan</td><td class="t2">#JK-1041</td><td class="num">৳2,000</td><td><span class="pill ok">open</span></td></tr>
            <tr><td class="t1">Sabbir Ahmed</td><td class="t2">#JK-1044</td><td class="num">৳4,000</td><td><span class="pill ok">open</span></td></tr>
          </tbody>
        </table></div></div>
      </div>
`},

];
