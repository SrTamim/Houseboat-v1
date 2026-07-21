/* eslint-disable */
// Design-preview generator for the HaorBoat boat-owner console.
// Holds the shared shell (head/CSS, sidebar + boat switcher, topbar, script)
// ONCE and stamps each screen so all files share an identical design system.
// Static HTML only — not wired to the backend.
//
//   node _gen.js
//
const fs = require('fs');
const path = require('path');

// ---- shared <head> + full CSS design system (read from _shell.html) ----
const shell = fs.readFileSync(path.join(__dirname, '_shell.html'), 'utf8');
const HEAD = shell.slice(0, shell.indexOf('</head>') + '</head>'.length);
const HEAD_NO_TITLE = HEAD.replace(/<title>[\s\S]*?<\/title>/, '<title>{{TITLE}}<\/title>');

// ---- boat switcher (single source of truth, copied from _shell.html) ----
const BOATSW = `    <div class="boatsw" id="boatsw">
      <button class="boatsw-btn" id="boatswBtn">
        <span class="bav">⛵</span>
        <span><span class="bn">Jol Kolol</span><span class="bm">Tanguar Haor · live</span></span>
        <span class="cv">▾</span>
      </button>
      <div class="boatsw-menu">
        <a href="owner-dashboard.html"><span class="dot"></span> Jol Kolol <span class="sub">live</span></a>
        <a href="owner-dashboard.html"><span class="dot"></span> Haor Bilash <span class="sub">live</span></a>
        <a href="owner-profile.html"><span class="dot mut"></span> Meghduar <span class="sub">draft 82%</span></a>
        <div class="sep"></div>
        <a class="add" href="owner-profile.html">＋ Add a boat</a>
      </div>
    </div>\n`;

// ---- sidebar nav model (single source of truth) ----
const NAV = [
  ['Overview', [
    ['dashboard', '▦', 'Dashboard', 'owner-dashboard.html'],
    ['calendar', '🗓️', 'Calendar', 'owner-calendar.html'],
  ]],
  ['Bookings', [
    ['bookings', '🎟️', 'Bookings', 'owner-bookings.html'],
    ['pos', '🧾', 'Counter sale', 'owner-pos.html'],
    ['departure', '⛴️', 'Departures', 'owner-departure.html', {warn:'2'}],
    ['waitlist', '⏳', 'Waitlist', 'owner-waitlist.html', {ct:'4'}],
    ['quotes', '💬', 'Quotes', 'owner-quotes.html', {warn:'3'}],
    ['reviews', '★', 'Reviews', 'owner-reviews.html'],
    ['guests', '👥', 'Guests', 'owner-guests.html'],
  ]],
  ['Trips & pricing', [
    ['packages', '📦', 'Packages', 'owner-packages.html'],
    ['schedule', '📅', 'Schedule', 'owner-schedule.html'],
    ['pricing', '৳', 'Pricing', 'owner-pricing.html', {warn:'1'}],
  ]],
  ['Boat setup', [
    ['profile', '⛵', 'Boat profile', 'owner-profile.html'],
    ['cabins', '🚪', 'Decks & cabins', 'owner-cabins.html'],
    ['coupons', '🏷', 'Coupons', 'owner-coupons.html'],
  ]],
  ['Money', [
    ['invoices', '🧮', 'Invoices', 'owner-invoices.html'],
    ['payments', '💵', 'Payments', 'owner-payments.html', {warn:'2'}],
    ['refunds', '↩', 'Refunds', 'owner-refunds.html', {ct:'1'}],
    ['payouts', '💸', 'Payouts', 'owner-payouts.html'],
    ['earnings', '📊', 'Earnings', 'owner-earnings.html'],
    ['billing', '🏛', 'Platform billing', 'owner-billing.html', {warn:'1'}],
  ]],
  ['People', [
    ['crew', '⚓', 'Crew', 'owner-crew.html'],
    ['attendance', '✓', 'Attendance', 'owner-attendance.html'],
    ['payroll', '💰', 'Payroll', 'owner-payroll.html', {warn:'3'}],
    ['team', '🔑', 'Team & roles', 'owner-team.html'],
  ]],
  ['Operations', [
    ['costs', '🧾', 'Costs', 'owner-costs.html'],
    ['inventory', '📦', 'Inventory', 'owner-inventory.html', {warn:'2'}],
    ['maintenance', '🛠', 'Maintenance', 'owner-maintenance.html', {warn:'1'}],
    ['reports', '📈', 'Reports', 'owner-reports.html'],
    ['notifications', '🔔', 'Notifications', 'owner-notifications.html'],
    ['audit', '📜', 'Audit log', 'owner-audit.html'],
    ['sync', '🔄', 'Sync', 'owner-sync.html', {warn:'1'}],
    ['settings', '⚙', 'Settings', 'owner-settings.html'],
  ]],
];

function sidebar(activeKey) {
  let h = `  <aside class="sidebar" id="sidebar">
    <div class="sb-logo"><span class="mark">⚓</span> Haor<span class="b">Boat</span> <span class="tag">Owner</span></div>

${BOATSW}
    <nav class="sb-nav">\n`;
  for (const [group, items] of NAV) {
    h += `      <div class="sb-group">${group}</div>\n`;
    for (const it of items) {
      const [key, ic, label, href, opts] = it;
      const on = key === activeKey ? ' on' : '';
      let ct = '';
      if (opts && opts.warn) ct = ` <span class="ct warn">${opts.warn}</span>`;
      else if (opts && opts.ct) ct = ` <span class="ct">${opts.ct}</span>`;
      h += `      <a class="sb-link${on}" href="${href}"><span class="ic">${ic}</span> ${label}${ct}</a>\n`;
    }
  }
  h += `    </nav>
    <div class="sb-foot">Kamal Uddin · Owner · UTC+6 (BST)</div>
  </aside>\n`;
  return h;
}

const SCRIPT = shell.slice(shell.indexOf('<script>'));

function page({ key, title, crumb, body }) {
  const head = HEAD_NO_TITLE.replace('{{TITLE}}', `HaorBoat Owner — ${title} (design preview)`);
  const crumbHtml = crumb ? `<div class="crumb">${crumb}</div>` : '';
  return `${head}
<body>
<div class="app">

${sidebar(key)}
  <div class="main">
    <header class="topbar">
      <button class="burger" id="burger" aria-label="Menu">☰</button>
      <div><div class="pt">${title}</div>${crumbHtml}</div>
      <div class="sp"></div>
      <a class="icon-btn" href="owner-notifications.html" aria-label="Notifications">🔔<span class="dot"></span></a>
      <button class="icon-btn theme-btn" id="themeToggle" aria-label="Toggle theme"><span class="moon">🌙</span><span class="sun">☀️</span></button>
      <div class="whoami"><span class="av">KU</span><div><div class="nm">Kamal Uddin</div><div class="rl">Owner · Jol Kolol</div></div></div>
    </header>

    <main class="content">
${body}
    </main>
  </div>
</div>

${SCRIPT}
`;
}

// ---- load screen definitions from the content modules ----
const screens = [];
for (const mod of ['content-overview.js', 'content-bookings.js', 'content-trips.js', 'content-setup.js', 'content-money.js', 'content-people.js', 'content-ops.js']) {
  const p = path.join(__dirname, mod);
  if (fs.existsSync(p)) screens.push(...require(p));
}

let n = 0;
for (const s of screens) {
  fs.writeFileSync(path.join(__dirname, s.out), page(s));
  n++;
}
console.log(`Generated ${n} owner screens.`);
