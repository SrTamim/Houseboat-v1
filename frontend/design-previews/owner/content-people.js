/* eslint-disable */
// People group: crew, attendance, payroll, team
module.exports = [

{ key:'crew', out:'owner-crew.html', title:'Crew', crumb:'Jol Kolol · staff roster', body:`
      <div class="page-head">
        <div><h1>Crew</h1><p>Your staff roster. A sukani isn't paid like a cleaner — each person has their own rate, per-trip or salaried. Your default crew is auto-assigned to every new departure.</p></div>
        <div class="acts"><a class="btn btn-b" href="#">＋ Add crew</a></div>
      </div>
      <div class="filterbar"><div class="seg"><button class="seg-b on">All<span class="ct">6</span></button><button class="seg-b">Per-trip<span class="ct">4</span></button><button class="seg-b">Salaried<span class="ct">2</span></button><button class="seg-b">Default crew<span class="ct">6</span></button></div></div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Name</th><th>Role</th><th>Pay type</th><th class="num">Rate</th><th>Emergency</th><th>Default</th><th></th></tr></thead>
        <tbody>
          <tr><td><div class="t1">Nur Islam</div><div class="t2">NID ••7742</div></td><td>Manager</td><td><span class="pill blue">salaried</span></td><td class="num">৳25,000/mo</td><td class="t2">+8801711••0090</td><td><span class="pill ok">yes</span></td><td class="rowact"><a class="btn btn-sm btn-o" href="#">Edit</a></td></tr>
          <tr><td><div class="t1">Abdul Karim</div><div class="t2">NID ••3318</div></td><td>Sukani</td><td><span class="pill amb">per-trip</span></td><td class="num">৳1,500/trip</td><td class="t2">+8801915••2231</td><td><span class="pill ok">yes</span></td><td class="rowact"><a class="btn btn-sm btn-o" href="#">Edit</a></td></tr>
          <tr><td><div class="t1">Ripon Mia</div><div class="t2">NID ••9021</div></td><td>Cook</td><td><span class="pill amb">per-trip</span></td><td class="num">৳1,200/trip</td><td class="t2">+8801622••5540</td><td><span class="pill ok">yes</span></td><td class="rowact"><a class="btn btn-sm btn-o" href="#">Edit</a></td></tr>
          <tr><td><div class="t1">Sohel Rana</div><div class="t2">NID ••1187</div></td><td>Helper</td><td><span class="pill amb">per-trip</span></td><td class="num">৳800/trip</td><td class="t2">+8801733••8876</td><td><span class="pill ok">yes</span></td><td class="rowact"><a class="btn btn-sm btn-o" href="#">Edit</a></td></tr>
          <tr><td><div class="t1">Jamal Uddin</div><div class="t2">NID ••4402</div></td><td>Helper</td><td><span class="pill amb">per-trip</span></td><td class="num">৳800/trip</td><td class="t2">+8801811••3320</td><td><span class="pill ok">yes</span></td><td class="rowact"><a class="btn btn-sm btn-o" href="#">Edit</a></td></tr>
          <tr><td><div class="t1">Babul Hoq</div><div class="t2">NID ••6650</div></td><td>Cleaner</td><td><span class="pill blue">salaried</span></td><td class="num">৳12,000/mo</td><td class="t2">+8801399••7761</td><td><span class="pill ok">yes</span></td><td class="rowact"><a class="btn btn-sm btn-o" href="#">Edit</a></td></tr>
        </tbody>
      </table></div></div></div>
`},

{ key:'attendance', out:'owner-attendance.html', title:'Attendance', crumb:'Jol Kolol · per departure', body:`
      <div class="page-head">
        <div><h1>Attendance</h1><p>Attendance <b>is</b> a crew row existing with present ticked — there's no separate screen. Default crew is pre-filled; you only touch it when someone differs that day.</p></div>
        <div class="acts"><div class="seg"><button class="seg-b on">21 Jul · 2D1N</button><button class="seg-b">21 Jul · Day</button><button class="seg-b">24 Jul · 2D1N</button></div></div>
      </div>
      <div class="grid-2">
        <div class="card2"><div class="ch"><h3>Crew · 21 Jul 2D1N</h3><span class="sub">auto-filled from default</span></div>
          <div class="cb flush"><div class="tbl-wrap"><table class="tbl">
            <thead><tr><th>Name</th><th>Role</th><th>Present</th><th>Leave state</th></tr></thead>
            <tbody>
              <tr><td class="t1">Nur Islam</td><td>Manager</td><td><span class="pill ok">present ✓</span></td><td class="t2">—</td></tr>
              <tr><td class="t1">Abdul Karim</td><td>Sukani</td><td><span class="pill ok">present ✓</span></td><td class="t2">—</td></tr>
              <tr><td class="t1">Ripon Mia</td><td>Cook</td><td><span class="pill ok">present ✓</span></td><td class="t2">—</td></tr>
              <tr><td class="t1">Sohel Rana</td><td>Helper</td><td><span class="pill ok">present ✓</span></td><td class="t2">—</td></tr>
              <tr><td class="t1">Jamal Uddin</td><td>Helper</td><td><span class="pill ok">present ✓</span></td><td class="t2">—</td></tr>
              <tr><td class="t1">Babul Hoq</td><td>Cleaner</td><td><span class="pill mut">not aboard</span></td><td><span class="pill warn">on_leave</span></td></tr>
            </tbody>
          </table></div></div>
        </div>
        <div class="card2"><div class="ch"><h3>Leave</h3><a class="btn btn-sm btn-o" href="#">＋ Record</a></div>
          <div class="cb flush"><div class="tbl-wrap"><table class="tbl" style="min-width:0">
            <thead><tr><th>Name</th><th>State</th><th>Dates</th></tr></thead>
            <tbody>
              <tr><td class="t1">Babul Hoq</td><td><span class="pill warn">on_leave</span></td><td class="t2">20–22 Jul</td></tr>
              <tr><td class="t1">Sohel Rana</td><td><span class="pill blue">other_duty</span></td><td class="t2">18 Jul</td></tr>
            </tbody>
          </table></div>
          <div class="cb"><div class="note info" style="margin:0"><span class="ic">ℹ️</span> "Not assigned today" ≠ "absent". Leave state distinguishes on_leave / available / other_duty.</div></div>
        </div>
      </div>
`},

{ key:'payroll', out:'owner-payroll.html', title:'Payroll', crumb:'Jol Kolol · July wages', body:`
      <div class="page-head">
        <div><h1>Payroll</h1><p>Salaried = monthly salary. Per-trip = rate × trips worked, plus any bonus, minus any deduction. Full history is kept, so you always know who has and hasn't been paid.</p></div>
        <div class="acts"><div class="seg"><button class="seg-b">June</button><button class="seg-b on">July</button></div><a class="btn btn-b" href="#">Run payroll</a></div>
      </div>
      <div class="kpis">
        <div class="kpi"><div class="l"><span class="ic">💰</span> July total</div><div class="n"><span class="u">৳</span>1,42,000</div><div class="d">6 crew</div></div>
        <div class="kpi alert"><div class="l"><span class="ic">⏳</span> Unpaid</div><div class="n">3</div><div class="d down">৳ 46,000</div></div>
        <div class="kpi"><div class="l"><span class="ic">✓</span> Paid</div><div class="n">3</div><div class="d up">৳ 96,000</div></div>
      </div>
      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Name</th><th>Basis</th><th class="num">Trips</th><th class="num">Base</th><th class="num">Bonus</th><th class="num">Deduct</th><th class="num">Total</th><th>Paid</th><th></th></tr></thead>
        <tbody>
          <tr><td class="t1">Nur Islam</td><td class="t2">salary</td><td class="num">—</td><td class="num">৳25,000</td><td class="num">৳2,000</td><td class="num">৳0</td><td class="num">৳27,000</td><td><span class="pill ok">paid 5 Jul</span></td><td class="rowact"><a class="btn btn-sm btn-o" href="#">View</a></td></tr>
          <tr><td class="t1">Abdul Karim</td><td class="t2">per-trip</td><td class="num">18</td><td class="num">৳27,000</td><td class="num">৳1,000</td><td class="num">৳0</td><td class="num">৳28,000</td><td><span class="pill ok">paid 5 Jul</span></td><td class="rowact"><a class="btn btn-sm btn-o" href="#">View</a></td></tr>
          <tr><td class="t1">Ripon Mia</td><td class="t2">per-trip</td><td class="num">18</td><td class="num">৳21,600</td><td class="num">৳0</td><td class="num">৳0</td><td class="num">৳21,600</td><td><span class="pill warn">unpaid</span></td><td class="rowact"><button class="btn btn-sm btn-ok">Mark paid</button></td></tr>
          <tr><td class="t1">Sohel Rana</td><td class="t2">per-trip</td><td class="num">17</td><td class="num">৳13,600</td><td class="num">৳0</td><td class="num neg">৳500</td><td class="num">৳13,100</td><td><span class="pill warn">unpaid</span></td><td class="rowact"><button class="btn btn-sm btn-ok">Mark paid</button></td></tr>
          <tr><td class="t1">Jamal Uddin</td><td class="t2">per-trip</td><td class="num">16</td><td class="num">৳12,800</td><td class="num">৳0</td><td class="num">৳0</td><td class="num">৳12,800</td><td><span class="pill warn">unpaid</span></td><td class="rowact"><button class="btn btn-sm btn-ok">Mark paid</button></td></tr>
          <tr><td class="t1">Babul Hoq</td><td class="t2">salary</td><td class="num">—</td><td class="num">৳12,000</td><td class="num">৳0</td><td class="num">৳0</td><td class="num">৳12,000</td><td><span class="pill ok">paid 5 Jul</span></td><td class="rowact"><a class="btn btn-sm btn-o" href="#">View</a></td></tr>
        </tbody>
      </table></div></div></div>
`},

{ key:'team', out:'owner-team.html', title:'Team & roles', crumb:'Jol Kolol · members & permissions', body:`
      <div class="page-head">
        <div><h1>Team & roles</h1><p>Permissions are <b>per person, per boat</b>. The same person can be admin here and restricted on another boat. Every object fetch re-checks authorization — the role map alone isn't enough.</p></div>
        <div class="acts"><a class="btn btn-o" href="#">＋ Role template</a><a class="btn btn-b" href="#">＋ Invite member</a></div>
      </div>
      <div class="card2" style="margin-bottom:20px"><div class="ch"><h3>Members & shareholders</h3></div>
        <div class="cb flush"><div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Name</th><th>Role</th><th class="num">Shareholder</th><th>Since</th><th>Status</th><th></th></tr></thead>
          <tbody>
            <tr><td class="t1">Kamal Uddin</td><td><span class="pill blue">Owner</span></td><td class="num">60%</td><td class="t2">Jan 2024</td><td><span class="pill ok">active</span></td><td class="rowact"><a class="btn btn-sm btn-o" href="#">Edit</a></td></tr>
            <tr><td class="t1">Selim Reza</td><td><span class="pill blue">Shareholder</span></td><td class="num">25%</td><td class="t2">Jan 2024</td><td><span class="pill ok">active</span></td><td class="rowact"><a class="btn btn-sm btn-o" href="#">Edit</a></td></tr>
            <tr><td class="t1">Anwar Hossain</td><td><span class="pill blue">Shareholder</span></td><td class="num">15%</td><td class="t2">Mar 2024</td><td><span class="pill ok">active</span></td><td class="rowact"><a class="btn btn-sm btn-o" href="#">Edit</a></td></tr>
            <tr><td class="t1">Nur Islam</td><td><span class="pill mut">Manager</span></td><td class="num">—</td><td class="t2">Feb 2024</td><td><span class="pill ok">active</span></td><td class="rowact"><a class="btn btn-sm btn-o" href="#">Edit</a></td></tr>
            <tr><td class="t1">Faruk Ahmed</td><td><span class="pill mut">Shareholder</span></td><td class="num">—</td><td class="t2">exited May 2026</td><td><span class="pill warn">exited</span></td><td class="rowact"><a class="btn btn-sm btn-o" href="#">View</a></td></tr>
          </tbody>
        </table></div></div>
      </div>
      <div class="grid-2">
        <div class="card2"><div class="ch"><h3>Role template · Manager</h3><span class="sub">per-module view / edit</span></div>
          <div class="cb flush"><div class="tbl-wrap"><table class="tbl" style="min-width:0">
            <thead><tr><th>Module</th><th>View</th><th>Edit</th></tr></thead>
            <tbody>
              <tr><td class="t1">Bookings</td><td><span class="pill ok">✓</span></td><td><span class="pill ok">✓</span></td></tr>
              <tr><td class="t1">Pricing</td><td><span class="pill ok">✓</span></td><td><span class="pill mut">✗</span></td></tr>
              <tr><td class="t1">Payouts</td><td><span class="pill ok">✓</span></td><td><span class="pill mut">✗</span></td></tr>
              <tr><td class="t1">Payroll</td><td><span class="pill mut">✗</span></td><td><span class="pill mut">✗</span></td></tr>
              <tr><td class="t1">Costs</td><td><span class="pill ok">✓</span></td><td><span class="pill ok">✓</span></td></tr>
            </tbody>
          </table></div></div>
        </div>
        <div class="card2"><div class="ch"><h3>Exited shareholder</h3></div><div class="cb">
          <div class="note warn"><span class="ic">🔒</span> Faruk exited May 2026. He keeps <b>read-only</b> access to his own period — Jan 2024 to May 2026 — and nothing after.</div>
          <div class="note info" style="margin-top:12px"><span class="ic">ℹ️</span> Roles are named by you via the role generator: Owner, Shareholder, Manager…</div>
        </div></div>
      </div>
`},

];
