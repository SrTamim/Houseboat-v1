# Houseboat SaaS — Database Schema

41 tables across 7 modules. PostgreSQL. UUID primary keys throughout.

**Source of truth:** `houseboat.dbml` — paste into dbdiagram.io for the live diagram, export SQL to run.

---

## Identity, RBAC & Audit

### `account`

> One login per person. A single human can be a customer, an owner (via houseboat_member) AND crew (via houseboat_staff) at once.

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  | UUIDv7 — time-ordered, non-enumerable (no sequential IDs in URLs) |
| `name` | varchar |  |  |  |
| `email` | varchar |  |  |  |
| `phone` | varchar |  |  |  |
| `password_hash` | varchar |  |  | argon2/bcrypt; never plaintext |
| `phone_verified` | boolean |  |  |  |
| `is_platform` | boolean |  |  | true = your own admin/finance staff. NO type enum: what a person IS derives from relations below |
| `created_at` | timestamp |  |  |  |

### `houseboat_member`

> Per-boat permissions. Same person can be admin on one boat, restricted shareholder on another.

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `account_id` | uuid | FK | `account.id` |  |
| `houseboat_id` | uuid | FK | `houseboat.id` |  |
| `role_id` | uuid | FK | `role.id` |  |
| `shareholder_pct` | decimal |  |  | record only — no auto profit-split |
| `start_date` | date |  |  |  |
| `end_date` | date |  |  | null = current; set on exit, keeps historical read access |
| `status` | varchar |  |  | active / exited |

### `role`

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `houseboat_id` | uuid | FK | `houseboat.id` |  |
| `name` | varchar |  |  | owner-named via role generator: Owner, Shareholder, Manager… |
| `is_template` | boolean |  |  |  |
| `permissions` | json |  |  | per-module view/edit map: {"bookings":{"view":true,"edit":false},…} — read as a unit at login |

### `audit_log`

> APPEND-ONLY. No UPDATE, no DELETE — enforce with a DB trigger/rule. Also the offline-sync replay store. Partition by month. Replayed actions are re-authorized against permissions as of device_time. OFFLINE-ALLOWED: date change, invoice update (mark cash paid / not arrived), cost entry, stock movement. OFFLINE-BLOCKED: new bookings and trip cancellation (both need connectivity).

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `houseboat_id` | uuid | FK | `houseboat.id` | null for platform-level actions |
| `actor_account_id` | uuid | FK | `account.id` |  |
| `action` | varchar |  |  | mark_paid, void, price_change, role_change… |
| `entity_type` | varchar |  |  |  |
| `entity_id` | uuid |  |  |  |
| `before` | json |  |  | mask PII — store refs not raw bank details |
| `after` | json |  |  |  |
| `device_time` | timestamp |  |  | clock on the device — may be manipulated |
| `server_time` | timestamp |  |  | authoritative |
| `synced_offline` | boolean |  |  |  |

---

## Houseboat Assets

### `houseboat`

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `name` | varchar |  |  |  |
| `slug` | varchar |  |  | public URL: /houseboat/[slug] |
| `description` | text |  |  |  |
| `safety_features` | text |  |  |  |
| `food_menu` | text |  |  |  |
| `bank_account` | json |  |  | MANDATORY before any payout can run |
| `profile_complete_pct` | int |  |  | reaches 100 → admin can approve |
| `status` | varchar |  |  | draft / pending / live / suspended |
| `billing_config_id` | uuid | FK | `houseboat_billing_config.id` |  |
| `operating_dates` | date[] |  |  | only these dates generate bookable departures |
| `default_crew` | uuid[] |  |  | staff ids auto-assigned to every new departure |
| `child_policy` | json |  |  | age bands: [{min,max,charge_pct}] e.g. 0-3 free, 3-5 half, 5+ full |
| `created_at` | timestamp |  |  |  |

### `houseboat_deck`

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `houseboat_id` | uuid | FK | `houseboat.id` |  |
| `name` | varchar |  |  | Lower, Upper |
| `position` | int |  |  |  |

