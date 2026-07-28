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
      <aside class="drawer wide" id="drawer">
        <div class="dh"><h3>Meghduar · boat record</h3><button class="x" data-drawer-close>✕</button></div>
        <div class="db">

          <div class="dsec">
            <h4>Status</h4>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><span class="pill warn">pending approval</span><span class="pill ok">profile 100%</span><span class="pill ok">bank on file</span></div>
            <div class="note ok"><span class="ic">✓</span> Go-live checklist met — profile complete and a bank account is on file.</div>
          </div>

          <div class="dsec">
            <h4>Profile</h4>
            <dl class="kv">
              <dt>Name</dt><dd>Meghduar</dd>
              <dt>Public URL</dt><dd>/houseboat/meghduar</dd>
              <dt>Status</dt><dd>pending</dd>
              <dt>Profile complete</dt><dd>100%</dd>
              <dt>Created</dt><dd>02 Jun 2026</dd>
            </dl>
            <p class="prose" style="margin-top:10px"><b>Description:</b> A two-deck houseboat built for Tanguar Haor sunrises, with an open upper deck and eight cabins.</p>
            <p class="prose" style="margin-top:8px"><b>Safety:</b> 24 life jackets, 2 life buoys, fire extinguisher, first-aid kit, licensed sukani.</p>
            <p class="prose" style="margin-top:8px"><b>Food menu:</b> Welcome tea · BBQ dinner · hilsa lunch · breakfast khichuri. Vegetarian on request.</p>
          </div>

          <div class="dsec">
            <h4>Bank &amp; billing</h4>
            <dl class="kv">
              <dt>Bank account</dt><dd>City Bank ••4821</dd>
              <dt>Account name</dt><dd>Meghduar Houseboat</dd>
              <dt>Commission</dt><dd>5.0%</dd>
              <dt>Gateway fee</dt><dd>1.8%</dd>
              <dt>Monthly fee</dt><dd>৳ 5,000</dd>
              <dt>Trial ends</dt><dd>24 Jul 2026</dd>
              <dt>Platform balance</dt><dd>৳ 0</dd>
            </dl>
          </div>

          <div class="dsec">
            <h4>Routes</h4>
            <div style="display:flex;gap:8px;flex-wrap:wrap"><span class="tag">Tanguar Haor · Sunamganj</span><span class="tag">Tahirpur · Sunamganj</span></div>
          </div>

          <div class="dsec">
            <h4>Decks &amp; cabins</h4>
            <table class="mini">
              <thead><tr><th>Cabin</th><th>Deck</th><th>Category</th><th>AC</th><th>Capacity</th></tr></thead>
              <tbody>
                <tr><td class="t1">101</td><td>Lower</td><td>Luxury AC</td><td>Yes</td><td>2 (ext 3)</td></tr>
                <tr><td class="t1">102</td><td>Lower</td><td>Luxury AC</td><td>Yes</td><td>2 (ext 3)</td></tr>
                <tr><td class="t1">103</td><td>Lower</td><td>Family</td><td>Yes</td><td>4 (ext 5)</td></tr>
                <tr><td class="t1">201</td><td>Upper</td><td>Family</td><td>No</td><td>4 (ext 5)</td></tr>
              </tbody>
            </table>
            <p class="prose" style="margin-top:8px"><b>Categories:</b> Luxury AC — attached bath, balcony · Family — attached bath, twin bunk. 2 decks · 8 cabins total.</p>
          </div>

          <div class="dsec">
            <h4>Trip packages</h4>
            <table class="mini">
              <thead><tr><th>Package</th><th>Duration</th><th>Departure → return</th><th>Policy</th></tr></thead>
              <tbody>
                <tr><td class="t1">Tanguar 2D1N</td><td>2 days 1 night</td><td>Tahirpur → Tahirpur</td><td>Moderate</td></tr>
                <tr><td class="t1">Tanguar day trip</td><td>1 day</td><td>Tahirpur → Tahirpur</td><td>Moderate</td></tr>
              </tbody>
            </table>
            <p class="prose" style="margin-top:8px"><b>Included:</b> all meals, guide, life jackets. <b>Excluded:</b> personal expenses, entry fees.</p>
          </div>

          <div class="dsec">
            <h4>Pricing</h4>
            <table class="mini">
              <thead><tr><th>Profile</th><th>Category</th><th>Occupancy</th><th class="num">Per person</th></tr></thead>
              <tbody>
                <tr><td class="t1">General Day</td><td>Luxury AC</td><td>2</td><td class="num">৳ 5,000</td></tr>
                <tr><td class="t1">General Day</td><td>Family</td><td>4</td><td class="num">৳ 4,200</td></tr>
                <tr><td class="t1">Eid</td><td>Luxury AC</td><td>2</td><td class="num">৳ 7,600</td></tr>
                <tr><td class="t1">Full Moon</td><td>Luxury AC</td><td>2</td><td class="num">৳ 6,400</td></tr>
              </tbody>
            </table>
            <p class="prose" style="margin-top:8px"><b>Group bands:</b> 15–20 people ৳150,000 · 21–28 people ৳195,000 (full-boat buyout).</p>
          </div>

          <div class="dsec">
            <h4>Cancellation policy</h4>
            <dl class="kv">
              <dt>Template</dt><dd>Moderate</dd>
              <dt>Deposit</dt><dd>30%</dd>
              <dt>Shown at checkout</dt><dd>Yes</dd>
              <dt>Tiers</dt><dd>&gt;7 days 50% · &lt;7 days 0%</dd>
              <dt>Blackout</dt><dd>Eid 0% · Full moon 0%</dd>
            </dl>
            <div class="note info" style="margin-top:10px"><span class="ic">ℹ</span> Blackout dates are set per boat by the owner. The platform reviews them here but does not edit.</div>
          </div>

          <div class="dsec">
            <h4>Operating dates</h4>
            <p class="prose">Jul 2026 — 18, 19, 20, 21, 24, 25, 26, 28, 31 · Aug 2026 — 01, 02, 05, 08, 09. Only these dates generate bookable departures.</p>
          </div>

          <div class="dsec">
            <h4>Crew</h4>
            <table class="mini">
              <thead><tr><th>Name</th><th>Role</th><th>Pay</th><th>Default crew</th></tr></thead>
              <tbody>
                <tr><td class="t1">Abdul Karim</td><td>Sukani</td><td>৳ 1,200 / trip</td><td>Yes</td></tr>
                <tr><td class="t1">Rustom Ali</td><td>Cook</td><td>৳ 900 / trip</td><td>Yes</td></tr>
                <tr><td class="t1">Jamal Hossain</td><td>Helper</td><td>৳ 12,000 / month</td><td>Yes</td></tr>
              </tbody>
            </table>
          </div>

          <div class="dsec">
            <h4>Members &amp; shareholders</h4>
            <table class="mini">
              <thead><tr><th>Member</th><th>Role</th><th class="num">Share</th><th>Status</th></tr></thead>
              <tbody>
                <tr><td class="t1">Shahin Alam</td><td>Owner</td><td class="num">60%</td><td>active</td></tr>
                <tr><td class="t1">Nazmul Haque</td><td>Shareholder</td><td class="num">40%</td><td>active</td></tr>
              </tbody>
            </table>
          </div>

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
            <tr><td class="t1">Tanvir Hasan</td><td class="t2">+8801711002200</td><td><span class="pill ok">verified</span></td><td class="t2">customer</td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>Open</button><button class="btn btn-sm btn-danger">Remove</button></td></tr>
            <tr><td class="t1">Kamrul Owner</td><td class="t2">+8801711554433</td><td><span class="pill ok">verified</span></td><td class="t2">owner ×2 · crew ×1</td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>Open</button><button class="btn btn-sm btn-danger">Remove</button></td></tr>
            <tr><td class="t1">Rina Akter</td><td class="t2">+8801711778899</td><td><span class="pill warn">pending</span></td><td class="t2">customer</td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>Open</button><button class="btn btn-sm btn-danger">Remove</button></td></tr>
            <tr><td class="t1">Sohel Rana</td><td class="t2">+8801711334455</td><td><span class="pill danger">access revoked</span></td><td class="t2">— (was manager)</td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>Open</button><button class="btn btn-sm btn-ok">Restore</button></td></tr>
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
            <div class="acts" style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-o">Resend verification</button><button class="btn btn-o">Force-verify phone</button><button class="btn btn-danger">Remove access</button></div>
            <div class="note warn"><span class="ic">⚑</span> Removing access revokes every boat role and blocks sign-in. The account and its booking history are kept for audit.</div>
          </div>
        </div>
      </div>
      <div class="drawer-sc" id="drawerScrim"></div>
      <aside class="drawer" id="drawer"><div class="dh"><h3>Account</h3><button class="x" data-drawer-close>✕</button></div><div class="db"><p class="muted">Full account detail — cross-boat roles, verification, booking history.</p></div><div class="df"><button class="btn btn-o" data-drawer-close>Close</button></div></aside>
