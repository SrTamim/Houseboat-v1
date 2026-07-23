# Boat Owner Dashboard — Design Preview

Static HTML mockups of the **boat owner console** — the single-boat operator
surface a houseboat owner / shareholder / manager signs into to run their own boat
(`houseboat_member` + `houseboat_staff`, **not** `is_platform`). Design preview
only: self-contained HTML, inline CSS, **not wired to the backend**. Third surface
alongside the customer booking flow (`../booking-flow/haorboat-*.html`) and the
platform admin console (`../admin/admin-*.html`) — same brand tokens (blue
`#1a73e8` + amber, Inter / Hind Siliguri, light + dark), same sidebar shell and
dense tables.

Open any `owner-*.html` directly in a browser (no server — everything is inline).
Start at **owner-login.html** → pick **Jol Kolol** → **owner-dashboard.html**.
The theme toggle (🌙/☀️) persists via `localStorage['hb-theme']`; the sidebar
**boat switcher** (top-left) shows a single owner's multiple boats.

## Screens (34)

**Standalone**
- `owner-login.html` — owner/crew sign in (phone + password) → boat picker

**Overview**
- `owner-dashboard.html` — needs-you-now queue, today's departures, KPIs, week summary
- `owner-calendar.html` — month view of departures by status; operating dates

**Bookings**
- `owner-bookings.html` — every booking, filters, invoice + bill-breakdown drawer
- `owner-pos.html` — counter sale: live cabin grid → hold → headcount → checkout
- `owner-departure.html` — one departure: cabin grid, manifest, crew, cutoff
- `owner-waitlist.html` — waitlist depth per departure, notify-all
- `owner-quotes.html` — quote-request inbox, price + send, 24h expiry
- `owner-reviews.html` — verified-only reviews, owner reply
- `owner-guests.html` — guest directory / CRM: repeat guests, history, credit held

**Trips & pricing**
- `owner-packages.html` — trip packages per route (duration, ghats, meals, policy)
- `owner-schedule.html` — departures generated from operating dates, time-driven status
- `owner-pricing.html` — pricing profiles × occupancy price tables; blank warnings; group bands

**Boat setup**
- `owner-profile.html` — profile completion, bank account (go-live gate), routes, policy
- `owner-cabins.html` — decks, cabin categories, cabins on the grid
- `owner-coupons.html` — coupons (percent / flat / referral)

**Money**
- `owner-invoices.html` — invoices + 7-step bill breakdown drawer
- `owner-payments.html` — cash verification (manager verifies cash, not gateway)
- `owner-refunds.html` — owner-cancel refund / reschedule, 6-day window, reprice trail
- `owner-payouts.html` — weekly payout batches, signed totals
- `owner-earnings.html` — consolidated earnings statement + distributions
- `owner-billing.html` — platform subscription invoices, balance, trial, credit ledger

**People**
- `owner-crew.html` — staff roster (per-trip vs salaried), default crew
- `owner-attendance.html` — per-departure present flags + leave state
- `owner-payroll.html` — payroll: base + bonus − deduction, paid tracking
- `owner-team.html` — members / shareholders %, role templates, exited read access

**Operations**
- `owner-costs.html` — the spreadsheet-killer one-row cost entry (Bangla numerals)
- `owner-inventory.html` — consumables (reorder alert) + durables (count, discrepancy)
- `owner-maintenance.html` — boat maintenance / service log (research-added; no schema table yet)
- `owner-reports.html` — cost & profit per trip / period
- `owner-notifications.html` — this boat's notification delivery log
- `owner-audit.html` — append-only audit log, device vs server time
- `owner-sync.html` — offline replay / conflict queue
- `owner-settings.html` — notification prefs, platform billing config (read-only), danger zone

## Build notes

Screens are generated to guarantee an identical shell / design system across all
files (same approach and **same v2 "craft pass" design system** as `../admin`:
Space Grotesk display font, warm-neutral light + near-black dark canvas, Soft-UI
elevation, glass topbar, signature KPI stat cards, page-load motion):

- `_shell.html` — canonical skeleton + full CSS design system (reference; not a nav target)
- `_gen.js` — holds the shared `<head>`/CSS/sidebar/boat-switcher/script once, stamps each
  screen; `upgradeKpis()` rewrites flat `.kpi` markup into the v2 stat-card structure at build time
- `content-*.js` — per-group page bodies: overview / bookings / trips / setup / money / people / ops

The content modules keep the compact flat `.kpi` markup; the generator upgrades it.
Old token names used in custom owner components (cabin grid, bill rows, calendar)
resolve through a small back-compat alias block in `_shell.html`'s `:root`.

Regenerate after editing any content module or the shell:

```bash
node _gen.js
```

`owner-login.html` is hand-written (it has no shell) and is **not** produced by the
generator.

## Sample data

Everything is anchored to one boat — **Jol Kolol** (Tanguar Haor, reused from the
admin previews and `backend/prisma/seed.ts`) — and kept internally consistent so a
reviewer can trace one departure from dashboard → POS → invoice → payout → payroll.
Money in `৳`, BD phone format, the logic doc's worked invoice (room ৳10,000 →
customer pays ৳9,162 → boat gets ৳8,482).

## Scope note

Screens are **business-shaped, not one-per-table**. Three were added from research
into how boat-charter / houseboat operators actually run day-to-day (industry SaaS +
the Bangladesh Tanguar/Nikli Haor model), not from the schema alone: **guests**
(CRM), **earnings** (owner statement), and **maintenance** (boat log — the one
screen with no backing table yet).
