/* eslint-disable */
// Shared emitters for the admin console previews.
// The four finance queues (verify / refunds / payouts / overpayments) are the
// SAME invoice table + SAME full-invoice drawer, differing only by which
// status they are pre-filtered to. Built once here, reused four times.

// ---- the 11 business statuses (display labels) -> pill tone ----
// Schema states (customer_due/paid/payment_verified/in_payout/bill_cleared/
// cancelled/refund_*) map onto these; see README for the mapping.
const STATUS = {
  'Advance Paid':     'amb',
  'Due Paid':         'blue',
  'Canceled':         'mut',
  'Canceled by Boat': 'danger',
  'Refund Requested': 'warn',
  'Refund Verified':  'blue',
  'Refunded':         'ok',
  'Ready for Payout': 'warn',
  'Payout Verified':  'blue',
  'Paid to Boat':     'ok',
  'Over Paid':        'danger',
};

const statusPill = (s) => `<span class="pill ${STATUS[s] || 'mut'}">${s}</span>`;
const tripPill = (t) => `<span class="pill ${t === 'Completed' ? 'ok' : 'mut'}">${t}</span>`;
const payTag = (m) => `<span class="tag">${m}</span>`;

// ---- filter bar shared by all four queues ----
function invoiceFilters(statusOptions) {
  const opts = ['All statuses', ...statusOptions].map((o, i) =>
    `<option${i === 1 && statusOptions.length === 1 ? ' selected' : ''}>${o}</option>`).join('');
  const years = ['2026', '2025', '2024'].map(y => `<option>${y}</option>`).join('');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    .map((m, i) => `<option${i === 6 ? ' selected' : ''}>${m}</option>`).join('');
  return `      <div class="filterbar">
        <div class="search" style="max-width:360px"><span class="mag">🔍</span><input placeholder="Invoice ID, booking ID, boat, txn id…"></div>
        <select class="select">${opts}</select>
        <select class="select"><option>Any date</option><option>Today</option><option>Last 7 days</option><option>Last 30 days</option></select>
        <select class="select">${months}</select>
        <select class="select">${years}</select>
      </div>
`;
}

// ---- the invoice table (identical columns on all four screens) ----
// row = {inv, bk, status, boat, date, trip, method, amount, token, action}
function invoiceTable(rows, actionLabel) {
  const body = rows.map(r => `          <tr>
            <td class="t1">${r.inv}</td>
            <td class="t2">${r.bk}</td>
            <td>${statusPill(r.status)}</td>
            <td>${r.boat}</td>
            <td class="t2">${r.date}</td>
            <td>${tripPill(r.trip)}</td>
            <td>${payTag(r.method)}</td>
            <td class="num">৳ ${r.amount}</td>
            <td class="t2">${r.token}</td>
            <td class="rowact"><button class="btn btn-sm ${r.primary ? 'btn-b' : 'btn-o'}" data-drawer>${actionLabel}</button></td>
          </tr>`).join('\n');
  return `      <div class="card2"><div class="cb flush"><div class="tbl-wrap"><table class="tbl" style="min-width:1100px">
        <thead><tr>
          <th>Invoice ID</th><th>Booking ID</th><th>Invoice status</th><th>Boat</th><th>Booking date</th>
          <th>Trip status</th><th>Payment</th><th class="num">Amount</th><th>Gateway / txn id</th><th></th>
        </tr></thead>
        <tbody>
${body}
        </tbody>
      </table></div></div></div>
`;
}

