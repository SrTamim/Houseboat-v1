/* eslint-disable */
// Design-preview generator for the HaorBoat platform admin console.
// Holds the shared shell (head/CSS, sidebar, topbar, script) ONCE and stamps
// each screen so all files share an identical design system. Static HTML only.
//
//   node _gen.js
//
const fs = require('fs');
const path = require('path');

// ---- shared <head> + full CSS design system (read from _shell.html) ----
const shell = fs.readFileSync(path.join(__dirname, '_shell.html'), 'utf8');
const HEAD = shell.slice(0, shell.indexOf('</head>') + '</head>'.length);
const STYLE_START = HEAD.indexOf('<style>');
// title is replaced per page
const HEAD_NO_TITLE = HEAD.replace(/<title>[\s\S]*?<\/title>/, '<title>{{TITLE}}<\/title>');

// ---- sidebar nav model (single source of truth) ----
const NAV = [
  ['Overview', [
    ['dashboard', '▦', 'Dashboard', 'admin-dashboard.html'],
    ['analytics', '📈', 'Analytics', 'admin-analytics.html'],
  ]],
  ['Operations', [
    ['boats', '🚤', 'Boats', 'admin-boats.html', {warn:'3'}],
    ['routes', '🗺️', 'Routes', 'admin-routes.html'],
    ['bookings', '🎟️', 'Bookings', 'admin-bookings.html'],
    ['reviews', '★', 'Reviews', 'admin-reviews.html'],
    ['accounts', '👤', 'Accounts', 'admin-accounts.html'],
    ['memberships', '👥', 'Memberships', 'admin-memberships.html'],
    ['waitlist', '⏳', 'Waitlist', 'admin-waitlist.html'],
  ]],
  ['Finance', [
    ['verify', '✓', 'Verify', 'admin-finance-verify.html', {warn:'5'}],
    ['refunds', '↩', 'Refunds', 'admin-finance-refunds.html', {ct:'2'}],
    ['payouts', '💸', 'Payouts', 'admin-finance-payouts.html'],
    ['overpayments', '⚖', 'Overpayments', 'admin-finance-overpayments.html'],
    ['credits', '🎫', 'Credits', 'admin-finance-credits.html'],
    ['commission', '%', 'Commission', 'admin-finance-commission.html'],
    ['billing', '🧾', 'Subscriptions', 'admin-billing.html'],
    ['billing-config', '⚙', 'Billing config', 'admin-billing-config.html'],
    ['debtors', '🔻', 'Debtors', 'admin-debtors.html', {warn:'1'}],
    ['trials', '⏱', 'Trials', 'admin-trials.html'],
  ]],
  ['System', [
    ['jobs', '🩺', 'Jobs & health', 'admin-jobs.html', {warn:'1'}],
    ['audit', '📜', 'Audit log', 'admin-audit.html'],
    ['sync', '🔄', 'Sync conflicts', 'admin-sync.html', {warn:'1'}],
    ['notifications', '🔔', 'Notifications', 'admin-notifications.html'],
    ['gateway', '💳', 'Gateway', 'admin-gateway.html'],
    ['settings', '🛠', 'Settings', 'admin-settings.html'],
    ['roles', '🔑', 'Role templates', 'admin-roles.html'],
  ]],
  ['Disputes & risk', [
    ['disputes', '⚑', 'Disputes', 'admin-disputes.html'],
    ['idor', '🛡', 'Security', 'admin-idor.html'],
    ['coupons', '🏷', 'Coupons', 'admin-coupons.html'],
    ['reschedules', '🔁', 'Reschedules', 'admin-reschedules.html'],
    ['cutoff', '⛔', 'Cutoff', 'admin-cutoff.html'],
  ]],
];

function sidebar(activeKey) {
  let h = `  <aside class="sidebar" id="sidebar">
    <div class="sb-logo"><span class="mark">⚓</span> Haor<span class="b">Boat</span> <span class="tag">Platform</span></div>
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
    <div class="sb-foot">Signed in as platform staff · UTC+6 (BST)</div>
  </aside>\n`;
  return h;
}

const SCRIPT = shell.slice(shell.indexOf('<script>'));

// ---- upgrade old flat .kpi markup into the v2 stat-card structure ----
// old:  <div class="kpi[ alert]"><div class="l"><span class="ic">I</span> LABEL</div>
//         <div class="n">NUM</div><div class="d[ up|down]">DELTA</div></div>
// new:  <div class="kpi[ alert]"><div class="top"><span class="chip">I</span><span class="l">LABEL</span></div>
//         <div class="n">NUM</div><div class="d"><span class="delta[ up|down]">DELTA</span></div></div>
function upgradeKpis(html) {
  // .kpi block = <div class="kpi[mod]"><div class="l">LBLOCK</div><div class="n"NATT>NUM</div>[<div class="d[DMOD]">DELTA</div>]</div>
  const block = /<div class="kpi([^"]*)"><div class="l">([\s\S]*?)<\/div><div class="n"([^>]*)>([\s\S]*?)<\/div>(?:<div class="d([^"]*)">([\s\S]*?)<\/div>)?<\/div>/g;
  return html.replace(block, (_, kmod, lblock, natt, num, dmod, delta) => {
    let ic = '', label = lblock;
    const icm = lblock.match(/<span class="ic">([\s\S]*?)<\/span>\s*/);
    if (icm) { ic = icm[1].trim(); label = lblock.replace(icm[0], ''); }
    if (!ic) ic = kmod.includes('alert') ? '⚠' : '▪';
    const deltaCls = dmod ? ` ${dmod.trim()}` : '';
    const dHtml = (delta !== undefined && delta.trim())
      ? `<div class="d"><span class="delta${deltaCls}">${delta.trim()}</span></div>` : '';
    return `<div class="kpi${kmod}"><div class="top"><span class="chip">${ic}</span>`
      + `<span class="l">${label.trim()}</span></div><div class="n"${natt}>${num}</div>${dHtml}</div>`;
  });
}

function page({ key, title, crumb, body }) {
  body = upgradeKpis(body);
  const head = HEAD_NO_TITLE.replace('{{TITLE}}', `HaorBoat Admin — ${title} (design preview)`);
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
      <a class="icon-btn" href="admin-notifications.html" aria-label="Notifications">🔔<span class="dot"></span></a>
      <button class="icon-btn theme-btn" id="themeToggle" aria-label="Toggle theme"><span class="moon">🌙</span><span class="sun">☀️</span></button>
      <div class="whoami"><span class="av">RA</span><div><div class="nm">Rafiq Ahmed</div><div class="rl">Finance · Platform</div></div></div>
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
for (const mod of ['content-overview.js', 'content-operations.js', 'content-finance.js', 'content-system.js', 'content-disputes.js']) {
  const p = path.join(__dirname, mod);
  if (fs.existsSync(p)) screens.push(...require(p));
}

let n = 0;
for (const s of screens) {
  fs.writeFileSync(path.join(__dirname, s.out), page(s));
  n++;
}
console.log(`Generated ${n} admin screens.`);