`},

{ key:'memberships', out:'admin-memberships.html', title:'Memberships', crumb:'Co-owner oversight', body:`
      <div class="page-head">
        <div><h1>Membership oversight</h1><p>Per-boat co-owners for dispute support. An exited shareholder keeps read access to their own period only. Distributions are recorded, never auto-split.</p></div>
      </div>
      <div class="filterbar">
        <div class="search" style="max-width:320px"><span class="mag">🔍</span><input placeholder="Search by boat name…" value="Jol Kolol"></div>
        <select class="select"><option>All members</option><option>Active only</option><option>Exited only</option></select>
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
        <div class="card2">
          <div class="ch"><h3>Distributions</h3>
            <div style="display:flex;gap:8px">
              <select class="select" style="height:34px;font-size:12.5px"><option>Jun</option><option>Jul</option><option>All months</option></select>
              <select class="select" style="height:34px;font-size:12.5px"><option>2026</option><option>2025</option></select>
            </div>
          </div><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
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
        <div class="kpi"><div class="l"><span class="ic">⏳</span> Waitlisted (all)</div><div class="n">37</div><div class="d">across 9 departures</div></div>
        <div class="kpi"><div class="l"><span class="ic">📣</span> Last notify-all</div><div class="n">12</div><div class="d">sent 17:41 · Jol Kolol</div></div>
        <div class="kpi alert"><div class="l"><span class="ic">⚠</span> Count drift</div><div class="n">1</div><div class="d down">1 departure off by 1</div></div>
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