// ---- the full-invoice drawer (identical everywhere) ----
function invoiceDrawer(inv, footer) {
  return `      <div class="drawer-sc" id="drawerScrim"></div>
      <aside class="drawer wide" id="drawer">
        <div class="dh"><h3>${inv.inv} · full invoice</h3><button class="x" data-drawer-close>✕</button></div>
        <div class="db">

          <div class="dsec">
            <h4>Status</h4>
            <div style="display:flex;gap:8px;flex-wrap:wrap">${statusPill(inv.status)}${tripPill(inv.trip)}${payTag(inv.method)}${inv.lock ? '<span class="pill blue lock">in payout batch</span>' : ''}</div>
          </div>

          <div class="dsec">
            <h4>Customer</h4>
            <dl class="kv">
              <dt>Name</dt><dd>${inv.customer.name}</dd>
              <dt>Phone</dt><dd>${inv.customer.phone}</dd>
              <dt>Email</dt><dd>${inv.customer.email}</dd>
              <dt>Lead guest</dt><dd>${inv.customer.lead}</dd>
            </dl>
          </div>

          <div class="dsec">
            <h4>Booking</h4>
            <dl class="kv">
              <dt>Booking ID</dt><dd>${inv.bk}</dd>
              <dt>Boat</dt><dd>${inv.boat}</dd>
              <dt>Route</dt><dd>${inv.booking.route}</dd>
              <dt>Trip dates</dt><dd>${inv.booking.dates}</dd>
              <dt>Duration</dt><dd>${inv.booking.duration}</dd>
              <dt>Booking type</dt><dd>${inv.booking.type}</dd>
              <dt>Headcount</dt><dd>${inv.booking.headcount}</dd>
              <dt>Booked on</dt><dd>${inv.date}</dd>
              <dt>Reference name</dt><dd>${inv.booking.reference}</dd>
            </dl>
            <table class="mini" style="margin-top:12px">
              <thead><tr><th>Cabin</th><th>Category</th><th>Adults</th><th>Children</th><th class="num">Room price</th></tr></thead>
              <tbody>
${inv.booking.cabins.map(c => `                <tr><td class="t1">${c.name}</td><td>${c.cat}</td><td>${c.adults}</td><td>${c.children}</td><td class="num">৳ ${c.price}</td></tr>`).join('\n')}
              </tbody>
            </table>
            ${inv.booking.notes ? `<p class="prose" style="margin-top:10px"><b>Special instructions:</b> ${inv.booking.notes}</p>` : ''}
          </div>

          <div class="dsec">
            <h4>Payment breakdown</h4>
            <div class="bd">
              <span class="lbl">Room total</span><span class="val">৳ ${inv.money.room}</span>
              <span class="lbl">+ Gateway fee (${inv.money.gatewayPct})</span><span class="val">৳ ${inv.money.gatewayFee}</span>
              <div class="rule"></div>
              <span class="lbl">= Price shown</span><span class="val">৳ ${inv.money.shown}</span>
              <span class="lbl">− Coupon${inv.money.coupon ? ` (${inv.money.coupon})` : ''}</span><span class="val">−৳ ${inv.money.discount}</span>
              <div class="rule"></div>
              <span class="lbl">= Customer total</span><span class="val">৳ ${inv.money.total}</span>
              <div class="rule"></div>
              <span class="lbl">Advance paid</span><span class="val">৳ ${inv.money.advance}</span>
              <span class="lbl">Due</span><span class="val">৳ ${inv.money.due}</span>
              <span class="lbl sum">Total paid</span><span class="val sum">৳ ${inv.money.paid}</span>
              ${inv.money.overpaid ? `<span class="lbl">Overpaid</span><span class="val" style="color:var(--danger)">৳ ${inv.money.overpaid}</span>` : ''}
              <div class="rule"></div>
              <span class="lbl">Platform commission</span><span class="val">৳ ${inv.money.commission}</span>
              <span class="lbl sum">Payable to boat</span><span class="val sum">৳ ${inv.money.dueToBoat}</span>
            </div>
          </div>

          <div class="dsec">
            <h4>Payments received</h4>
            <table class="mini">
              <thead><tr><th>Method</th><th class="num">Amount</th><th>Gateway / txn id</th><th>Verified by</th><th>Paid at</th></tr></thead>
              <tbody>
${inv.payments.map(p => `                <tr><td class="t1">${p.method}</td><td class="num">৳ ${p.amount}</td><td>${p.token}</td><td>${p.by}</td><td>${p.at}</td></tr>`).join('\n')}
              </tbody>
            </table>
          </div>

          <div class="dsec">
            <h4>Record</h4>
            <dl class="kv">
              <dt>Cancellation policy (snapshot)</dt><dd>${inv.meta.policy}</dd>
              <dt>Payout batch</dt><dd>${inv.meta.batch}</dd>
              <dt>Invoice created</dt><dd>${inv.meta.created}</dd>
              <dt>Last updated</dt><dd>${inv.meta.updated}</dd>
            </dl>
            <div class="note info" style="margin-top:12px"><span class="ic">ℹ</span> Commission is charged on the original room total, never the discounted amount — the boat absorbs its own coupon.</div>
          </div>

        </div>
        <div class="df">${footer}</div>
      </aside>
`;
}

