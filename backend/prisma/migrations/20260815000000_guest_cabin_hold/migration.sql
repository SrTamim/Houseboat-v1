-- Guest-owned cabin holds.
--
-- Until now a hold had to belong to an account (held_by NOT NULL, FK to
-- account), so a cabin could only be locked after login. The customer boat page
-- needs to lock a cabin for a visitor who has not signed in yet, then hand that
-- hold over when they log in at checkout.
--
-- A hold is therefore owned by EITHER an account (held_by) OR an opaque
-- per-browser token (held_by_token), never both and never neither.
--
-- NOTE: uq_cabin_hold_active (cabin_id, departure_id) WHERE state='held' is
-- deliberately NOT touched. That index is what makes double-booking impossible
-- and it does not care who owns the row — one live hold per cabin per
-- departure, whoever holds it.

-- 1. An account is no longer required. The FK stays: when held_by IS NOT NULL
--    it must still reference a real account.
ALTER TABLE "cabin_hold" ALTER COLUMN "held_by" DROP NOT NULL;

-- 2. The guest owner. Opaque random id from the hb_gid cookie — not a session,
--    not a credential; it only answers "is this the browser that took the hold?"
ALTER TABLE "cabin_hold" ADD COLUMN IF NOT EXISTS "held_by_token" TEXT;

-- 3. Exactly one owner. Without this a row could end up orphaned (no owner, so
--    nobody can release or convert it) or ambiguous (two owners, so the cart
--    sweep and the release check disagree about whose it is).
ALTER TABLE "cabin_hold" DROP CONSTRAINT IF EXISTS "cabin_hold_one_owner";
ALTER TABLE "cabin_hold" ADD CONSTRAINT "cabin_hold_one_owner"
  CHECK (("held_by" IS NOT NULL) <> ("held_by_token" IS NOT NULL));

-- 4. The shared-cart sweep looks up every live hold of one owner on one
--    departure to put them on a single countdown. Accounts already have an
--    index path via the FK; guests need one.
CREATE INDEX IF NOT EXISTS "cabin_hold_held_by_token_idx"
  ON "cabin_hold" ("held_by_token");