### `houseboat_cabin`

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `deck_id` | uuid | FK | `houseboat_deck.id` |  |
| `cabin_category_id` | uuid | FK | `houseboat_cabin_category.id` |  |
| `name` | varchar |  |  | 101, 102 |
| `grid_row` | int |  |  | auto-generated 2x2 grid; not a positioning builder |
| `grid_col` | int |  |  |  |

### `houseboat_cabin_category`

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `houseboat_id` | uuid | FK | `houseboat.id` |  |
| `name` | varchar |  |  | Luxury AC, Family… |
| `is_ac` | boolean |  |  |  |
| `base_capacity` | int |  |  |  |
| `extended_capacity` | int |  |  | group-booking overflow, owner-set |
| `facilities` | text |  |  |  |

### `route`

> Admin-managed. Owners pick from these; they cannot create routes.

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `name` | varchar |  |  | Tanguar Haor, Nikli Haor… PLATFORM-curated |
| `region` | varchar |  |  |  |
| `active` | boolean |  |  |  |

### `houseboat_route`

> Many-to-many: which boats run which routes.

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `houseboat_id` | uuid | FK | `houseboat.id` |  |
| `route_id` | uuid | FK | `route.id` |  |

---

## Trips, Schedule & Pricing

### `trip_package`

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `houseboat_id` | uuid | FK | `houseboat.id` |  |
| `route_id` | uuid | FK | `route.id` |  |
| `duration_days` | int |  |  | e.g. 1 = day trip, 2 = 2 days 1 night — shown on boat cards instead of times |
| `duration_label` | varchar |  |  | display text: "2 days 1 night" |
| `departure_ghat` | varchar |  |  |  |
| `return_ghat` | varchar |  |  |  |
| `meals` | text |  |  |  |
| `included` | text |  |  |  |
| `excluded` | text |  |  |  |
| `cancellation_policy_id` | uuid | FK | `cancellation_policy.id` |  |

### `trip_departure`

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `package_id` | uuid | FK | `trip_package.id` |  |
| `start_date` | date |  |  | multi-day trips MUST be booked on the start date; picking a middle day shows this trip with a warning |
| `end_date` | date |  |  | start_date + duration_days - 1 |
| `departure_time` | time |  |  | shown on the boat page, not on search cards |
| `arrival_time` | time |  |  |  |
| `pricing_profile_id` | uuid | FK | `pricing_profile.id` |  |
| `available_count` | int |  |  | DENORMALIZED cabin availability — updated transactionally on every hold/release/booking so search is one lookup, not a recompute |
| `status` | varchar |  |  | scheduled / in_progress / completed / cancelled — time-driven job, UTC stored |

### `pricing_profile`

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `houseboat_id` | uuid | FK | `houseboat.id` |  |
| `name` | varchar |  |  | General Day, Weekend, Eid, Full Moon |
| `is_default` | boolean |  |  | General Day = base/fallback |
| `dates` | date[] |  |  | dates this profile applies to; null/empty for the default profile. GIN-index for date lookups |

### `pricing_rule`

> Each profile owns a FULL independent price table — not a multiplier on a base.

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `pricing_profile_id` | uuid | FK | `pricing_profile.id` |  |
| `cabin_category_id` | uuid | FK | `houseboat_cabin_category.id` |  |
| `occupancy` | int |  |  | 2, 3, 4… per-person price varies by how many share |
| `price_per_person` | decimal |  |  |  |

### `group_price_band`

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `houseboat_id` | uuid | FK | `houseboat.id` |  |
| `min_people` | int |  |  |  |
| `max_people` | int |  |  |  |
| `total_price` | decimal |  |  | full-boat buyout; customer picks band then types headcount |

---

## Bookings, Holds & Waitlist

