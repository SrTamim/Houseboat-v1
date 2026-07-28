# Platform Admin Console — Design Preview

> **Ported to the app.** These previews are now the *reference*; the live console is
> React under `frontend/src/app/admin/` (routes `/admin/*`), styled by the global
> `src/app/admin/admin.css` (this design system, verbatim) with self-hosted Inter +
> Space Grotesk. Shared UI lives in `src/components/admin/`, data in `src/lib/admin/`.
> Keep this folder as the design source of truth; update both if the design changes.

Static HTML mockups of the **platform admin console** — the surface the SaaS operator's
own staff (`account.is_platform = true`) run the whole system from. Design preview only:
self-contained HTML, inline CSS, **not wired to the backend**. Companion to the customer
booking-flow previews (`../haorboat-*.html`) — same brand tokens (blue `#1a73e8` + amber,
Inter / Hind Siliguri, light + dark), new admin layout (sidebar + dense tables).

Open any `admin-*.html` directly in a browser. Start at **admin-login.html** →
**admin-dashboard.html**. The theme toggle (🌙/☀️) persists via `localStorage['hb-theme']`.

## Screens (31)

**Standalone**
- `admin-login.html` — platform-staff sign in (phone + password)

**Overview**
- `admin-dashboard.html` — action queue, KPIs, recent activity, system health
- `admin-analytics.html` — GMV, commission/subscription revenue, receivables, risk signals

**Operations**
- `admin-boats.html` — moderation queue, approve (profile 100% + bank), suspend/reinstate
- `admin-routes.html` — platform-curated routes, create, active/retire
- `admin-bookings.html` — cross-boat bookings & invoices, cancel/reschedule, bill breakdown
- `admin-reviews.html` — reviews moderation (verified-only gate, takedown)
- `admin-accounts.html` — account support, cross-boat roles, phone verification
- `admin-memberships.html` — co-owner oversight, shareholder %, distributions
- `admin-waitlist.html` — waitlist depth, notify-all, `available_count` drift reconciliation

**Finance**
- `admin-finance-verify.html` — risk-sorted payment verification, gateway/cash split
- `admin-finance-refunds.html` — request→verify→complete (3-person SoD), 6-day window
- `admin-finance-payouts.html` — weekly batches, preparer≠approver, signed/negative totals
- `admin-finance-overpayments.html` — overpayment → credit/refund resolution
- `admin-finance-credits.html` — customer-credit ledger (liability, aging)
- `admin-finance-commission.html` — commission-integrity audit (room_total × rate)
- `admin-billing.html` — subscription invoices (issue/pay), per boat
- `admin-billing-config.html` — per-boat commission/gateway/monthly/trial editor
- `admin-debtors.html` — negative platform_balance, access-denial control (trial dates now live on billing-config)

**System**
- `admin-jobs.html` — 3 cron jobs health (hold sweeper, departure status, subscription overdue)
- `admin-audit.html` — append-only audit log, device vs server time, evidence export
- `admin-sync.html` — offline-replay conflict queue, clock-skew, permission-lost
- `admin-notifications.html` — delivery monitor, failed SMS/email, resend
- `admin-gateway.html` — SSLCommerz mode, IPN events, replay no-ops, failed/unmatched
- `admin-settings.html` — gateway/notification creds, billing grace, secrets present
- `admin-roles.html` — boat role names (owners set permissions) + platform roles with a per-operation permission matrix

**Disputes & risk**
- `admin-disputes.html` — invoices reported by customers/owners; View (read-only) + Edit (all fields editable)
- `admin-idor.html` — authorization-denial & SoD-violation monitor
- `admin-coupons.html` — coupon/referral abuse oversight
- `admin-reschedules.html` — repricing trail, advance-as-credit
- `admin-cutoff.html` — finalize monitor, unfilled buyouts, stale quotes

## Invoice statuses

The four finance queues (verify / refunds / payouts / overpayments) are **one shared
table + one shared full-invoice drawer** (`partials.js`), each pre-filtered by status.
Screens show these 11 business labels; the real build maps them onto schema states:

| Display label | Schema `invoice.status` |
|---|---|
| Advance Paid | `paid` (partial — deposit only) |
| Due Paid | `paid` (balance settled) |
| Canceled | `cancelled` (customer-initiated) |
| Canceled by Boat | `cancelled` (owner-initiated → refund path) |
| Refund Requested | `refund_requested` |
| Refund Verified | `refund_verified` |
| Refunded | `refund_completed` |
| Ready for Payout | `payment_verified` |
| Payout Verified | `in_payout` |
| Paid to Boat | `bill_cleared` |
| Over Paid | any state with `amount_overpaid > 0` |

Advance/Due Paid and Over Paid are display sub-states derived from `amount_paid` vs
`display_total` and `amount_overpaid` — not separate columns in the schema.

## Build notes

Screens are generated to guarantee an identical shell/design-system across all files:

- `_shell.html` — canonical skeleton + full CSS design system (reference; not a nav target)
- `_gen.js` — holds the shared `<head>`/CSS/sidebar/script once, stamps each screen
- `partials.js` — shared invoice table + full-invoice drawer (four finance queues), plus the editable invoice drawer (disputes) and the printable subscription-invoice drawer
- `content-*.js` — per-group page bodies (overview / operations / finance / system / disputes)

Regenerate after editing any content module or the shell:

```bash
node _gen.js
```

`admin-login.html` is hand-written (it has no shell) and is **not** produced by the generator.

## Sample data

Every screen ships fully populated, anchored to `backend/prisma/seed.ts` (boats *Jol Kolol*,
*Haor Bilash*; routes Tanguar/Nikli Haor; admin `+8801700000000`) and kept internally
consistent — trace one boat/invoice from dashboard → bookings → finance → audit. Money in
`৳`, BD phone format, the logic doc's worked invoice (room ৳10,000 → customer pays ৳9,162 →
boat gets ৳8,482).
