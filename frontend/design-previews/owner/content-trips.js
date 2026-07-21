/* eslint-disable */
// Trips & pricing group: packages, schedule, pricing
module.exports = [

{ key:'packages', out:'owner-packages.html', title:'Packages', crumb:'Jol Kolol · trip packages', body:`
      <div class="page-head">
        <div><h1>Trip packages</h1><p>A package pairs a platform route with a duration and what's included. Duration is what shows on boat cards — not departure/arrival times. You pick routes; only the platform creates them.</p></div>
        <div class="acts"><a class="btn btn-b" href="#">＋ New package</a></div>
      </div>
      <div class="stack">
        <div class="card2">
          <div class="ch"><h3>Tanguar Haor · 2 days 1 night</h3><span class="sub"><span class="pill ok">active</span></span></div>
          <div class="cb grid-2" style="align-items:start">
            <dl class="kv">
              <dt>Route</dt><dd>Tanguar Haor</dd>
              <dt>Duration</dt><dd>2 days 1 night</dd>
              <dt>Departure ghat</dt><dd>Tahirpur</dd>
              <dt>Return ghat</dt><dd>Tahirpur</dd>
              <dt>Meals</dt><dd>4 meals + 2 snacks</dd>
              <dt>Cancellation policy</dt><dd>Moderate</dd>
            </dl>
            <div class="stack" style="gap:10px">
              <div><div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:6px">Included</div><div style="display:flex;gap:6px;flex-wrap:wrap"><span class="tag">Guide</span><span class="tag">Life jackets</span><span class="tag">Generator</span><span class="tag">BBQ night</span></div></div>
              <div><div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:6px">Excluded</div><div style="display:flex;gap:6px;flex-wrap:wrap"><span class="tag">Transport to ghat</span><span class="tag">Entry fees</span></div></div>
            </div>
          </div>
        </div>
        <div class="card2">
          <div class="ch"><h3>Tanguar Haor · Day trip</h3><span class="sub"><span class="pill ok">active</span></span></div>
          <div class="cb grid-2" style="align-items:start">
            <dl class="kv">
              <dt>Route</dt><dd>Tanguar Haor</dd>
              <dt>Duration</dt><dd>1 day</dd>
              <dt>Departure ghat</dt><dd>Tahirpur</dd>
              <dt>Return ghat</dt><dd>Tahirpur</dd>
              <dt>Meals</dt><dd>Lunch + snacks</dd>
              <dt>Cancellation policy</dt><dd>Flexible</dd>
            </dl>
            <div class="stack" style="gap:10px">
              <div><div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:6px">Included</div><div style="display:flex;gap:6px;flex-wrap:wrap"><span class="tag">Guide</span><span class="tag">Life jackets</span><span class="tag">Lunch</span></div></div>
            </div>
          </div>
        </div>
        <div class="card2" style="opacity:.7">
          <div class="ch"><h3>Nikli Haor · 2 days 1 night</h3><span class="sub"><span class="pill mut">draft</span></span></div>
          <div class="cb"><div class="note warn"><span class="ic">⚠️</span> Pricing profile not yet set for this route — customers can't see it until every headcount has a price.</div></div>
        </div>
      </div>
`},

{ key:'schedule', out:'owner-schedule.html', title:'Schedule', crumb:'Jol Kolol · departures', body:`
      <div class="page-head">
        <div><h1>Schedule</h1><p>Departures are generated from your operating dates. Multi-day trips must be booked on the <b>start date</b>. Status flips automatically as time passes — you never set it.</p></div>
        <div class="acts"><a class="btn btn-o" href="owner-calendar.html">Calendar view</a><a class="btn btn-b" href="#">＋ Generate departures</a></div>
      </div>
      <div class="filterbar">
        <div class="seg"><button class="seg-b on">Upcoming<span class="ct">11</span></button><button class="seg-b">In progress<span class="ct">1</span></button><button class="seg-b">Completed<span class="ct">42</span></button><button class="seg-b">Cancelled<span class="ct">2</span></button></div>
      </div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Start date</th><th>Package</th><th>Depart</th><th>Pricing profile</th><th class="num">Available</th><th>Status</th><th></th></tr></thead>
        <tbody>
          <tr><td><div class="t1">21 Jul</div><div class="t2">Tue</div></td><td>2D1N</td><td class="t2">07:30 → 22 Jul</td><td><span class="pill mut">General Day</span></td><td class="num">0 / 8</td><td><span class="pill blue">in progress</span></td><td class="rowact"><a class="btn btn-sm btn-o" href="owner-departure.html">Open</a></td></tr>
          <tr><td><div class="t1">21 Jul</div><div class="t2">Tue</div></td><td>Day trip</td><td class="t2">09:00</td><td><span class="pill mut">General Day</span></td><td class="num">2 / 8</td><td><span class="pill warn">boarding</span></td><td class="rowact"><a class="btn btn-sm btn-o" href="owner-departure.html">Open</a></td></tr>
          <tr><td><div class="t1">24 Jul</div><div class="t2">Fri</div></td><td>2D1N</td><td class="t2">07:30 → 25 Jul</td><td><span class="pill amb">Weekend</span></td><td class="num">5 / 8</td><td><span class="pill ok">scheduled</span></td><td class="rowact"><a class="btn btn-sm btn-o" href="#">Edit</a></td></tr>
          <tr><td><div class="t1">25 Jul</div><div class="t2">Sat</div></td><td>Day trip</td><td class="t2">09:00</td><td><span class="pill amb">Weekend</span></td><td class="num">6 / 8</td><td><span class="pill ok">scheduled</span></td><td class="rowact"><a class="btn btn-sm btn-o" href="#">Edit</a></td></tr>
          <tr><td><div class="t1">31 Jul</div><div class="t2">Fri</div></td><td>2D1N</td><td class="t2">07:30 → 1 Aug</td><td><span class="pill amb">Weekend</span></td><td class="num">8 / 8</td><td><span class="pill ok">scheduled</span></td><td class="rowact"><a class="btn btn-sm btn-o" href="#">Edit</a></td></tr>
        </tbody>
      </table></div></div></div>
      <div class="note info" style="margin-top:16px"><span class="ic">ℹ️</span> Availability is a stored count updated on every hold/release/booking — search is one lookup, never a recompute.</div>
`},

{ key:'pricing', out:'owner-pricing.html', title:'Pricing', crumb:'Jol Kolol · price tables', body:`
      <div class="page-head">
        <div><h1>Pricing</h1><p>You set every price directly — nothing is calculated. Each profile owns a full, independent table. A price must exist for every headcount a room holds, or customers can't book it.</p></div>
        <div class="acts"><a class="btn btn-o" href="#">Group bands</a><a class="btn btn-b" href="#">＋ New profile</a></div>
      </div>
      <div class="note warn" style="margin-bottom:16px"><span class="ic">⚠️</span> <b>Luxury AC · 4 people</b> has no price in the Eid profile — that room is hidden on Eid dates until you fill it.</div>
      <div class="filterbar">
        <div class="seg"><button class="seg-b on">General Day <span class="ct">default</span></button><button class="seg-b">Weekend</button><button class="seg-b">Eid <span class="ct">⚠</span></button><button class="seg-b">Full Moon</button></div>
        <span class="tag">applies to: all dates without a special profile</span>
      </div>
      <div class="card2"><div class="ch"><h3>General Day · price per person</h3><span class="sub">price varies by how many share the room</span></div>
        <div class="cb flush"><div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Cabin category</th><th class="num">1 person</th><th class="num">2 people</th><th class="num">3 people</th><th class="num">4 people</th></tr></thead>
          <tbody>
            <tr><td><div class="t1">Family (non-AC)</div><div class="t2">base 3 · ext 4</div></td><td class="num">৳5,000</td><td class="num">৳5,000</td><td class="num">৳4,580</td><td class="num">৳4,200</td></tr>
            <tr><td><div class="t1">Luxury AC</div><div class="t2">base 2 · ext 3</div></td><td class="num">৳9,000</td><td class="num">৳7,000</td><td class="num">৳6,400</td><td class="num warn">— add</td></tr>
          </tbody>
        </table></div></div>
      </div>
      <div class="card2" style="margin-top:20px"><div class="ch"><h3>Group price bands</h3><span class="sub">full-boat buyout · customer picks a band, types headcount</span></div>
        <div class="cb flush"><div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Band</th><th class="num">Total price</th><th></th></tr></thead>
          <tbody>
            <tr><td class="t1">10 – 14 people</td><td class="num">৳1,10,000</td><td class="rowact"><a class="btn btn-sm btn-o" href="#">Edit</a></td></tr>
            <tr><td class="t1">15 – 20 people</td><td class="num">৳1,50,000</td><td class="rowact"><a class="btn btn-sm btn-o" href="#">Edit</a></td></tr>
            <tr><td class="t1">21 – 24 people</td><td class="num">৳1,80,000</td><td class="rowact"><a class="btn btn-sm btn-o" href="#">Edit</a></td></tr>
          </tbody>
        </table></div></div>
      </div>
      <div class="note info" style="margin-top:16px"><span class="ic">ℹ️</span> Group bands show one total — no per-guest split. One person pays the whole amount. Reject if the typed headcount falls outside the band.</div>
`},

];