### `booking`

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `departure_id` | uuid | FK | `trip_departure.id` |  |
| `customer_id` | uuid | FK | `account.id` |  |
| `booked_by` | uuid | FK | `account.id` | owner in POS mode, else the customer |
| `type` | varchar |  |  | cabin / group / quote |
| `headcount` | int |  |  |  |
| `special_instructions` | text |  |  |  |
| `coupon_id` | uuid | FK | `coupon.id` |  |
| `reference_name` | varchar |  |  | free text, optional — who referred/sent the customer; entered at checkout below the coupon field |
| `status` | varchar |  |  | confirmed / rescheduled / cancelled / not_arrived / completed |
| `reschedule_of` | uuid | FK | `booking.id` | see booking_reschedule_history for the full chain |
| `created_at` | timestamp |  |  |  |

### `booking_cabin`

> ENFORCE unique (cabin_id, departure via booking) among ACTIVE rows so two bookings cannot take one cabin. Do it at the DB, not in app code.

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `booking_id` | uuid | FK | `booking.id` |  |
| `cabin_id` | uuid | FK | `houseboat_cabin.id` |  |
| `adults` | int |  |  | chosen at the ROOM SELECTION step — this is what sets the price |
| `children` | int |  |  | charged per houseboat.child_policy |
| `occupancy` | int |  |  | adults + children — must not exceed capacity (or extended_capacity for groups) |
| `room_price` | decimal |  |  | owner-set price for this many people in this room; not calculated |
| `is_open_seat` | boolean |  |  | leftover shared inventory — spare place bookable by another party |

### `booking_guest`

> Only the lead guest is recorded by name. Head counts live on booking_cabin (adults/children per room) because that is what sets the price.

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `booking_id` | uuid | FK | `booking.id` |  |
| `name` | varchar |  |  | lead guest only — captured at checkout for contact |
| `phone` | varchar |  |  |  |

### `booking_reschedule_history`

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `booking_id` | uuid | FK | `booking.id` |  |
| `prev_departure_id` | uuid | FK | `trip_departure.id` |  |
| `changed_to_departure_id` | uuid | FK | `trip_departure.id` |  |
| `old_price` | decimal |  |  |  |
| `new_price` | decimal |  |  | reschedule REPRICES at the new date; advance adjusts against new amount |
| `reason` | varchar |  |  |  |
| `changed_by` | uuid | FK | `account.id` |  |
| `changed_at` | timestamp |  |  |  |

### `cabin_hold`

> ENFORCE partial unique index on (cabin_id, departure_id) WHERE state = held. The second simultaneous tap fails at the DB. This is what kills double-booking.

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `cabin_id` | uuid | FK | `houseboat_cabin.id` |  |
| `departure_id` | uuid | FK | `trip_departure.id` |  |
| `held_by` | uuid | FK | `account.id` |  |
| `expires_at` | timestamp |  |  | 10-min TTL; server clock is authoritative, not the device |
| `state` | varchar |  |  | held / converted / released |

### `booking_waitlist`

> All notified at once when a cabin frees; the link routes through a HOLD attempt so first-to-hold wins, not first-to-checkout.

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `departure_id` | uuid | FK | `trip_departure.id` |  |
| `customer_id` | uuid | FK | `account.id` |  |
| `party_size` | int |  |  |  |
| `created_at` | timestamp |  |  |  |

### `quote_request`

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `houseboat_id` | uuid | FK | `houseboat.id` |  |
| `customer_id` | uuid | FK | `account.id` |  |
| `date` | date |  |  |  |
| `group_size` | int |  |  |  |
| `special_needs` | text |  |  |  |
| `quoted_price` | decimal |  |  | null until owner prices it |
| `status` | varchar |  |  | requested / sent / accepted / expired |
| `expires_at` | timestamp |  |  | 24h OR when the date fills, whichever first |

---

## Money: Invoices, Payments, Refunds, Payouts

### `invoice`

