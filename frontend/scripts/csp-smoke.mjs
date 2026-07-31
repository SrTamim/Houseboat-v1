import { chromium } from '@playwright/test';

/**
 * Real-browser check that CSP doesn't break the console.
 *
 * curl can confirm a header is present but not whether the browser honoured
 * it: 'strict-dynamic' makes browsers IGNORE hashes and 'self' for top-level
 * scripts, so a policy that looks correct can still block the pre-paint theme
 * script. Only an actual engine tells us.
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

const browser = await chromium.launch();
const page = await browser.newPage();

const violations = [];
const consoleErrors = [];

page.on('console', (msg) => {
  const text = msg.text();
  if (/Content Security Policy|Refused to/i.test(text)) violations.push(text);
  else if (msg.type() === 'error') consoleErrors.push(text);
});
page.on('pageerror', (err) => consoleErrors.push(String(err)));

await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle' });

// The theme script runs before paint and sets this attribute. If CSP blocked
// it, the attribute is missing.
const themeAttr = await page.getAttribute('html', 'data-theme');

// Styles applied? A blocked/404 stylesheet leaves the default serif font.
const font = await page.evaluate(
  () => getComputedStyle(document.body).fontFamily,
);

// The login card should be laid out, not raw markup.
const hasCard = (await page.locator('.login-card').count()) > 0;

console.log(`data-theme      : ${themeAttr ?? '(missing)'}`);
console.log(`body font       : ${font}`);
console.log(`.login-card     : ${hasCard ? 'present' : 'MISSING'}`);
console.log(`CSP violations  : ${violations.length}`);
violations.forEach((v) => console.log(`   ! ${v}`));
console.log(`console errors  : ${consoleErrors.length}`);
consoleErrors.slice(0, 5).forEach((e) => console.log(`   ! ${e}`));

await browser.close();

const ok =
  themeAttr &&
  hasCard &&
  violations.length === 0 &&
  !/^(serif|Times)/i.test(font);

console.log(ok ? '\nPASS' : '\nFAIL');
process.exit(ok ? 0 : 1);
