/* eslint-disable */
// Bookings group: bookings, pos, departure, waitlist, quotes, reviews, guests
module.exports = [

{ key:'bookings', out:'owner-bookings.html', title:'Bookings', crumb:'Jol Kolol · all departures', body:`
      <div class="page-head">
        <div><h1>Bookings</h1><p>Every booking on this boat. A booking never reaches you for approval — payment succeeds, it confirms instantly. Tap a row for the invoice and bill breakdown.</p></div>
        <div class="acts"><a class="btn btn-b" href="owner-pos.html">🧾 New counter sale</a></div>
      </div>
      <div class="filterbar">
        <div class="seg"><button class="seg-b on">All<span class="ct">142</span></button><button class="seg-b">Confirmed<span class="ct">118</span></button><button class="seg-b">Rescheduled<span class="ct">6</span></button><button class="seg-b">Cancelled<span class="ct">9</span></button><button class="seg-b">Not arrived<span class="ct">3</span></button><button class="seg-b">Completed<span class="ct">86</span></button></div>
        <div class="search"><span class="mag">🔍</span><input placeholder="Search guest, phone, cabin…"></div>
      </div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Guest</th><th>Departure</th><th>Cabins</th><th>Type</th><th class="num">Pays</th><th>Status</th><th></th></tr></thead>
        <tbody>
          <tr><td><div class="t1">Farhana Akter</div><div class="t2">+8801711••2290 · POS</div></td><td><div class="t1">21 Jul · Day</div><div class="t2">Tanguar Haor</div></td><td>102 · 2 adults</td><td><span class="pill mut">cabin</span></td><td class="num">৳9,162</td><td><span class="pill warn">cash unverified</span></td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>Invoice</button></td></tr>
          <tr><td><div class="t1">Rakib Hasan</div><div class="t2">+8801915••7781</div></td><td><div class="t1">21 Jul · 2D1N</div><div class="t2">Tanguar Haor</div></td><td>201, 202 · 4 adults</td><td><span class="pill mut">cabin</span></td><td class="num">৳24,360</td><td><span class="pill ok">paid · verified</span></td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>Invoice</button></td></tr>
          <tr><td><div class="t1">Tanzila Group</div><div class="t2">+8801622••0043</div></td><td><div class="t1">24 Jul · 2D1N</div><div class="t2">Tanguar Haor</div></td><td>full boat · 16</td><td><span class="pill blue">group</span></td><td class="num">৳1,50,000</td><td><span class="pill ok">paid · verified</span></td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>Invoice</button></td></tr>
          <tr><td><div class="t1">Sabbir Ahmed</div><div class="t2">+8801777••1120</div></td><td><div class="t1">21 Jul · Day</div><div class="t2">Tanguar Haor</div></td><td>103 · 1 adult <span class="pill blue" style="font-size:10px">open seat</span></td><td><span class="pill mut">cabin</span></td><td class="num">৳3,054</td><td><span class="pill amb">advance · due ৳7,000</span></td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>Invoice</button></td></tr>
          <tr><td><div class="t1">Imran Khan</div><div class="t2">+8801811••9932</div></td><td><div class="t1">17 Jul · 2D1N</div><div class="t2">Tanguar Haor</div></td><td>101 · 2 adults</td><td><span class="pill mut">cabin</span></td><td class="num">৳9,162</td><td><span class="pill danger">cancelled</span></td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>Invoice</button></td></tr>
          <tr><td><div class="t1">Nadia Islam</div><div class="t2">+8801533••4417</div></td><td><div class="t1">11 Jul · Day</div><div class="t2">Tanguar Haor</div></td><td>104 · 3 adults</td><td><span class="pill mut">cabin</span></td><td class="num">৳13,740</td><td><span class="pill mut">completed</span></td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>Invoice</button></td></tr>
          <tr><td><div class="t1">Jahid Hossain</div><div class="t2">+8801399••2258</div></td><td><div class="t1">10 Jul → 24 Jul</div><div class="t2">rescheduled · reprice trail</div></td><td>202 · 2 adults</td><td><span class="pill mut">cabin</span></td><td class="num">৳9,162</td><td><span class="pill blue">rescheduled</span></td><td class="rowact"><button class="btn btn-sm btn-o" data-drawer>Invoice</button></td></tr>
        </tbody>
      </table></div></div></div>

      <div class="drawer-sc" id="drawerScrim"></div>
      <aside class="drawer" id="drawer">
        <div class="dh"><h3>Invoice · Farhana Akter</h3><button class="x" data-drawer-close>✕</button></div>
        <div class="db stack" style="gap:16px">
          <div style="display:flex;gap:8px;flex-wrap:wrap"><span class="pill warn">cash unverified</span><span class="pill mut">cabin</span><span class="pill blue">POS · booked by you</span></div>
          <div>
            <h4 style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:8px">Booking</h4>
            <dl class="kv">
              <dt>Departure</dt><dd>21 Jul · Day trip</dd>
              <dt>Cabin</dt><dd>102 · Family (non-AC)</dd>
              <dt>Headcount</dt><dd>2 adults</dd>
              <dt>Lead guest</dt><dd>Farhana Akter</dd>
              <dt>Reference</dt><dd>Walk-in</dd>
            </dl>
          </div>
          <div>
            <h4 style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:10px">Bill breakdown</h4>
            <div class="bill">
              <div class="row"><span class="lbl">Room total<span class="s">owner-set · 2 people</span></span><span class="val">৳10,000</span></div>
              <div class="row sub"><span class="lbl">+ Gateway fee (1.8%)</span><span class="val">৳180</span></div>
              <div class="row"><span class="lbl">Shown to customer</span><span class="val">৳10,180</span></div>
              <div class="row neg"><span class="lbl">− Coupon (10%)</span><span class="val">−৳1,018</span></div>
              <div class="row total"><span class="lbl">Customer pays</span><span class="val">৳9,162</span></div>
            </div>
            <div class="bill" style="margin-top:14px">
              <div class="row sub"><span class="lbl">Platform receives</span><span class="val">৳8,982</span></div>
              <div class="row neg"><span class="lbl">− Commission (5% of ৳10,000)</span><span class="val">−৳500</span></div>
              <div class="row total"><span class="lbl">You receive</span><span class="val">৳8,482</span></div>
            </div>
          </div>
          <div class="note info"><span class="ic">ℹ️</span> You absorb your own coupon — commission is 5% of the original ৳10,000, not the discounted price.</div>
        </div>
        <div class="df"><button class="btn btn-o" data-drawer-close>Close</button><a class="btn btn-b" href="owner-payments.html">Verify cash →</a></div>
      </aside>
`},

{ key:'pos', out:'owner-pos.html', title:'Counter sale', crumb:'Jol Kolol · POS mode', body:`
      <div class="page-head">
        <div><h1>Counter sale</h1><p>Sell a cabin at the ghat. Tap a room to take a live hold (10-min server-clocked expiry) — the same anti-double-booking path a customer uses. You are recorded as <b>booked by</b>.</p></div>
      </div>
      <div class="grid-2">
        <div class="card2">
          <div class="ch"><h3>Cabins · 21 Jul Day trip</h3><span class="sub">6 of 8 sold · 2 spare</span></div>
          <div class="cb">
            <div class="cabgrid">
              <div class="cab booked"><span class="st">sold</span><div class="cn">101</div><div class="cc">Family · 2p</div><div class="cp">৳10,000</div></div>
              <div class="cab booked"><span class="st">sold</span><div class="cn">102</div><div class="cc">Family · 2p</div><div class="cp">৳10,000</div></div>
              <div class="cab spare"><span class="st">1 spare</span><div class="cn">103</div><div class="cc">Family · open seat</div><div class="cp">৳5,000</div></div>
              <div class="cab booked"><span class="st">sold</span><div class="cn">104</div><div class="cc">Family · 3p</div><div class="cp">৳13,740</div></div>
              <div class="cab held"><span class="st">held 8:42</span><div class="cn">201</div><div class="cc">Luxury AC · 2p</div><div class="cp">৳14,000</div></div>
              <div class="cab free"><span class="st">free</span><div class="cn">202</div><div class="cc">Luxury AC · 2p</div><div class="cp">৳14,000</div></div>
              <div class="cab booked"><span class="st">sold</span><div class="cn">203</div><div class="cc">Luxury AC · 2p</div><div class="cp">৳14,000</div></div>
              <div class="cab free"><span class="st">free</span><div class="cn">204</div><div class="cc">Luxury AC · 2p</div><div class="cp">৳14,000</div></div>
            </div>
            <div class="note info" style="margin-top:14px"><span class="ic">⏱️</span> Hold on 201 expires in 8:42 — countdown runs off the <b>server</b> clock, never the device.</div>
          </div>
        </div>

        <div class="card2">
          <div class="ch"><h3>Cart · Cabin 201</h3></div>
          <div class="cb stack" style="gap:14px">
            <div class="form-grid">
              <div class="field"><label>Adults</label><input value="2"></div>
              <div class="field"><label>Children</label><input value="0"></div>
            </div>
            <div class="field"><label>Lead guest name</label><input placeholder="Full name"></div>
            <div class="field"><label>Phone</label><input placeholder="+8801…"></div>
            <div class="field"><label>Coupon code</label><input placeholder="optional"></div>
            <div class="field"><label>Reference name</label><input placeholder="who sent them · optional"></div>
            <div class="bill" style="border-top:1px solid var(--line);padding-top:12px">
              <div class="row"><span class="lbl">Room total · 2 people</span><span class="val">৳14,000</span></div>
              <div class="row sub"><span class="lbl">+ Gateway fee (1.8%)</span><span class="val">৳252</span></div>
              <div class="row total"><span class="lbl">Customer pays</span><span class="val">৳14,252</span></div>
            </div>
            <div class="form-grid">
              <button class="btn btn-o">Take deposit</button>
              <button class="btn btn-b">Full payment · cash</button>
            </div>
            <div class="note warn"><span class="ic">⚠️</span> Cash you take is verified by you as manager — it never runs through the gateway, so it stays out of the weekly payout.</div>
          </div>
        </div>
      </div>
`},

{ key:'departure', out:'owner-departure.html', title:'Departure', crumb:'Jol Kolol · 21 Jul · Day trip', body:`
      <div class="page-head">
        <div><h1>Departure · 21 Jul Day trip</h1><p>Tahirpur ghat · 09:00 · Tanguar Haor. One place to see the cabin grid, the day's manifest, and the crew actually aboard.</p></div>
        <div class="acts"><span class="pill warn">cutoff in 22 min</span><a class="btn btn-o" href="owner-pos.html">Sell a cabin</a></div>
      </div>
      <div class="kpis">
        <div class="kpi"><div class="l"><span class="ic">🚪</span> Cabins sold</div><div class="n">6 <span class="u">/ 8</span></div><div class="d">2 spare · 1 open seat</div></div>
        <div class="kpi"><div class="l"><span class="ic">👥</span> Guests aboard</div><div class="n">14</div><div class="d">manifest below</div></div>
        <div class="kpi"><div class="l"><span class="ic">⚓</span> Crew present</div><div class="n">5 <span class="u">/ 6</span></div><div class="d down">1 on leave</div></div>
        <div class="kpi"><div class="l"><span class="ic">৳</span> Booked value</div><div class="n"><span class="u">৳</span>62,400</div><div class="d">before cutoff</div></div>
      </div>
      <div class="grid-2">
        <div class="stack">
          <div class="card2">
            <div class="ch"><h3>Cabin grid</h3><span class="sub">held / sold / open seat / spare</span></div>
            <div class="cb"><div class="cabgrid">
              <div class="cab booked"><span class="st">sold</span><div class="cn">101</div><div class="cc">Rakib H · 2p</div></div>
              <div class="cab booked"><span class="st">sold</span><div class="cn">102</div><div class="cc">Farhana A · 2p</div></div>
              <div class="cab spare"><span class="st">1 spare</span><div class="cn">103</div><div class="cc">Sabbir A · open seat</div></div>
              <div class="cab booked"><span class="st">sold</span><div class="cn">104</div><div class="cc">Nadia I · 3p</div></div>
              <div class="cab held"><span class="st">held</span><div class="cn">201</div><div class="cc">counter · 8:42</div></div>
              <div class="cab free"><span class="st">free</span><div class="cn">202</div></div>
              <div class="cab booked"><span class="st">sold</span><div class="cn">203</div><div class="cc">Imran K · 2p</div></div>
              <div class="cab free"><span class="st">free</span><div class="cn">204</div></div>
            </div></div>
          </div>
          <div class="card2">
            <div class="ch"><h3>Manifest</h3><span class="sub">lead guest per cabin</span></div>
            <div class="cb flush"><div class="tbl-wrap"><table class="tbl">
              <thead><tr><th>Cabin</th><th>Lead guest</th><th>Phone</th><th>Heads</th><th>Paid</th></tr></thead>
              <tbody>
                <tr><td class="t1">101</td><td>Rakib Hasan</td><td class="t2">+8801915••7781</td><td>2</td><td><span class="pill ok">paid</span></td></tr>
                <tr><td class="t1">102</td><td>Farhana Akter</td><td class="t2">+8801711••2290</td><td>2</td><td><span class="pill warn">cash</span></td></tr>
                <tr><td class="t1">103</td><td>Sabbir Ahmed</td><td class="t2">+8801777••1120</td><td>1</td><td><span class="pill amb">advance</span></td></tr>
                <tr><td class="t1">104</td><td>Nadia Islam</td><td class="t2">+8801533••4417</td><td>3</td><td><span class="pill ok">paid</span></td></tr>
                <tr><td class="t1">203</td><td>Imran Khan</td><td class="t2">+8801811••9932</td><td>2</td><td><span class="pill ok">paid</span></td></tr>
              </tbody>
            </table></div></div>
          </div>
        </div>
        <div class="stack">
          <div class="card2">
            <div class="ch"><h3>Crew today</h3><a class="btn btn-sm btn-o" href="owner-attendance.html">Edit</a></div>
            <div class="cb flush"><div class="tbl-wrap"><table class="tbl" style="min-width:0">
              <tbody>
                <tr><td class="t1">Nur Islam</td><td class="t2">Manager</td><td><span class="pill ok">present</span></td></tr>
                <tr><td class="t1">Abdul Karim</td><td class="t2">Sukani</td><td><span class="pill ok">present</span></td></tr>
                <tr><td class="t1">Ripon Mia</td><td class="t2">Cook</td><td><span class="pill ok">present</span></td></tr>
                <tr><td class="t1">Sohel Rana</td><td class="t2">Helper</td><td><span class="pill ok">present</span></td></tr>
                <tr><td class="t1">Jamal Uddin</td><td class="t2">Helper</td><td><span class="pill ok">present</span></td></tr>
                <tr><td class="t1">Babul Hoq</td><td class="t2">Cleaner</td><td><span class="pill warn">on leave</span></td></tr>
              </tbody>
            </table></div></div>
          </div>
          <div class="card2">
            <div class="ch"><h3>Cutoff</h3></div>
            <div class="cb stack" style="gap:10px">
              <div class="note warn"><span class="ic">⛔</span> At 09:00 holds stop, then finalise a minute later. Whatever the invoice reads is final — unfilled open seats stay as buyout, nothing refunded.</div>
              <button class="btn btn-o" disabled>Finalise (auto at 09:01)</button>
            </div>
          </div>
        </div>
      </div>
`},

{ key:'waitlist', out:'owner-waitlist.html', title:'Waitlist', crumb:'Jol Kolol · by departure', body:`
      <div class="page-head">
        <div><h1>Waitlist</h1><p>When a cabin frees, <b>everyone</b> is notified at once — the link routes through a normal hold attempt, so first to hold wins. No queue positions.</p></div>
      </div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Departure</th><th>Waiting</th><th>Party sizes</th><th>Cabins free</th><th></th></tr></thead>
        <tbody>
          <tr><td><div class="t1">24 Jul · 2D1N</div><div class="t2">Tanguar Haor</div></td><td><b class="money">4</b></td><td class="t2">2, 2, 3, 4</td><td><span class="pill ok">1 just freed</span></td><td class="rowact"><button class="btn btn-sm btn-b">Notify all 4</button></td></tr>
          <tr><td><div class="t1">25 Jul · Day</div><div class="t2">Tanguar Haor</div></td><td><b class="money">2</b></td><td class="t2">2, 2</td><td><span class="pill mut">full</span></td><td class="rowact"><button class="btn btn-sm btn-o" disabled>Notify</button></td></tr>
          <tr><td><div class="t1">31 Jul · 2D1N</div><div class="t2">Tanguar Haor</div></td><td><b class="money">1</b></td><td class="t2">6 (group)</td><td><span class="pill ok">8 free</span></td><td class="rowact"><button class="btn btn-sm btn-b">Notify</button></td></tr>
        </tbody>
      </table></div></div></div>
      <div class="note info" style="margin-top:16px"><span class="ic">ℹ️</span> Hold attempts are rate-limited per cabin to absorb the click spike. Whoever loses the race sees "just taken" <b>before</b> entering details — never after paying.</div>
`},

{ key:'quotes', out:'owner-quotes.html', title:'Quotes', crumb:'Jol Kolol · quote requests', body:`
      <div class="page-head">
        <div><h1>Quote requests</h1><p>Custom / group enquiries you price by hand. A quote expires in 24 hours or when the date fills, whichever comes first.</p></div>
      </div>
      <div class="filterbar">
        <div class="seg"><button class="seg-b on">Requested<span class="ct">3</span></button><button class="seg-b">Sent<span class="ct">5</span></button><button class="seg-b">Accepted<span class="ct">2</span></button><button class="seg-b">Expired<span class="ct">4</span></button></div>
      </div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Customer</th><th>Date</th><th>Group</th><th>Special needs</th><th>Expires</th><th class="num">Quoted</th><th></th></tr></thead>
        <tbody>
          <tr><td><div class="t1">Tanzila Rahman</div><div class="t2">+8801622••0043</div></td><td class="t2">2 Aug</td><td>18</td><td class="t2">Veg meals, projector</td><td><span class="pill warn">4h left</span></td><td class="num">—</td><td class="rowact"><button class="btn btn-sm btn-b" data-drawer>Price it</button></td></tr>
          <tr><td><div class="t1">Corporate · bKash</div><div class="t2">+8801711••8890</div></td><td class="t2">9 Aug</td><td>24</td><td class="t2">Full boat, 2 nights</td><td><span class="pill warn">19h left</span></td><td class="num">—</td><td class="rowact"><button class="btn btn-sm btn-b" data-drawer>Price it</button></td></tr>
          <tr><td><div class="t1">Farid Family</div><div class="t2">+8801399••2211</div></td><td class="t2">15 Aug</td><td>12</td><td class="t2">Elderly, ground deck</td><td><span class="pill mut">22h left</span></td><td class="num">—</td><td class="rowact"><button class="btn btn-sm btn-b" data-drawer>Price it</button></td></tr>
        </tbody>
      </table></div></div></div>

      <div class="drawer-sc" id="drawerScrim"></div>
      <aside class="drawer" id="drawer">
        <div class="dh"><h3>Quote · Tanzila Rahman</h3><button class="x" data-drawer-close>✕</button></div>
        <div class="db stack" style="gap:16px">
          <span class="pill warn">expires in 4h</span>
          <dl class="kv">
            <dt>Date</dt><dd>2 Aug 2026</dd>
            <dt>Group size</dt><dd>18 people</dd>
            <dt>Special needs</dt><dd>Veg meals · projector</dd>
          </dl>
          <div class="field"><label>Quoted price (৳)</label><input placeholder="e.g. 150000"></div>
          <div class="note info"><span class="ic">ℹ️</span> Your group band 15–20 people is set at ৳1,50,000. Reject if headcount falls outside the band.</div>
        </div>
        <div class="df"><button class="btn btn-o" data-drawer-close>Cancel</button><button class="btn btn-b">Send quote</button></div>
      </aside>
`},

{ key:'reviews', out:'owner-reviews.html', title:'Reviews', crumb:'Jol Kolol · guest reviews', body:`
      <div class="page-head">
        <div><h1>Reviews</h1><p>Only guests with a verified completed booking can review. Reply publicly — replies show on your boat page.</p></div>
        <div class="acts"><span class="pill ok">4.7 ★ avg · 63 reviews</span></div>
      </div>
      <div class="stack" style="max-width:800px">
        ${reviewCard('Nadia Islam','5','11 Jul · Day trip','Crew was warm, food fresh, sunrise on the haor unreal. Cabin 104 spotless.','Thank you Nadia! Come back for a full-moon trip — sky is even better.')}
        ${reviewCard('Imran Khan','4','2D1N','Great trip overall. Generator was a bit loud at night in the AC cabin.',null)}
        ${reviewCard('Rakib Hasan','5','2D1N','Sukani knew every channel. Felt safe the whole way. Booking at the counter was quick.','Grateful, Rakib. Abdul has 20 years on Tanguar — glad it showed.')}
      </div>
`},

{ key:'guests', out:'owner-guests.html', title:'Guests', crumb:'Jol Kolol · guest directory', body:`
      <div class="page-head">
        <div><h1>Guest directory</h1><p>Everyone who has booked Jol Kolol — repeat guests, contact history, and any credit they hold toward a future trip.</p></div>
        <div class="acts"><div class="search"><span class="mag">🔍</span><input placeholder="Search name or phone…"></div></div>
      </div>
      <div class="kpis">
        <div class="kpi"><div class="l"><span class="ic">👥</span> Guests</div><div class="n">318</div><div class="d">unique accounts</div></div>
        <div class="kpi"><div class="l"><span class="ic">🔁</span> Repeat</div><div class="n">47</div><div class="d up">2+ bookings</div></div>
        <div class="kpi"><div class="l"><span class="ic">🎫</span> Credit held</div><div class="n"><span class="u">৳</span>18,400</div><div class="d">across 6 guests</div></div>
        <div class="kpi"><div class="l"><span class="ic">★</span> Reviewers</div><div class="n">63</div><div class="d">verified only</div></div>
      </div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Guest</th><th>Phone</th><th>Bookings</th><th>Last trip</th><th class="num">Lifetime</th><th>Credit</th></tr></thead>
        <tbody>
          <tr><td class="t1">Nadia Islam</td><td class="t2">+8801533••4417</td><td>4</td><td class="t2">11 Jul</td><td class="num">৳54,960</td><td><span class="pill mut">—</span></td></tr>
          <tr><td class="t1">Rakib Hasan</td><td class="t2">+8801915••7781</td><td>3</td><td class="t2">21 Jul</td><td class="num">৳48,320</td><td><span class="pill ok">৳2,000</span></td></tr>
          <tr><td class="t1">Imran Khan</td><td class="t2">+8801811••9932</td><td>2</td><td class="t2">17 Jul</td><td class="num">৳18,324</td><td><span class="pill mut">—</span></td></tr>
          <tr><td class="t1">Farhana Akter</td><td class="t2">+8801711••2290</td><td>1</td><td class="t2">21 Jul</td><td class="num">৳9,162</td><td><span class="pill mut">—</span></td></tr>
          <tr><td class="t1">Sabbir Ahmed</td><td class="t2">+8801777••1120</td><td>1</td><td class="t2">21 Jul</td><td class="num">৳3,054</td><td><span class="pill ok">৳4,000</span></td></tr>
        </tbody>
      </table></div></div></div>
`},

];

