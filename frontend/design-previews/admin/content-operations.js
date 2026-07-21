/* eslint-disable */
// Operations group: boats, routes, bookings, reviews, accounts, memberships, waitlist
module.exports = [

{ key:'boats', out:'admin-boats.html', title:'Boats', crumb:'Moderation queue', body:`
      <div class="page-head">
        <div><h1>Boat moderation</h1><p>Approve a boat only when its profile is 100% complete <b>and</b> a bank account is on file. Suspend or reinstate with a reason — it lands in the audit log.</p></div>
      </div>
      <div class="filterbar">
        <div class="seg"><button class="seg-b">All<span class="ct">32</span></button><button class="seg-b on">Pending<span class="ct">3</span></button><button class="seg-b">Draft<span class="ct">6</span></button><button class="seg-b">Live<span class="ct">28</span></button><button class="seg-b">Suspended<span class="ct">1</span></button></div>
        <div class="search"><span class="mag">🔍</span><input placeholder="Search boat or slug…"></div>
      </div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Boat</th><th>Route</th><th>Status</th><th>Profile</th><th>Bank</th><th>Submitted</th><th></th></tr></thead>
        <tbody>
          <tr><td><div class="t1">Meghduar</div><div class="t2">/meghduar</div></td><td>Tanguar Haor</td><td><span class="pill warn">pending</span></td><td><b class="money">100%</b></td><td><span class="pill ok">on file</span></td><td class="t2">19 Jul</td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>View</button><button class="btn btn-sm btn-ok">Approve</button></td></tr>
          <tr><td><div class="t1">Shapla Nao</div><div class="t2">/shapla-nao</div></td><td>Nikli Haor</td><td><span class="pill warn">pending</span></td><td><b class="money">100%</b></td><td><span class="pill danger">missing</span></td><td class="t2">18 Jul</td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>View</button><button class="btn btn-sm" disabled title="Bank account required">Approve</button></td></tr>
          <tr><td><div class="t1">Bonolota</div><div class="t2">/bonolota</div></td><td>Tanguar Haor</td><td><span class="pill warn">pending</span></td><td><b class="money">82%</b></td><td><span class="pill danger">missing</span></td><td class="t2">17 Jul</td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>View</button><button class="btn btn-sm" disabled>Approve</button></td></tr>
          <tr><td><div class="t1">Ashroy</div><div class="t2">/ashroy · draft</div></td><td>—</td><td><span class="pill mut">draft</span></td><td><b class="money">60%</b></td><td><span class="pill danger">missing</span></td><td class="t2">—</td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>View</button></td></tr>
          <tr><td><div class="t1">Jol Kolol</div><div class="t2">/jol-kolol</div></td><td>Tanguar Haor</td><td><span class="pill ok">live</span></td><td><b class="money">100%</b></td><td><span class="pill ok">on file</span></td><td class="t2">—</td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>View</button><button class="btn btn-sm btn-danger">Suspend</button></td></tr>
          <tr><td><div class="t1">Bhela</div><div class="t2">/bhela · debt</div></td><td>Nikli Haor</td><td><span class="pill danger">suspended</span></td><td><b class="money">100%</b></td><td><span class="pill ok">on file</span></td><td class="t2">—</td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>View</button><button class="btn btn-sm btn-ok">Reinstate</button></td></tr>
        </tbody>
      </table></div></div></div>

      <div class="drawer-sc" id="drawerScrim"></div>
      <aside class="drawer" id="drawer">
        <div class="dh"><h3>Meghduar</h3><button class="x" data-drawer-close>✕</button></div>
        <div class="db stack" style="gap:16px">
          <span class="pill warn">pending approval</span>
          <div class="note ok"><span class="ic">✓</span> Go-live checklist met — profile 100%, bank account on file.</div>
          <div>
            <h4 style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:8px">Profile</h4>
            <dl class="kv">
              <dt>Route</dt><dd>Tanguar Haor</dd>
              <dt>Decks</dt><dd>2</dd>
              <dt>Cabins</dt><dd>8 · 2 categories</dd>
              <dt>Cancellation policy</dt><dd>Moderate</dd>
              <dt>Blackout tiers</dt><dd>Eid 0% · Full-moon 0%</dd>
              <dt>Bank account</dt><dd>City Bank ••4821</dd>
            </dl>
          </div>
          <div class="note info"><span class="ic">ℹ</span> Blackout dates are set per-boat by the owner. Platform reviews, does not edit.</div>
        </div>
        <div class="df"><button class="btn btn-o" data-drawer-close>Close</button><button class="btn btn-danger">Reject</button><button class="btn btn-ok">Approve → live</button></div>
      </aside>
`},

{ key:'routes', out:'admin-routes.html', title:'Routes', crumb:'Platform-curated', body:`
      <div class="page-head">
        <div><h1>Routes</h1><p>Platform-curated. Owners pick from these — they cannot create routes. Retire a route to hide it from new boats without deleting history.</p></div>
        <div class="acts"><button class="btn btn-b">+ New route</button></div>
      </div>
      <div class="card2"><div class="cb">
        <div class="form-grid" style="margin-bottom:6px">
          <div class="field"><label>Route name</label><input placeholder="e.g. Tanguar Haor"></div>
          <div class="field"><label>Region</label><input placeholder="e.g. Sunamganj"></div>
          <div style="display:flex;align-items:flex-end"><button class="btn btn-b btn-block" style="width:100%;justify-content:center">Create route</button></div>
        </div>
      </div></div>
      <div class="card2" style="margin-top:20px"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Route</th><th>Region</th><th>Boats</th><th>Status</th><th></th></tr></thead>
        <tbody>
          <tr><td class="t1">Tanguar Haor</td><td>Sunamganj</td><td class="t2">14 boats</td><td><span class="pill ok">active</span></td><td class="rowact"><button class="btn btn-sm btn-o">Edit</button><button class="btn btn-sm btn-o">Retire</button></td></tr>
          <tr><td class="t1">Nikli Haor</td><td>Kishoreganj</td><td class="t2">9 boats</td><td><span class="pill ok">active</span></td><td class="rowact"><button class="btn btn-sm btn-o">Edit</button><button class="btn btn-sm btn-o">Retire</button></td></tr>
          <tr><td class="t1">Tahirpur</td><td>Sunamganj</td><td class="t2">4 boats</td><td><span class="pill ok">active</span></td><td class="rowact"><button class="btn btn-sm btn-o">Edit</button><button class="btn btn-sm btn-o">Retire</button></td></tr>
          <tr><td class="t1">Mohanganj</td><td>Netrokona</td><td class="t2">1 boat</td><td><span class="pill ok">active</span></td><td class="rowact"><button class="btn btn-sm btn-o">Edit</button><button class="btn btn-sm btn-o">Retire</button></td></tr>
          <tr><td class="t1">Baulai River</td><td>Sunamganj</td><td class="t2">0 boats</td><td><span class="pill mut">retired</span></td><td class="rowact"><button class="btn btn-sm btn-o">Reactivate</button></td></tr>
        </tbody>
      </table></div></div></div>
`},

{ key:'bookings', out:'admin-bookings.html', title:'Bookings & invoices', crumb:'Cross-boat', body:`
      <div class="page-head">
        <div><h1>Bookings &amp; invoices</h1><p>Find any booking across all boats. Every open re-checks authorization (no enumeration by ID). Platform can cancel or reschedule a trip — an owner-cancel triggers the refund path.</p></div>
      </div>
      <div class="filterbar">
        <div class="search" style="max-width:420px"><span class="mag">🔍</span><input placeholder="Booking id, phone, lead guest, invoice…"></div>
        <select class="select"><option>All boats</option><option>Jol Kolol</option><option>Haor Bilash</option></select>
        <select class="select"><option>Any status</option><option>customer_due</option><option>paid</option><option>payment_verified</option><option>in_payout</option><option>bill_cleared</option><option>cancelled</option><option>refund_*</option></select>
      </div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Booking</th><th>Boat · departure</th><th>Lead guest</th><th>Invoice status</th><th class="num">Display total</th><th></th></tr></thead>
        <tbody>
          <tr><td><div class="t1">#BK-8f3a</div><div class="t2">cabin · 2 rooms</div></td><td><div>Jol Kolol</div><div class="t2">24 Jul · 2d1n</div></td><td>Tanvir Hasan<div class="t2">+8801711002200</div></td><td><span class="pill ok">payment_verified</span></td><td class="num">৳ 9,162</td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>Open</button></td></tr>
          <tr><td><div class="t1">#BK-71c0</div><div class="t2">group · 18 pax</div></td><td><div>Haor Bilash</div><div class="t2">25 Jul · 1d</div></td><td>Sadia Rahman<div class="t2">+8801822114455</div></td><td><span class="pill blue lock">in_payout</span></td><td class="num">৳ 1,50,000</td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>Open</button></td></tr>
          <tr><td><div class="t1">#BK-6a29</div><div class="t2">cabin · open seat</div></td><td><div>Jol Kolol</div><div class="t2">28 Jul · 2d1n</div></td><td>Imran Kabir<div class="t2">+8801933220011</div></td><td><span class="pill amb">customer_due</span></td><td class="num">৳ 10,180</td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>Open</button></td></tr>
          <tr><td><div class="t1">#BK-5d14</div><div class="t2">cabin</div></td><td><div>Bhela</div><div class="t2">20 Jul · 1d</div></td><td>Farhana Islam<div class="t2">+8801700889900</div></td><td><span class="pill danger">refund_requested</span></td><td class="num">৳ 7,200</td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>Open</button></td></tr>
          <tr><td><div class="t1">#BK-4b02</div><div class="t2">cabin</div></td><td><div>Haor Bilash</div><div class="t2">12 Jul · 2d1n</div></td><td>Mahin Chowdhury<div class="t2">+8801600445566</div></td><td><span class="pill mut">bill_cleared</span></td><td class="num">৳ 18,340</td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>Open</button></td></tr>
        </tbody>
      </table></div></div></div>

      <div class="drawer-sc" id="drawerScrim"></div>
      <aside class="drawer" id="drawer">
        <div class="dh"><h3>#BK-8f3a · invoice</h3><button class="x" data-drawer-close>✕</button></div>
        <div class="db stack" style="gap:16px">
          <span class="pill ok">payment_verified</span>
          <div>
            <h4 style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:8px">Bill breakdown (fixed order)</h4>
            <dl class="kv">
              <dt>Room total</dt><dd class="money">৳ 10,000</dd>
              <dt>+ Gateway fee (1.8%)</dt><dd class="money">৳ 180</dd>
              <dt>= Price shown</dt><dd class="money">৳ 10,180</dd>
              <dt>− Coupon (10%)</dt><dd class="money neg">−৳ 1,018</dd>
              <dt>= Customer pays</dt><dd class="money">৳ 9,162</dd>
              <dt>Commission (5% of room)</dt><dd class="money">৳ 500</dd>
              <dt>Due to boat</dt><dd class="money">৳ 8,482</dd>
            </dl>
          </div>
          <div class="note info"><span class="ic">ℹ</span> Commission is on the original room total, not the discounted amount — the boat absorbs its own coupon.</div>
        </div>
        <div class="df"><button class="btn btn-o">Reschedule</button><button class="btn btn-danger">Cancel trip</button></div>
      </aside>
`},

{ key:'reviews', out:'admin-reviews.html', title:'Reviews', crumb:'Moderation', body:`
      <div class="page-head">
        <div><h1>Reviews moderation</h1><p>Reviews come only from verified, completed bookings. Hide abuse; the eligibility gate blocks fakes at the source.</p></div>
      </div>
      <div class="filterbar">
        <div class="seg"><button class="seg-b on">All<span class="ct">214</span></button><button class="seg-b">Flagged<span class="ct">3</span></button><button class="seg-b">Hidden<span class="ct">1</span></button><button class="seg-b">No reply<span class="ct">40</span></button></div>
        <div class="search"><span class="mag">🔍</span><input placeholder="Search text or boat…"></div>
      </div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Boat</th><th>Rating</th><th>Review</th><th>Owner reply</th><th></th></tr></thead>
        <tbody>
          <tr><td class="t1">Jol Kolol</td><td><span style="color:var(--amber)">★★★★★</span></td><td>Crew was fantastic, sunrise over the haor was unreal.<div class="t2">Tanvir H. · verified</div></td><td class="t2">Thank you!</td><td class="rowact"><button class="btn btn-sm btn-o">Hide</button></td></tr>
          <tr><td class="t1">Haor Bilash</td><td><span style="color:var(--amber)">★★★★</span>☆</td><td>Good food, cabin AC was weak on day 2.<div class="t2">Sadia R. · verified</div></td><td class="t2">—</td><td class="rowact"><button class="btn btn-sm btn-o">Hide</button></td></tr>
          <tr><td class="t1">Bhela</td><td><span style="color:var(--amber)">★</span>☆☆☆☆</td><td>Contact me on WhatsApp 013… for cheaper direct booking.<div class="t2"><span class="pill danger">flagged · spam</span></div></td><td class="t2">—</td><td class="rowact"><button class="btn btn-sm btn-danger">Take down</button></td></tr>
          <tr><td class="t1">Meghduar</td><td><span style="color:var(--amber)">★★★★★</span></td><td>Best trip of the year. Highly recommend the upper deck.<div class="t2">Imran K. · verified</div></td><td class="t2">🙏</td><td class="rowact"><button class="btn btn-sm btn-o">Hide</button></td></tr>
        </tbody>
      </table></div></div></div>
`},

{ key:'accounts', out:'admin-accounts.html', title:'Accounts', crumb:'Customer support', body:`
      <div class="page-head">
        <div><h1>Account support</h1><p>One login per person. A single account can be a customer, an owner and crew at once — identity derives from relations, not a type field.</p></div>
      </div>
      <div class="filterbar"><div class="search" style="max-width:420px"><span class="mag">🔍</span><input placeholder="Search phone, name or email…" value="+88017110"></div></div>
      <div class="grid-2">
        <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Account</th><th>Phone</th><th>Verified</th><th>Roles</th><th></th></tr></thead>
          <tbody>
            <tr><td class="t1">Tanvir Hasan</td><td class="t2">+8801711002200</td><td><span class="pill ok">verified</span></td><td class="t2">customer</td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>Open</button></td></tr>
            <tr><td class="t1">Kamrul Owner</td><td class="t2">+8801711554433</td><td><span class="pill ok">verified</span></td><td class="t2">owner ×2 · crew ×1</td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>Open</button></td></tr>
            <tr><td class="t1">Rina Akter</td><td class="t2">+8801711778899</td><td><span class="pill warn">pending</span></td><td class="t2">customer</td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>Open</button></td></tr>
          </tbody>
        </table></div></div></div>
        <div class="card2">
          <div class="ch"><h3>Kamrul Owner</h3><span class="pill ok">verified</span></div>
          <div class="cb stack" style="gap:14px">
            <dl class="kv"><dt>Phone</dt><dd>+8801711554433</dd><dt>Email</dt><dd>kamrul@example.com</dd><dt>Joined</dt><dd>Mar 2026</dd></dl>
            <div>
              <h4 style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:8px">Boat access</h4>
              <table class="tbl" style="min-width:0"><tbody>
                <tr><td class="t1">Jol Kolol</td><td><span class="pill blue">Owner</span></td></tr>
                <tr><td class="t1">Haor Bilash</td><td><span class="pill mut">Manager (restricted)</span></td></tr>
                <tr><td class="t1">Meghduar</td><td><span class="pill amb">Crew · sukani</span></td></tr>
              </tbody></table>
            </div>
            <div class="acts" style="display:flex;gap:10px"><button class="btn btn-o">Resend verification</button><button class="btn btn-o">Force-verify phone</button></div>
          </div>
        </div>
      </div>
      <div class="drawer-sc" id="drawerScrim"></div>
      <aside class="drawer" id="drawer"><div class="dh"><h3>Account</h3><button class="x" data-drawer-close>✕</button></div><div class="db"><p class="muted">Full account detail — cross-boat roles, verification, booking history.</p></div><div class="df"><button class="btn btn-o" data-drawer-close>Close</button></div></aside>
`},

{ key:'memberships', out:'admin-memberships.html', title:'Memberships', crumb:'Co-owner oversight', body:`
      <div class="page-head">
        <div><h1>Membership oversight</h1><p>Per-boat co-owners for dispute support. An exited shareholder keeps read access to their own period only. Distributions are recorded, never auto-split.</p></div>
        <div class="acts"><select class="select"><option>Jol Kolol</option><option>Haor Bilash</option></select></div>
      </div>
      <div class="grid-2">
        <div class="card2"><div class="ch"><h3>Members · Jol Kolol</h3></div><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Member</th><th>Role</th><th class="num">Share</th><th>Period</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td class="t1">Kamrul Owner</td><td><span class="pill blue">Owner</span></td><td class="num">50%</td><td class="t2">since Mar 26</td><td><span class="pill ok">active</span></td></tr>
            <tr><td class="t1">Selim Mia</td><td><span class="pill mut">Shareholder</span></td><td class="num">30%</td><td class="t2">since Mar 26</td><td><span class="pill ok">active</span></td></tr>
            <tr><td class="t1">Jahid Uddin</td><td><span class="pill mut">Shareholder</span></td><td class="num">20%</td><td class="t2">Mar–Jun 26</td><td><span class="pill warn">exited · read-only</span></td></tr>
          </tbody>
        </table></div></div></div>
        <div class="card2"><div class="ch"><h3>Distributions</h3><span class="sub">recorded withdrawals</span></div><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Member</th><th class="num">Amount</th><th>Note</th><th class="num">Date</th></tr></thead>
          <tbody>
            <tr><td class="t1">Kamrul Owner</td><td class="num">৳ 1,20,000</td><td class="t2">Jun profit</td><td class="num">30 Jun</td></tr>
            <tr><td class="t1">Selim Mia</td><td class="num">৳ 72,000</td><td class="t2">Jun profit</td><td class="num">30 Jun</td></tr>
            <tr><td class="t1">Jahid Uddin</td><td class="num">৳ 48,000</td><td class="t2">exit settlement</td><td class="num">30 Jun</td></tr>
          </tbody>
        </table></div></div></div>
      </div>
`},

{ key:'waitlist', out:'admin-waitlist.html', title:'Waitlist', crumb:'Availability monitor', body:`
      <div class="page-head">
        <div><h1>Waitlist &amp; availability</h1><p>When a cabin frees, all waitlisted customers are notified at once — first to hold wins. Watch for <code>available_count</code> drift against the real held/booked count.</p></div>
        <div class="acts"><button class="btn btn-o">↻ Recompute all counts</button></div>
      </div>
      <div class="kpis">
        <div class="kpi"><div class="l">Waitlisted (all)</div><div class="n">37</div><div class="d">across 9 departures</div></div>
        <div class="kpi"><div class="l">Last notify-all</div><div class="n">12</div><div class="d">sent 17:41 · Jol Kolol</div></div>
        <div class="kpi alert"><div class="l">Count drift</div><div class="n">1</div><div class="d down">1 departure off by 1</div></div>
      </div>
      <div class="card2"><div class="ch"><h3>Departures</h3><span class="sub">denormalized vs recomputed availability</span></div><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Departure</th><th class="num">Waitlist</th><th class="num">avail (stored)</th><th class="num">avail (recomputed)</th><th>Status</th><th></th></tr></thead>
        <tbody>
          <tr><td><div class="t1">Jol Kolol · 24 Jul</div><div class="t2">2d1n</div></td><td class="num">12</td><td class="num">0</td><td class="num">0</td><td><span class="pill ok">in sync</span></td><td class="rowact"><button class="btn btn-sm btn-o">Recompute</button></td></tr>
          <tr><td><div class="t1">Haor Bilash · 25 Jul</div><div class="t2">1d</div></td><td class="num">8</td><td class="num">3</td><td class="num neg">2</td><td><span class="pill danger">drift −1</span></td><td class="rowact"><button class="btn btn-sm btn-b">Reconcile</button></td></tr>
          <tr><td><div class="t1">Meghduar · 28 Jul</div><div class="t2">2d1n</div></td><td class="num">5</td><td class="num">4</td><td class="num">4</td><td><span class="pill ok">in sync</span></td><td class="rowact"><button class="btn btn-sm btn-o">Recompute</button></td></tr>
        </tbody>
      </table></div></div></div>
`},

];
