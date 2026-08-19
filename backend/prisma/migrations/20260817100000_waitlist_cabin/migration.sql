-- Per-cabin waitlist.
--
-- A waitlist row recorded only (departure, customer), so "notify me about this
-- cabin" was impossible: the boat page sent a cabin id that the API dropped, and
-- WaitlistService.join treated a second cabin on the same trip as a repeat of the
-- first and overwrote it. A customer could therefore wait on exactly one thing
-- per trip, and their account page could only list trips, never cabins.
--
-- NULL means "any cabin on this trip" — precisely what every existing row means,
-- so they keep working with no backfill. The owner waitlist screen, the platform
-- console and both dashboard counts query by departure and never select this
-- column, so they are unaffected.
ALTER TABLE "booking_waitlist" ADD COLUMN IF NOT EXISTS "cabin_id" UUID;

ALTER TABLE "booking_waitlist" DROP CONSTRAINT IF EXISTS "booking_waitlist_cabin_id_fkey";
ALTER TABLE "booking_waitlist" ADD CONSTRAINT "booking_waitlist_cabin_id_fkey"
  FOREIGN KEY ("cabin_id") REFERENCES "houseboat_cabin"("id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- "Who is waiting on THIS cabin?" — the lookup the freed-cabin notification runs.
CREATE INDEX IF NOT EXISTS "booking_waitlist_departure_id_cabin_id_idx"
  ON "booking_waitlist" ("departure_id", "cabin_id");

-- One row per customer per cabin. Until now nothing enforced uniqueness at all —
-- join() de-duped in application code only — so this adds the guarantee rather
-- than replacing one. Safe on the existing data: no (departure, customer) pair is
-- duplicated. Postgres treats NULLs as distinct, so legacy trip-level rows are
-- not constrained against each other; join() still de-dupes those.
CREATE UNIQUE INDEX IF NOT EXISTS "booking_waitlist_departure_id_customer_id_cabin_id_key"
  ON "booking_waitlist" ("departure_id", "customer_id", "cabin_id");