function reviewCard(name,stars,when,text,reply){
  const st = '★★★★★'.slice(0,stars) + '☆☆☆☆☆'.slice(0,5-stars);
  return `<div class="card2"><div class="cb stack" style="gap:12px">
    <div style="display:flex;align-items:center;gap:12px">
      <span class="whoami" style="border:none;padding:0"><span class="av" style="width:38px;height:38px">${name.split(' ').map(x=>x[0]).join('')}</span></span>
      <div><div class="t1" style="font-weight:800;color:var(--ink)">${name}</div><div class="t2" style="font-size:12px;color:var(--muted)">${when} · <span class="pill ok" style="font-size:10px">verified</span></div></div>
      <div style="margin-left:auto;color:var(--amber);font-size:16px;letter-spacing:2px">${st}</div>
    </div>
    <p style="margin:0;color:var(--body);font-size:14px;line-height:1.55">${text}</p>
    ${reply
      ? `<div style="background:var(--bg-2);border-left:3px solid var(--blue);border-radius:8px;padding:10px 14px"><div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--blue);margin-bottom:4px">Owner reply</div><p style="margin:0;font-size:13.5px;color:var(--body)">${reply}</p></div>`
      : `<div style="display:flex;gap:8px"><div class="field" style="flex:1"><label>Your reply</label><input placeholder="Reply publicly…"></div><button class="btn btn-b" style="align-self:flex-end">Post</button></div>`}
  </div></div>`;
}