// ---- sample invoice used by the drawer on every finance queue ----
const SAMPLE_INVOICE = {
  inv: 'INV-8410', bk: 'BK-8f3a', status: 'Due Paid', boat: 'Jol Kolol',
  date: '18 Jul 2026', trip: 'Completed', method: 'Online', lock: false,
  customer: { name: 'Tanvir Hasan', phone: '+8801711002200', email: 'tanvir@example.com', lead: 'Tanvir Hasan' },
  booking: {
    route: 'Tanguar Haor · Sunamganj', dates: '24–25 Jul 2026', duration: '2 days 1 night',
    type: 'Cabin booking', headcount: '2 adults', reference: 'Rakib (referral)',
    notes: 'One guest is vegetarian. Late check-in around 9pm.',
    cabins: [{ name: '101', cat: 'Luxury AC', adults: 2, children: 0, price: '10,000' }],
  },
  money: {
    room: '10,000', gatewayPct: '1.8%', gatewayFee: '180', shown: '10,180', coupon: 'EID10 · 10%',
    discount: '1,018', total: '9,162', advance: '3,000', due: '6,162', paid: '9,162',
    overpaid: '', commission: '500', dueToBoat: '8,482',
  },
  payments: [
    { method: 'Online', amount: '3,000', token: 'sslcz_a0…4d12', by: 'Nusrat J.', at: '18 Jul 15:22' },
    { method: 'Online', amount: '6,162', token: 'sslcz_b7…9f55', by: 'Nusrat J.', at: '24 Jul 09:10' },
  ],
  meta: { policy: 'Moderate · 50% if >7 days', batch: '—', created: '18 Jul 2026 15:20', updated: '24 Jul 2026 09:11' },
};

