# Houseboat SaaS — Business Logic

Every rule the system enforces. The schema says what data exists; this says what the system does.

---

## 1. Pricing

### Finding the room price
No calculation. The owner sets prices directly.

1. Customer picks a date → boat cards show a **price range** (cheapest to dearest room on that boat for that date).
2. If the date falls in a special price list (Eid, weekend, full moon) → show those prices. Otherwise → regular prices.
3. Customer picks a boat, then a room.
4. Owner has pre-set the price for 1 person, 2 people, 3 people… up to that room's capacity. System reads it.

**Rules**
- Owner sets both room capacity and the price for each headcount.
- A price must exist for every headcount a room can hold — warn the owner on save if any is blank.
- Two profiles claiming the same date is a config error. Reject on save, not at runtime.

### Building the bill — fixed order
| Step | Operation |
|---|---|
| 1 | `room_total` = owner-set price for the chosen headcount |
| 2 | `gateway_fee` = platform % of `room_total` |
| 3 | `price_shown` = `room_total + gateway_fee` ← customer sees this |
| 4 | `discount_amount` = coupon applied to `price_shown` **(coupon is LAST)** |
| 5 | `display_total` = `price_shown − discount_amount` ← customer pays this |
| 6 | `commission` = platform % of **`room_total`** (the original, NOT discounted) |
| 7 | `due_to_boat` = amount received − commission |

**Worked example**
```
Room                    10,000
+ gateway fee (1.8%)       180
= shown to customer     10,180
− 10% coupon            −1,018
= customer pays          9,162
  platform receives      8,982
− commission (5% of 10,000) 500
= boat receives          8,482
```
The boat absorbs the full cost of its own coupon — commission is unaffected by discounts.

### Group bookings
1. Customer picks an owner-defined band (e.g. "15–20 people — ৳150,000") and types the headcount.
2. Reject if headcount falls outside the band.
3. Band price becomes the bill. **No per-guest split** — customer sees one total only.
4. One person pays the whole amount.

---

## 2. Cabin holds — why double-booking is impossible

### Taking a hold
1. Customer or owner taps a room.
2. `INSERT INTO cabin_hold (cabin_id, departure_id, state='held', expires_at = now + 10 min)`
3. Partial unique index rejects the second simultaneous insert → show "just taken", refresh grid. **Do not retry.**
4. Decrement `trip_departure.available_count` in the same transaction.
5. Return `expires_at` from the **server** — client counts down from this, never its own clock.

### Hold resolution — three exits
| Trigger | Result |
|---|---|
| Payment succeeds | `state = converted`, `booking_cabin` row created |
| 10 min elapse | `state = released`, `available_count` incremented |
| Payment fails | `state = released`, `available_count` incremented |

A hold never stays `held` past `expires_at` — a sweeper job enforces it. The sweeper must be idempotent.

**Rules**
- Multiple rooms in one cart share **one** expiry, extended to the newest hold on each addition.
- On payment initiation, extend the hold once (+5 min) to cover the gateway round-trip.

### Waitlist release
1. A cancellation frees a room.
2. **All** waitlisted customers notified simultaneously.
3. Notification link routes through a normal hold attempt.
4. First to hold wins. Others see "just taken" **before** entering details — not after paying.

No queue positions. Rate-limit hold attempts per cabin to absorb the click spike.

---

## 3. Leftover guests & open seats

### Creating the open seat
1. Party doesn't fill capacity (3 people into 2-person rooms → one alone).
2. `booking_cabin.is_open_seat = true`.
3. Invoice shows the **buyout amount** (full capacity price).
4. Customer pays only the deposit — never the full amount in this booking type.
5. Room shows to others on that departure as "1 place spare".

### Someone joins
1. Another party books the spare place at their own headcount price.
2. First booker's invoice **drops** by that amount.
3. Commission recalculated on the new total.
4. If already paid more than the new total → surplus becomes `customer_credit`.

**Example** — room capacity 3, owner priced 1 person ৳5,000 / 2 people ৳10,000:
```
Solo booking          bill 10,000, advance 3,000, due 7,000
Nobody joins          pays the 7,000 due
Someone joins (5,000) first booker's due drops to 2,000
```
The invoice only ever moves **down**.

### Cutoff
1. Departure time arrives → stop granting holds on that departure.
2. Freeze, then finalise one minute later.
3. Whatever the invoice reads is final. Unfilled = buyout stands. Nothing refunded — full was never charged.

---

## 4. Invoice state machine

Every legal transition. Reject anything not listed — never trust the UI.

### Path A — normal booking
```
customer_due → paid → payment_verified → in_payout (LOCKED) → bill_cleared
```
- `paid`: customer settles balance, cash or online.
- `payment_verified`: a finance person **manually** checks the gateway portal. Deliberately human — catches gateway bugs and fraud.
- `in_payout`: pulled into the weekly batch. **This lock prevents refund double-spend.**
- Cash payments are verified by the boat manager, not finance — they never touch the gateway.

### Path B — customer cancels
```
cancelled → payment_verified → in_payout → bill_cleared
```
- Refund follows the boat's **policy template**: Flexible / Moderate / Strict / Non-refundable / Custom.
- Blackout dates (Eid, festivals) → 0% regardless of template.
- Refund % applies to `amount_paid`, not `display_total`.
- **Platform keeps its commission either way.**
- A customer cancellation never reaches `refund_requested`.