> ONE invoice per booking, three party-views (customer / boat / finance). BILL ORDER: room_total + gateway_fee = price_shown; price_shown - coupon = display_total (customer pays). Commission is % of room_total, NOT the discounted amount. Worked example: room 10,000 + 180 fee = 10,180 shown; 10% coupon = 9,162 paid; received 8,982; commission 500; boat gets 8,482.

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `booking_id` | uuid | FK | `booking.id` |  |
| `houseboat_id` | uuid | FK | `houseboat.id` |  |
| `customer_id` | uuid | FK | `account.id` |  |
| `room_total` | decimal |  |  | STEP 1: owner-set room price (sum of all booking_cabin.room_price) |
| `gateway_fee` | decimal |  |  | STEP 2: platform % of room_total, added on top |
| `price_shown` | decimal |  |  | STEP 3: room_total + gateway_fee — what the customer sees BEFORE any coupon |
| `discount_amount` | decimal |  |  | STEP 4: coupon applied LAST, to price_shown |
| `display_total` | decimal |  |  | STEP 5: price_shown - discount_amount = what the customer actually pays |
| `commission` | decimal |  |  | platform % of room_total (the ORIGINAL price, NOT discounted) — the boat absorbs its own coupon |
| `due_to_boat` | decimal |  |  |  |
| `amount_paid` | decimal |  |  |  |
| `amount_overpaid` | decimal |  |  | buyout adjusted below what was paid → surfaces here, becomes customer_credit or refund |
| `policy_snapshot` | json |  |  | cancellation policy the customer agreed to at checkout — cite it in disputes |
| `payout_batch_id` | uuid | FK | `houseboat_payout_batch.id` | null until pulled into a weekly batch; setting it locks the invoice (status in_payout) |
| `status` | varchar |  |  | customer_due / paid / payment_verified / in_payout / bill_cleared / cancelled / refund_requested / refund_verified / refund_completed. LOCK to in_payout on batch entry so no refund can double-spend. |

### `invoice_payment`

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `invoice_id` | uuid | FK | `invoice.id` |  |
| `amount` | decimal |  |  |  |
| `method` | varchar |  |  | gateway / cash |
| `gateway_token` | varchar |  |  | unique-indexed → webhook replay is a no-op |
| `received_by` | uuid | FK | `account.id` | who marked a cash payment |
| `verified_by` | uuid | FK | `account.id` | finance for gateway; boat manager for cash |
| `paid_at` | timestamp |  |  |  |

### `invoice_refund`

> Only reachable when the OWNER cancelled the trip, and only within 6 days of that cancellation. Customer-cancel refunds follow the boat cancellation_policy template instead.

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `invoice_id` | uuid | FK | `invoice.id` |  |
| `amount` | decimal |  |  |  |
| `reason` | varchar |  |  |  |
| `bank_details` | json |  |  | ENCRYPT at rest; collected only after owner-cancel |
| `requested_by` | uuid | FK | `account.id` |  |
| `verified_by` | uuid | FK | `account.id` |  |
| `completed_by` | uuid | FK | `account.id` | separation of duties: not the same person as verified_by |
| `status` | varchar |  |  | requested / verified / completed |
| `claim_deadline` | timestamp |  |  | 6 days from the owner cancellation; after this the refund button disappears entirely |
| `completed_at` | timestamp |  |  |  |

### `houseboat_payout_batch`

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `houseboat_id` | uuid | FK | `houseboat.id` |  |
| `total_amount` | decimal |  |  | SIGNED — can be negative if the boat owes the platform |
| `prepared_by` | uuid | FK | `account.id` |  |
| `approved_by` | uuid | FK | `account.id` | separation of duties: must differ from prepared_by |
| `status` | varchar |  |  | prepared / approved / paid |
| `paid_at` | timestamp |  |  |  |

### `cancellation_policy`

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `houseboat_id` | uuid | FK | `houseboat.id` |  |
| `policy_template` | varchar |  |  | flexible / moderate / strict / non_refundable / custom (Airbnb-style). Owner picks per boat. non_refundable = flat no-refund. |
| `deposit_pct` | int |  |  |  |
| `shown_at_checkout` | boolean |  |  |  |
| `tiers` | json |  |  | custom template tiers + blackout dates: [{days_before,refund_pct,is_blackout}]; blackout → 0% regardless of template |