// ---- EDITABLE invoice drawer (dispute → Edit): every field an input ----
function invoiceEditDrawer(inv, footer) {
  const statusOpts = Object.keys(STATUS).map(s =>
    `<option${s === inv.status ? ' selected' : ''}>${s}</option>`).join('');
  const tripOpts = ['Completed', 'Canceled'].map(t =>
    `<option${t === inv.trip ? ' selected' : ''}>${t}</option>`).join('');
  const methodOpts = ['Online', 'Cash'].map(m =>
    `<option${m === inv.method ? ' selected' : ''}>${m}</option>`).join('');
  const money = (label, key, cls = '') =>
    `<span class="lbl">${label}</span><span class="val ${cls}"><input value="${inv.money[key]}"></span>`;
  return `      <div class="drawer-sc" id="drawerScrimEdit"></div>
      <aside class="drawer wide" id="drawerEdit">
        <div class="dh"><h3>Edit invoice · ${inv.inv}</h3><button class="x" data-edit-close>✕</button></div>
        <div class="db">
          <div class="note warn" style="margin-bottom:6px"><span class="ic">⚑</span> Editing a disputed invoice is logged to the audit trail. Every field below is editable.</div>

          <div class="dsec"><h4>Status</h4>
            <dl class="kv">
              <dt>Invoice status</dt><dd><select>${statusOpts}</select></dd>
              <dt>Trip status</dt><dd><select>${tripOpts}</select></dd>
              <dt>Payment method</dt><dd><select>${methodOpts}</select></dd>
            </dl>
          </div>

          <div class="dsec"><h4>Customer</h4>
            <dl class="kv">
              <dt>Name</dt><dd><input value="${inv.customer.name}"></dd>
              <dt>Phone</dt><dd><input value="${inv.customer.phone}"></dd>
              <dt>Email</dt><dd><input value="${inv.customer.email}"></dd>
              <dt>Lead guest</dt><dd><input value="${inv.customer.lead}"></dd>
            </dl>
          </div>

          <div class="dsec"><h4>Booking</h4>
            <dl class="kv">
              <dt>Booking ID</dt><dd><input value="${inv.bk}"></dd>
              <dt>Boat</dt><dd><input value="${inv.boat}"></dd>
              <dt>Route</dt><dd><input value="${inv.booking.route}"></dd>
              <dt>Trip dates</dt><dd><input value="${inv.booking.dates}"></dd>
              <dt>Headcount</dt><dd><input value="${inv.booking.headcount}"></dd>
              <dt>Reference name</dt><dd><input value="${inv.booking.reference}"></dd>
            </dl>
          </div>

          <div class="dsec"><h4>Payment breakdown</h4>
            <div class="bd">
              ${money('Room total', 'room')}
              ${money('Gateway fee', 'gatewayFee')}
              ${money('Discount / coupon', 'discount', 'neg')}
              ${money('Customer total', 'total')}
              ${money('Advance paid', 'advance')}
              ${money('Due', 'due')}
              ${money('Total paid', 'paid')}
              ${money('Overpaid', 'overpaid')}
              ${money('Commission', 'commission')}
              ${money('Payable to boat', 'dueToBoat')}
            </div>
          </div>

          <div class="dsec"><h4>Resolution note</h4>
            <div class="field"><label>Why this invoice is being edited</label><input value="Refund % corrected after owner-cancel dispute."></div>
          </div>
        </div>
        <div class="df">${footer}</div>
      </aside>
`;
}

// ---- subscription (platform → boat) invoice drawer, printable ----
function subscriptionDrawer(sub, footer) {
  return `      <div class="drawer-sc" id="drawerScrim"></div>
      <aside class="drawer wide" id="drawer">
        <div class="dh"><h3>${sub.id} · subscription invoice</h3><button class="x" data-drawer-close>✕</button></div>
        <div class="db">
          <div class="dsec"><h4>Status</h4>
            <div style="display:flex;gap:8px"><span class="pill ${sub.tone}">${sub.status}</span></div>
          </div>
          <div class="dsec"><h4>Billed to</h4>
            <dl class="kv">
              <dt>Boat</dt><dd>${sub.boat}</dd>
              <dt>Owner</dt><dd>${sub.owner}</dd>
              <dt>Period</dt><dd>${sub.period}</dd>
            </dl>
          </div>
          <div class="dsec"><h4>From</h4>
            <dl class="kv"><dt>HaorBoat Platform Ltd.</dt><dd>Dhaka, Bangladesh</dd><dt>BIN</dt><dd>0012-3456-7890</dd></dl>
          </div>
          <div class="dsec"><h4>Charges</h4>
            <div class="bd">
              <span class="lbl">Monthly platform fee</span><span class="val">৳ ${sub.monthly}</span>
              <span class="lbl">Commission (period total)</span><span class="val">৳ ${sub.commission}</span>
              <div class="rule"></div>
              <span class="lbl sum">Amount due</span><span class="val sum">৳ ${sub.due}</span>
            </div>
          </div>
          <div class="dsec"><h4>Record</h4>
            <dl class="kv"><dt>Issued</dt><dd>${sub.issued}</dd><dt>Paid</dt><dd>${sub.paid}</dd></dl>
            <div class="note info" style="margin-top:12px"><span class="ic">🖨</span> Use Print for a PDF copy — the sidebar and controls are hidden in the printout.</div>
          </div>
        </div>
        <div class="df">${footer}</div>
      </aside>
`;
}

module.exports = { STATUS, statusPill, tripPill, payTag, invoiceFilters, invoiceTable, invoiceDrawer, invoiceEditDrawer, subscriptionDrawer, SAMPLE_INVOICE };