### Path C — owner cancels
```
refund_requested → refund_verified → refund_completed
```
Customer chooses one:
| Choice | Result |
|---|---|
| Request refund | Finance verifies → collects bank details → transfers → `refund_completed` |
| Reschedule | Invoice **reprices at the new date**; advance carries over as credit; previous trip kept on record |
| Do nothing | Money stays with the platform; invoice follows Path B |

**Rules**
- **6-day claim window** from cancellation. After that the refund option disappears entirely.
- `requested_by`, `verified_by`, `completed_by` must not all be the same person.
- If the invoice is already `in_payout`, pull it from the batch before starting a refund.
- Rescheduling to an Eid date costs Eid prices — the advance is credit, not a locked price.

---

## 5. Settlement & payout

Weekly. Manual verification is deliberate; batching is where the efficiency comes from.

1. Finance opens "Due payments per boat".
2. Collect all invoices for that boat where `status = payment_verified`.
3. `batch_total = Σ due_to_boat` — **signed, can be negative**.
4. If negative (low deposit + cash balance + commission), offset against `houseboat_billing_config.platform_balance`.
5. If the debt exceeds the platform fee → boat pays the platform directly, or **access is denied**.
6. `prepared_by` = finance user A. `approved_by` = finance user B — **must differ**.
7. Transfer → invoices become `bill_cleared` → payout invoice appears on the owner's dashboard.

**Rules**
- Cash never entered the platform account, so it never enters `due_to_boat`.
- An invoice already `in_payout` cannot enter a second batch.
- Sort the verification queue by risk: large amounts, first-time boats, unusual patterns first.

---

## 6. Offline & sync

### Allowed offline
| Allowed | Blocked |
|---|---|
| Cost entry | Creating a new booking |
| Stock movement | Cancelling a trip |
| Mark cash paid | |
| Mark Not Arrived | |
| Date change | |

Booking needs the live hold. Cancellation needs customers notified immediately.

### Replay on reconnect
1. Each action queued as an append-only **intent**, not a state overwrite. `device_time` stored; server stamps `server_time`.
2. **Re-authorize** every replayed action against the actor's permissions **as of `device_time`** — a fired manager's queued actions don't apply.
3. Failures → conflict queue for admin review. Never silently applied or dropped.
4. **Same intent** (two admins both mark paid) → idempotent. State changes once, **both** logged.
5. **Different intent** (paid vs void) → flagged for a human. Never auto-merged.
6. Show a summary: "7 actions synced, 1 needs review".

A manipulated device clock can reorder but never erase — `server_time` is authoritative.

---

## 7. Trips & dates

- `duration_days`: 1 = day trip, 2 = 2 days 1 night. Boat cards show **duration**, not departure/arrival times.
- Multi-day trips have an owner-set **start date** and must be booked on it.
- If a customer picks the middle day (Jan 2 of a Jan 1–2 trip): show the **Jan 1 trip** with a warning that it starts Jan 1 and nearby trips start Jan 1 or Jan 3.
- Only dates in `houseboat.operating_dates[]` are bookable. Everything else is invisible.
- Status is time-driven: departure time passes → `in_progress`; arrival passes → `completed`.

---

## 8. Crew, attendance & payroll

### Assignment
1. New departure created → `trip_crew` rows auto-written from `houseboat.default_crew[]`.
2. Owner edits only when someone differs that day. The default is untouched.
3. **Attendance = a `trip_crew` row existing with `present = true`.** No separate screen.

"Not assigned today" ≠ "absent" — `staff_leave.state` distinguishes `on_leave` / `available` / `other_duty`. Leave applies to per-trip crew too.

### Payroll
```
salaried  → total = monthly_salary
per-trip  → base = per_trip_rate × trips_worked
total = base + bonus − deduction
```
Owner tracks `paid` / `paid_at` / `paid_by`. Full history retained.

---

## 9. Inventory

### Consumables (rice, oil, gas, fuel)
1. Stock logged out → `current_qty −= qty`.
2. If `current_qty < reorder_threshold` → notify owner: low stock.

### Durables (life jackets, bedsheets, plates)
1. **Owner runs a count whenever they choose** — not automatically after every trip.
2. System compares actual against expected.
3. `discrepancy > 0` → flagged. Something is missing.

`logged_by` is captured automatically from the login.

---

## 10. Permissions

Per user, **per boat**. No account type enum — identity derives from relations.

1. Account logs in, picks a boat (boat switcher).
2. Find `houseboat_member` where account + boat, `status = active`.
3. Not found → not an owner here. May still book as a customer.
4. Found → load `role.permissions` JSON (module-by-module view/edit map).
5. Also check `houseboat_staff` for crew access to this boat.

**Rules**
- Same person may be admin on Boat A, restricted on Boat B.
- `is_platform = true` → platform admin/finance, separate path.
- **Every object fetch re-checks authorization** — the role map alone is not enough (IDOR).
- An exited shareholder (`end_date` set) keeps read access to their period only.

---

## 11. Checkout

1. Rooms held. Customer taps continue.
2. Not logged in → register/login here. **Rooms stay held.**
3. Lead guest name + phone.
4. Special requests / food notes.
5. **Coupon code.**
6. **Reference name** — free text, optional. Who referred them.
7. Full price + the boat's cancellation policy shown **before** payment.
8. Choose deposit or full payment.
9. Payment fails → rooms released, told plainly, can retry.
10. Payment succeeds → **instant confirmation**, no owner approval.
11. E-ticket by SMS + email.

The policy shown is stamped onto the invoice (`policy_snapshot`) — disputes cite what was agreed that day, not the boat's current policy.

Head counts (adults/children per room) are collected at the **room selection** step, not here, because they set the price.
