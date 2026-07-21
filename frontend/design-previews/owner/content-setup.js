/* eslint-disable */
// Boat setup group: profile, cabins, coupons
module.exports = [

{ key:'profile', out:'owner-profile.html', title:'Boat profile', crumb:'Jol Kolol · setup', body:`
      <div class="page-head">
        <div><h1>Boat profile</h1><p>Your profile must hit 100% <b>and</b> a bank account must be on file before the platform can approve the boat to go live. A bank account is mandatory before any payout runs.</p></div>
        <div class="acts"><span class="pill ok">live · approved</span></div>
      </div>
      <div class="grid-2">
        <div class="stack">
          <div class="card2"><div class="ch"><h3>Basics</h3><a class="btn btn-sm btn-o" href="#">Edit</a></div><div class="cb">
            <div class="form-grid">
              <div class="field"><label>Name</label><input value="Jol Kolol" readonly></div>
              <div class="field"><label>Public URL</label><input value="/houseboat/jol-kolol" readonly></div>
            </div>
            <div class="field" style="margin-top:14px"><label>Description</label><input value="Premium houseboat on Tanguar Haor — 8 cabins, 6 crew." readonly></div>
            <div class="form-grid" style="margin-top:14px">
              <div class="field"><label>Safety features</label><input value="Life jackets, fire extinguisher, first aid" readonly></div>
              <div class="field"><label>Food menu</label><input value="Local Bengali, BBQ, veg on request" readonly></div>
            </div>
          </div></div>

          <div class="card2"><div class="ch"><h3>Routes</h3><span class="sub">pick from platform-curated routes</span></div><div class="cb">
            <div style="display:flex;gap:8px;flex-wrap:wrap"><span class="pill blue">Tanguar Haor ✓</span><span class="pill mut">Nikli Haor</span><span class="pill mut">＋ add route</span></div>
            <div class="note info" style="margin-top:14px"><span class="ic">ℹ️</span> You can't create routes — only the platform curates them. Ask an admin to add a new haor.</div>
          </div></div>

          <div class="card2"><div class="ch"><h3>Cancellation policy</h3><a class="btn btn-sm btn-o" href="#">Edit</a></div><div class="cb">
            <div class="filterbar" style="margin-bottom:12px"><div class="seg"><button class="seg-b">Flexible</button><button class="seg-b on">Moderate</button><button class="seg-b">Strict</button><button class="seg-b">Non-refundable</button><button class="seg-b">Custom</button></div></div>
            <div class="tbl-wrap"><table class="tbl" style="min-width:0"><thead><tr><th>Days before</th><th class="num">Refund</th><th>Blackout</th></tr></thead><tbody>
              <tr><td>7+ days</td><td class="num">100%</td><td>—</td></tr>
              <tr><td>3–6 days</td><td class="num">50%</td><td>—</td></tr>
              <tr><td>&lt; 3 days</td><td class="num">0%</td><td>—</td></tr>
              <tr><td class="t1">Eid / festivals</td><td class="num neg">0%</td><td><span class="pill danger">blackout</span></td></tr>
            </tbody></table></div>
            <div class="note warn" style="margin-top:12px"><span class="ic">⚠️</span> The policy shown at checkout is <b>stamped onto the invoice</b>. Disputes cite what the guest agreed that day — not your current policy.</div>
          </div></div>
        </div>

        <div class="stack">
          <div class="card2"><div class="ch"><h3>Completion</h3></div><div class="cb">
            <div style="font-size:34px;font-weight:900;font-family:var(--mono);color:var(--ok);letter-spacing:-.03em">100%</div>
            <div style="height:8px;background:var(--bg-2);border-radius:999px;overflow:hidden;margin:10px 0 14px"><div style="width:100%;height:100%;background:var(--ok)"></div></div>
            <div class="stack" style="gap:8px">
              <div class="note ok" style="padding:9px 12px"><span class="ic">✓</span> Basics, cabins, pricing, policy</div>
              <div class="note ok" style="padding:9px 12px"><span class="ic">✓</span> Bank account on file</div>
            </div>
          </div></div>

          <div class="card2"><div class="ch"><h3>Bank account</h3><a class="btn btn-sm btn-o" href="#">Edit</a></div><div class="cb">
            <dl class="kv"><dt>Bank</dt><dd>City Bank</dd><dt>Account</dt><dd>••••4821</dd><dt>Holder</dt><dd>Kamal Uddin</dd></dl>
            <div class="note info" style="margin-top:12px"><span class="ic">🔒</span> Payouts transfer here. Required before the boat can go live.</div>
          </div></div>

          <div class="card2"><div class="ch"><h3>Child policy</h3><a class="btn btn-sm btn-o" href="#">Edit</a></div><div class="cb">
            <div class="tbl-wrap"><table class="tbl" style="min-width:0"><tbody>
              <tr><td>0 – 3 yrs</td><td class="num">free</td></tr>
              <tr><td>3 – 5 yrs</td><td class="num">50%</td></tr>
              <tr><td>5+ yrs</td><td class="num">full</td></tr>
            </tbody></table></div>
          </div></div>

          <div class="card2"><div class="ch"><h3>Operating dates</h3><a class="btn btn-sm btn-o" href="owner-calendar.html">Calendar</a></div><div class="cb">
            <p class="muted" style="margin:0;font-size:13px">Only these dates generate bookable departures. 22 dates set in Jul–Sep.</p>
          </div></div>
        </div>
      </div>
`},

{ key:'cabins', out:'owner-cabins.html', title:'Decks & cabins', crumb:'Jol Kolol · layout', body:`
      <div class="page-head">
        <div><h1>Decks & cabins</h1><p>Categories set capacity and facilities. Cabins sit on an auto-generated grid — it's a simple layout, not a positioning builder.</p></div>
        <div class="acts"><a class="btn btn-o" href="#">＋ Category</a><a class="btn btn-b" href="#">＋ Cabin</a></div>
      </div>
      <div class="card2" style="margin-bottom:20px"><div class="ch"><h3>Cabin categories</h3></div>
        <div class="cb flush"><div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Category</th><th>AC</th><th class="num">Base cap</th><th class="num">Extended</th><th>Facilities</th><th></th></tr></thead>
          <tbody>
            <tr><td class="t1">Family (non-AC)</td><td><span class="pill mut">no</span></td><td class="num">3</td><td class="num">4</td><td class="t2">Fan, attached bath, window</td><td class="rowact"><a class="btn btn-sm btn-o" href="#">Edit</a></td></tr>
            <tr><td class="t1">Luxury AC</td><td><span class="pill blue">AC</span></td><td class="num">2</td><td class="num">3</td><td class="t2">AC, high commode, balcony</td><td class="rowact"><a class="btn btn-sm btn-o" href="#">Edit</a></td></tr>
          </tbody>
        </table></div></div>
      </div>
      <div class="grid-2">
        <div class="card2"><div class="ch"><h3>Lower deck</h3><span class="sub">4 cabins</span></div><div class="cb"><div class="cabgrid">
          <div class="cab"><div class="cn">101</div><div class="cc">Family</div></div>
          <div class="cab"><div class="cn">102</div><div class="cc">Family</div></div>
          <div class="cab"><div class="cn">103</div><div class="cc">Family</div></div>
          <div class="cab"><div class="cn">104</div><div class="cc">Family</div></div>
        </div></div></div>
        <div class="card2"><div class="ch"><h3>Upper deck</h3><span class="sub">4 cabins</span></div><div class="cb"><div class="cabgrid">
          <div class="cab"><div class="cn">201</div><div class="cc">Luxury AC</div></div>
          <div class="cab"><div class="cn">202</div><div class="cc">Luxury AC</div></div>
          <div class="cab"><div class="cn">203</div><div class="cc">Luxury AC</div></div>
          <div class="cab"><div class="cn">204</div><div class="cc">Luxury AC</div></div>
        </div></div></div>
      </div>
`},

{ key:'coupons', out:'owner-coupons.html', title:'Coupons', crumb:'Jol Kolol · discounts', body:`
      <div class="page-head">
        <div><h1>Coupons</h1><p>Your coupon comes off the price the customer sees — and you absorb the full cost. Commission is charged on the original room price regardless, so a discount never touches what the platform earns.</p></div>
        <div class="acts"><a class="btn btn-b" href="#">＋ New coupon</a></div>
      </div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Code</th><th>Kind</th><th class="num">Value</th><th>Valid</th><th>Used</th><th>Status</th><th></th></tr></thead>
        <tbody>
          <tr><td class="t1">MONSOON10</td><td><span class="pill blue">percent</span></td><td class="num">10%</td><td class="t2">1 Jul – 31 Aug</td><td>34</td><td><span class="pill ok">active</span></td><td class="rowact"><a class="btn btn-sm btn-o" href="#">Edit</a></td></tr>
          <tr><td class="t1">FLAT500</td><td><span class="pill amb">flat</span></td><td class="num">৳500</td><td class="t2">15 Jul – 15 Aug</td><td>12</td><td><span class="pill ok">active</span></td><td class="rowact"><a class="btn btn-sm btn-o" href="#">Edit</a></td></tr>
          <tr><td class="t1">FRIEND</td><td><span class="pill blue">referral</span></td><td class="num">5%</td><td class="t2">ongoing</td><td>7</td><td><span class="pill ok">active</span></td><td class="rowact"><a class="btn btn-sm btn-o" href="#">Edit</a></td></tr>
          <tr><td class="t1">EIDSPECIAL</td><td><span class="pill blue">percent</span></td><td class="num">15%</td><td class="t2">expired 20 Jun</td><td>58</td><td><span class="pill mut">expired</span></td><td class="rowact"><a class="btn btn-sm btn-o" href="#">Renew</a></td></tr>
        </tbody>
      </table></div></div></div>
      <div class="note info" style="margin-top:16px"><span class="ic">ℹ️</span> Coupon applies <b>last</b>, to the shown price (after gateway fee). Worked example: ৳10,180 shown → 10% off → guest pays ৳9,162, but commission is still 5% of ৳10,000.</div>
`},

];