### `coupon`

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `houseboat_id` | uuid | FK | `houseboat.id` |  |
| `code` | varchar |  |  |  |
| `kind` | varchar |  |  | percent / flat / referral |
| `value` | decimal |  |  |  |
| `valid_from` | date |  |  |  |
| `valid_to` | date |  |  |  |

### `houseboat_billing_config`

> Platform-set per boat. Commission AND monthly can both apply. Billing is PER BOAT — never combined across a multi-boat owner.

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `houseboat_id` | uuid | FK | `houseboat.id` |  |
| `commission_pct` | decimal |  |  | null if not on commission |
| `monthly_fee` | decimal |  |  | null if not on monthly |
| `gateway_fee_pct` | decimal |  |  |  |
| `platform_balance` | decimal |  |  | SIGNED. Negative = boat owes the platform. Offsets the platform fee; if exceeded, access denied until settled. |
| `trial_ends` | date |  |  |  |

### `houseboat_subscription_invoice`

> The monthly bill the PLATFORM sends the boat — separate from booking-commission invoices.

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `houseboat_id` | uuid | FK | `houseboat.id` |  |
| `billing_config_id` | uuid | FK | `houseboat_billing_config.id` |  |
| `period` | varchar |  |  |  |
| `monthly_fee` | decimal |  |  |  |
| `commission_total` | decimal |  |  |  |
| `amount_due` | decimal |  |  |  |
| `status` | varchar |  |  | issued / paid / overdue |
| `issued_at` | timestamp |  |  |  |

### `owner_distribution`

> Records money a shareholder actually withdrew. No auto-split — just the record, so co-owners can see distributions.

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `houseboat_id` | uuid | FK | `houseboat.id` |  |
| `membership_id` | uuid | FK | `houseboat_member.id` |  |
| `amount` | decimal |  |  |  |
| `note` | varchar |  |  |  |
| `recorded_by` | uuid | FK | `account.id` |  |
| `at` | timestamp |  |  |  |

### `customer_credit`

> Home for buyout overpayments (invoice.amount_overpaid) — credit toward a future booking.

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `account_id` | uuid | FK | `account.id` |  |
| `source_invoice_id` | uuid | FK | `invoice.id` |  |
| `amount` | decimal |  |  |  |
| `used_in_invoice_id` | uuid | FK | `invoice.id` | null until spent |
| `status` | varchar |  |  | open / used |

---

## HR: Staff, Crew, Payroll

### `houseboat_staff`

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `account_id` | uuid | FK | `account.id` | links to a login |
| `houseboat_id` | uuid | FK | `houseboat.id` |  |
| `role_id` | uuid | FK | `role.id` |  |
| `nid` | varchar |  |  |  |
| `emergency_contact` | varchar |  |  |  |
| `per_trip_rate` | decimal |  |  | own rate — a sukani is not paid like a cleaner |
| `monthly_salary` | decimal |  |  | set instead of per_trip_rate for salaried staff |

### `trip_crew`

> Auto-filled from houseboat_default_crew; owner edits only when someone differs that day.

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `departure_id` | uuid | FK | `trip_departure.id` |  |
| `staff_id` | uuid | FK | `houseboat_staff.id` |  |
| `present` | boolean |  |  | attendance = this row existing + present flag |

### `staff_leave`

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `staff_id` | uuid | FK | `houseboat_staff.id` |  |
| `state` | varchar |  |  | on_leave / available / other_duty — NOT the same as "not assigned today" |
| `from_date` | date |  |  |  |
| `to_date` | date |  |  |  |
| `note` | varchar |  |  |  |

### `staff_payroll`

