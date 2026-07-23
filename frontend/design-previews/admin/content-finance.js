/* eslint-disable */
// Finance group: verify, refunds, payouts, overpayments, credits, commission,
// billing (subscriptions), billing-config, debtors, trials
module.exports = [

{ key:'verify', out:'admin-finance-verify.html', title:'Verify payments', crumb:'Risk-sorted queue', body:`
      <div class="page-head">
        <div><h1>Payment verification</h1><p>A deliberate human check against the gateway portal — it catches gateway bugs and fraud. Sorted by risk: large amounts, first-time boats and anomalies first. Cash is verified by the boat manager, not here.</p></div>
      </div>
      <div class="filterbar">
        <div class="seg"><button class="seg-b on">Gateway<span class="ct">5</span></button><button class="seg-b">Cash (read-only)<span class="ct">3</span></button></div>
        <select class="select"><option>Sort: risk (high→low)</option><option>Amount</option><option>Oldest</option></select>
      </div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Invoice</th><th>Boat</th><th>Risk</th><th class="num">Amount</th><th>Gateway token</th><th></th></tr></thead>
        <tbody>
          <tr><td class="t1">INV-9a11</td><td>Meghduar</td><td><span class="pill danger">first-time · large</span></td><td class="num">৳ 1,84,000</td><td class="t2">sslcz_7f…c204</td><td class="rowact"><button class="btn btn-sm btn-b" data-drawer>Verify</button></td></tr>
          <tr><td class="t1">INV-88f2</td><td>Jol Kolol</td><td><span class="pill warn">large</span></td><td class="num">৳ 96,500</td><td class="t2">sslcz_2b…9a71</td><td class="rowact"><button class="btn btn-sm btn-b" data-drawer>Verify</button></td></tr>
          <tr><td class="t1">INV-8410</td><td>Jol Kolol</td><td><span class="pill amb">coupon-heavy</span></td><td class="num">৳ 9,162</td><td class="t2">sslcz_a0…4d12</td><td class="rowact"><button class="btn btn-sm btn-b" data-drawer>Verify</button></td></tr>
          <tr><td class="t1">INV-7d55</td><td>Haor Bilash</td><td><span class="pill mut">normal</span></td><td class="num">৳ 18,340</td><td class="t2">sslcz_c9…7e88</td><td class="rowact"><button class="btn btn-sm btn-b" data-drawer>Verify</button></td></tr>
          <tr><td class="t1">INV-7c02</td><td>Haor Bilash</td><td><span class="pill mut">normal</span></td><td class="num">৳ 12,700</td><td class="t2">sslcz_11…2f30</td><td class="rowact"><button class="btn btn-sm btn-b" data-drawer>Verify</button></td></tr>
        </tbody>
      </table></div></div></div>

      <div class="drawer-sc" id="drawerScrim"></div>
      <aside class="drawer" id="drawer">
        <div class="dh"><h3>Verify INV-9a11</h3><button class="x" data-drawer-close>✕</button></div>
        <div class="db stack" style="gap:16px">
          <div class="note warn"><span class="ic">⚑</span> First payout for this boat. Cross-check the gateway portal before verifying.</div>
          <dl class="kv"><dt>Boat</dt><dd>Meghduar</dd><dt>Method</dt><dd>gateway (SSLCommerz)</dd><dt>Amount</dt><dd class="money">৳ 1,84,000</dd><dt>val_id</dt><dd>2507211841…</dd><dt>Paid at</dt><dd>21 Jul 18:39</dd></dl>
          <div class="note info"><span class="ic">ℹ</span> Verifying moves the invoice to <b>payment_verified</b> — the only state that enters a payout batch.</div>
        </div>
        <div class="df"><button class="btn btn-danger">Flag fraud</button><button class="btn btn-ok">Mark verified</button></div>
      </aside>
`},

{ key:'refunds', out:'admin-finance-refunds.html', title:'Refunds', crumb:'Owner-cancel · 6-day window', body:`
      <div class="page-head">
        <div><h1>Refunds</h1><p>Only reachable when the owner cancelled a trip, within 6 days. Three-person separation of duties: request → verify → complete must be different people. Bank details are encrypted and revealed under an audited gate.</p></div>
      </div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Refund</th><th>Boat</th><th class="num">Amount</th><th>Stage</th><th>Claim deadline</th><th></th></tr></thead>
        <tbody>
          <tr><td class="t1">RF-3311</td><td>Haor Bilash</td><td class="num">৳ 7,200</td><td><span class="pill warn">requested</span></td><td><span class="pill danger">1 day left</span></td><td class="rowact"><button class="btn btn-sm btn-b" data-drawer>Verify</button></td></tr>
          <tr><td class="t1">RF-3298</td><td>Bhela</td><td class="num">৳ 5,400</td><td><span class="pill blue">verified</span></td><td class="t2">3 days left</td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>Complete</button></td></tr>
          <tr><td class="t1">RF-3270</td><td>Jol Kolol</td><td class="num">৳ 11,000</td><td><span class="pill lock blue">in_payout</span></td><td class="t2">4 days left</td><td class="rowact"><button class="btn btn-sm btn-danger">Pull from batch</button></td></tr>
          <tr><td class="t1">RF-3250</td><td>Meghduar</td><td class="num">৳ 3,000</td><td><span class="pill ok">completed</span></td><td class="t2">—</td><td class="rowact"><button class="btn btn-sm btn-o">Receipt</button></td></tr>
        </tbody>
      </table></div></div></div>

      <div class="drawer-sc" id="drawerScrim"></div>
      <aside class="drawer" id="drawer">
        <div class="dh"><h3>Verify RF-3311</h3><button class="x" data-drawer-close>✕</button></div>
        <div class="db stack" style="gap:16px">
          <div class="note danger"><span class="ic">⏳</span> 1 day left to claim. After the deadline the refund option disappears entirely.</div>
          <dl class="kv"><dt>Requested by</dt><dd>Farhana Islam (customer)</dd><dt>Amount</dt><dd class="money">৳ 7,200</dd><dt>Reason</dt><dd>Owner cancelled — weather</dd></dl>
          <div class="note info"><span class="ic">🔒</span> Bank details encrypted at rest. <a href="#" style="color:inherit;text-decoration:underline">Reveal (audited)</a> — logs who decrypted and when.</div>
          <div class="note warn"><span class="ic">⚑</span> You cannot also be the completer. <b>verified_by ≠ completed_by</b>.</div>
        </div>
        <div class="df"><button class="btn btn-o" data-drawer-close>Close</button><button class="btn btn-ok">Mark verified</button></div>
      </aside>
`},

{ key:'payouts', out:'admin-finance-payouts.html', title:'Payouts', crumb:'Weekly batches', body:`
      <div class="page-head">
        <div><h1>Payout batches</h1><p>Weekly, per boat. Prepare → approve → pay, and the preparer must not be the approver. Batch totals are signed — a negative total means the boat owes the platform.</p></div>
        <div class="acts"><button class="btn btn-b">+ Prepare batch</button></div>
      </div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Batch</th><th>Boat</th><th class="num">Total</th><th>Prepared by</th><th>Approved by</th><th>Status</th><th></th></tr></thead>
        <tbody>
          <tr><td class="t1">PB-0192</td><td>Jol Kolol</td><td class="num">৳ 2,14,820</td><td class="t2">Nusrat J.</td><td class="t2">—</td><td><span class="pill warn">prepared</span></td><td class="rowact"><button class="btn btn-sm btn-ok">Approve</button></td></tr>
          <tr><td class="t1">PB-0191</td><td>Haor Bilash</td><td class="num">৳ 1,68,320</td><td class="t2">Nusrat J.</td><td class="t2">Rafiq A.</td><td><span class="pill blue">approved</span></td><td class="rowact"><button class="btn btn-sm btn-b">Pay</button></td></tr>
          <tr><td class="t1">PB-0190</td><td>Bhela</td><td class="num neg">−৳ 12,400</td><td class="t2">Nusrat J.</td><td class="t2">—</td><td><span class="pill danger">negative</span></td><td class="rowact"><button class="btn btn-sm" disabled title="Boat owes the platform">Pay</button></td></tr>
          <tr><td class="t1">PB-0189</td><td>Meghduar</td><td class="num">৳ 49,200</td><td class="t2">Rafiq A.</td><td class="t2">—</td><td><span class="pill danger">no bank</span></td><td class="rowact"><button class="btn btn-sm" disabled title="Bank account required">Pay</button></td></tr>
          <tr><td class="t1">PB-0188</td><td>Jol Kolol</td><td class="num">৳ 1,98,010</td><td class="t2">Nusrat J.</td><td class="t2">Rafiq A.</td><td><span class="pill ok">paid</span></td><td class="rowact"><button class="btn btn-sm btn-o">Receipt</button></td></tr>
        </tbody>
      </table></div></div></div>
      <div class="note warn" style="margin-top:16px"><span class="ic">⚑</span> <b>PB-0190</b> is negative — offset against the boat's platform_balance in <a href="admin-debtors.html" style="color:inherit;text-decoration:underline">Debtors</a>, don't pay it. <b>PB-0189</b> is blocked until Meghduar files a bank account.</div>
`},

{ key:'overpayments', out:'admin-finance-overpayments.html', title:'Overpayments', crumb:'Resolution queue', body:`
      <div class="page-head">
        <div><h1>Overpayment resolution</h1><p>When an open-seat buyout is filled after payment, the invoice drops and the surplus surfaces here. A human decides: convert to customer credit, or refund.</p></div>
      </div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Invoice</th><th>Customer</th><th class="num">Overpaid</th><th>Status</th><th></th></tr></thead>
        <tbody>
          <tr><td class="t1">INV-6a29</td><td>Imran Kabir</td><td class="num">৳ 5,000</td><td><span class="pill warn">unresolved</span></td><td class="rowact"><button class="btn btn-sm btn-o">Refund</button><button class="btn btn-sm btn-b">→ Credit</button></td></tr>
          <tr><td class="t1">INV-6110</td><td>Sultana Begum</td><td class="num">৳ 2,000</td><td><span class="pill warn">unresolved</span></td><td class="rowact"><button class="btn btn-sm btn-o">Refund</button><button class="btn btn-sm btn-b">→ Credit</button></td></tr>
        </tbody>
      </table></div></div></div>
      <div class="note info" style="margin-top:16px"><span class="ic">ℹ</span> The open-seat invoice only ever moves down. Surplus never becomes negative due-to-boat — it lands here first.</div>
`},

{ key:'credits', out:'admin-finance-credits.html', title:'Credits', crumb:'Customer-credit ledger', body:`
      <div class="page-head">
        <div><h1>Customer-credit ledger</h1><p>Platform liability — money owed to customers as credit toward future bookings. Fed by overpayments and reschedule advances.</p></div>
      </div>
      <div class="kpis">
        <div class="kpi"><div class="l"><span class="ic">🎫</span> Open credit</div><div class="n"><span class="u">৳</span>34,500</div><div class="d">outstanding liability</div></div>
        <div class="kpi"><div class="l"><span class="ic">✅</span> Used this month</div><div class="n"><span class="u">৳</span>18,000</div><div class="d">6 bookings</div></div>
        <div class="kpi"><div class="l"><span class="ic">⏳</span> Aging &gt; 90d</div><div class="n"><span class="u">৳</span>4,000</div><div class="d">2 credits</div></div>
      </div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Customer</th><th class="num">Amount</th><th>Source</th><th>Used in</th><th>Status</th><th class="num">Age</th></tr></thead>
        <tbody>
          <tr><td class="t1">Imran Kabir</td><td class="num">৳ 5,000</td><td class="t2">INV-6a29 · overpay</td><td class="t2">—</td><td><span class="pill blue">open</span></td><td class="num">3d</td></tr>
          <tr><td class="t1">Sultana Begum</td><td class="num">৳ 2,000</td><td class="t2">INV-6110 · reschedule</td><td class="t2">—</td><td><span class="pill blue">open</span></td><td class="num">9d</td></tr>
          <tr><td class="t1">Nadia Haque</td><td class="num">৳ 3,000</td><td class="t2">INV-5m20 · overpay</td><td class="t2">INV-7c02</td><td><span class="pill ok">used</span></td><td class="num">—</td></tr>
          <tr><td class="t1">Rezaul Karim</td><td class="num">৳ 2,000</td><td class="t2">INV-4b90 · overpay</td><td class="t2">—</td><td><span class="pill warn">open · aged</span></td><td class="num">104d</td></tr>
        </tbody>
      </table></div></div></div>
`},

{ key:'commission', out:'admin-finance-commission.html', title:'Commission audit', crumb:'Integrity check', body:`
      <div class="page-head">
        <div><h1>Commission integrity</h1><p>Commission must equal room_total × rate — on the <b>original</b> price, never the discounted amount. This catches coupon-gaming and computation bugs.</p></div>
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
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Period</th><th>Boat</th><th class="num">Monthly fee</th><th class="num">Commission</th><th class="num">Amount due</th><th class="num">Balance</th><th>Status</th><th></th></tr></thead>
        <tbody>
          <tr><td class="t1">2026-07</td><td>Jol Kolol</td><td class="num">৳ 5,000</td><td class="num">৳ 2,06,000</td><td class="num">৳ 5,000</td><td class="num">৳ 0</td><td><span class="pill warn">issued</span></td><td class="rowact"><button class="btn btn-sm btn-ok">Mark paid</button></td></tr>
          <tr><td class="t1">2026-07</td><td>Haor Bilash</td><td class="num">৳ 5,000</td><td class="num">৳ 1,43,200</td><td class="num">৳ 5,000</td><td class="num">৳ 8,200</td><td><span class="pill ok">paid</span></td><td class="rowact"><button class="btn btn-sm btn-o">Receipt</button></td></tr>
          <tr><td class="t1">2026-06</td><td>Bhela</td><td class="num">৳ 5,000</td><td class="num">৳ 15,500</td><td class="num">৳ 5,000</td><td class="num neg">−৳ 12,400</td><td><span class="pill danger">overdue</span></td><td class="rowact"><button class="btn btn-sm btn-o">Chase</button></td></tr>
        </tbody>
      </table></div></div></div>
`},

{ key:'billing-config', out:'admin-billing-config.html', title:'Billing config', crumb:'Per boat', body:`
      <div class="page-head">
        <div><h1>Billing config</h1><p>Platform-set, per boat. Commission and monthly fee can both apply. The gateway fee here feeds the customer-facing bill. Never combine billing across a multi-boat owner.</p></div>
        <div class="acts"><select class="select"><option>Jol Kolol</option><option>Haor Bilash</option><option>Meghduar</option></select></div>
      </div>
      <div class="grid-2">
        <div class="card2"><div class="ch"><h3>Jol Kolol — rates</h3></div><div class="cb">
          <div class="form-grid">
            <div class="field"><label>Commission %</label><input value="5.0"></div>
            <div class="field"><label>Gateway fee %</label><input value="1.8"></div>
            <div class="field"><label>Monthly fee (৳)</label><input value="5000"></div>
            <div class="field"><label>Trial ends</label><input value="—" placeholder="none"></div>
          </div>
          <div style="margin-top:16px;display:flex;gap:10px"><button class="btn btn-b">Save config</button><span class="pill ok" style="align-self:center">write path pending in backend</span></div>
        </div></div>
        <div class="card2"><div class="ch"><h3>Effect on the bill</h3></div><div class="cb"><dl class="kv">
          <dt>Room total</dt><dd class="money">৳ 10,000</dd>
          <dt>Gateway fee (1.8%)</dt><dd class="money">৳ 180</dd>
          <dt>Commission (5%)</dt><dd class="money">৳ 500</dd>
          <dt>Platform balance</dt><dd class="money">৳ 0</dd>
        </dl>
        <div class="note info" style="margin-top:14px"><span class="ic">ℹ</span> A boat with no config silently defaults gateway &amp; commission to 0 — this editor prevents that gap.</div>
        </div></div>
      </div>
`},

{ key:'debtors', out:'admin-debtors.html', title:'Debtors', crumb:'Access-denial control', body:`
      <div class="page-head">
        <div><h1>Debtors &amp; access control</h1><p>Boats with a negative platform_balance owe the platform. The debt offsets the platform fee; if it exceeds the fee, access is denied until settled.</p></div>
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

{ key:'trials', out:'admin-trials.html', title:'Trials', crumb:'Expiring soon', body:`
      <div class="page-head">
        <div><h1>Trials expiring</h1><p>Boats approaching trial_ends. On expiry they convert to billing — preview the first monthly bill before it issues.</p></div>
      </div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Boat</th><th>Trial ends</th><th class="num">Days left</th><th class="num">First bill (est.)</th><th>Urgency</th><th></th></tr></thead>
        <tbody>
          <tr><td class="t1">Meghduar</td><td class="t2">24 Jul 2026</td><td class="num">3</td><td class="num">৳ 5,000 + 5%</td><td><span class="pill danger">3 days</span></td><td class="rowact"><button class="btn btn-sm btn-b">Preview bill</button></td></tr>
          <tr><td class="t1">Bonolota</td><td class="t2">31 Jul 2026</td><td class="num">10</td><td class="num">৳ 5,000 + 5%</td><td><span class="pill warn">10 days</span></td><td class="rowact"><button class="btn btn-sm btn-b">Preview bill</button></td></tr>
          <tr><td class="t1">Shapla Nao</td><td class="t2">12 Aug 2026</td><td class="num">22</td><td class="num">৳ 5,000 + 5%</td><td><span class="pill ok">22 days</span></td><td class="rowact"><button class="btn btn-sm btn-b">Preview bill</button></td></tr>
        </tbody>
      </table></div></div></div>
`},

];