> Full payment history is kept — owners need to know who has and has not been paid.

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `staff_id` | uuid | FK | `houseboat_staff.id` |  |
| `period` | varchar |  |  |  |
| `trips_worked` | int |  |  |  |
| `base_amount` | decimal |  |  | per_trip_rate × trips_worked, or monthly_salary |
| `bonus` | decimal |  |  | owner may add |
| `deduction` | decimal |  |  | owner may subtract |
| `total_amount` | decimal |  |  | base + bonus - deduction |
| `paid` | boolean |  |  | owner tracks whether the wage was actually handed over |
| `paid_at` | timestamp |  |  |  |
| `paid_by` | uuid | FK | `account.id` |  |

---

## Ops: Costs, Inventory, Reporting

### `cost`

> The spreadsheet-killer. One row, faster than a sheet. Accept Bangla numerals in the amount at the input layer.

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `houseboat_id` | uuid | FK | `houseboat.id` |  |
| `date` | date |  |  |  |
| `description` | text |  |  | free text — no forced category. Bazar, fuel, repair… |
| `amount` | decimal |  |  |  |
| `trip_id` | uuid | FK | `trip_departure.id` | optional — link to a trip or leave null |
| `paid_by` | uuid | FK | `account.id` | auto-captured from the logged-in user |
| `due_to_vendor` | decimal |  |  | optional bonus — no vendor management |

### `inventory_item`

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `houseboat_id` | uuid | FK | `houseboat.id` |  |
| `name` | varchar |  |  |  |
| `kind` | varchar |  |  | consumable (reorder alert) / durable (missing-item check) |
| `unit` | varchar |  |  |  |
| `reorder_threshold` | decimal |  |  | consumables — flag when below |
| `current_qty` | decimal |  |  |  |

### `stock_movement`

> Durable counts are run by the OWNER whenever they choose — not automatically after every trip.

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `inventory_item_id` | uuid | FK | `inventory_item.id` |  |
| `trip_id` | uuid | FK | `trip_departure.id` |  |
| `direction` | varchar |  |  | in / out / count |
| `qty` | decimal |  |  |  |
| `expected_qty` | decimal |  |  | for a count: what the system believed was there |
| `discrepancy` | decimal |  |  | expected - actual; anything above zero is missing |
| `logged_by` | uuid | FK | `account.id` | auto from login |
| `at` | timestamp |  |  |  |

### `review`

> Only from verified completed bookings.

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `booking_id` | uuid | FK | `booking.id` |  |
| `houseboat_id` | uuid | FK | `houseboat.id` |  |
| `customer_id` | uuid | FK | `account.id` |  |
| `rating` | int |  |  |  |
| `text` | text |  |  |  |
| `owner_reply` | text |  |  |  |

### `notification`

| Column | Type | Key | References | Notes |
|---|---|---|---|---|
| `id` | uuid | PK |  |  |
| `account_id` | uuid | FK | `account.id` |  |
| `event` | varchar |  |  | booking, payment_due, refund_sent, low_stock, offer… |
| `channel` | varchar |  |  | sms / email |
| `delivered` | boolean |  |  |  |
| `at` | timestamp |  |  |  |

---

## Key constraints to enforce in the database

| Constraint | Table | Why |
|---|---|---|
| Partial unique index on `(cabin_id, departure_id) WHERE state='held'` | `cabin_hold` | Two simultaneous taps — the second fails at the DB, not in app code. This is what makes double-booking impossible. |
| Unique among active rows `(cabin_id, departure)` | `booking_cabin` | Same cabin cannot be in two live bookings. |
| Append-only trigger (no UPDATE, no DELETE) | `audit_log` | Co-owner fraud evidence. Nobody — not the owner, not the platform — can rewrite history. |
| Unique index on `gateway_token` | `invoice_payment` | A replayed payment webhook becomes a no-op. |
| Monthly partitioning | `audit_log` | Grows forever; also the offline sync store. |
| All timestamps stored UTC | everywhere | Devices, server and invoices must agree on time. |
| `payout_batch.prepared_by != approved_by` | `houseboat_payout_batch` | Separation of duties — no single person moves money. |
