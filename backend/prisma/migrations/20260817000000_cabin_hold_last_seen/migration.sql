-- Heartbeat presence for cabin holds.
--
-- A hold used to be freed early only by an explicit release from the browser
-- (deselect, or a pagehide handler). Unload events are unreliable — mobile
-- browsers frequently skip pagehide entirely, and sendBeacon cannot send the
-- CSRF header this API requires — so closing a tab left cabins locked for the
-- full 10-20 minute TTL.
--
-- Inverted here: the live page reports in every ~30s and the sweeper reclaims
-- holds that stop reporting. A missed heartbeat fails SAFE (the cabin returns to
-- inventory) rather than failing open.
--
-- NULL = this hold has never reported. Such rows must NEVER be reclaimed on the
-- heartbeat rule: the owner POS takes holds through the same endpoint as
-- customers and does not heartbeat, and its counter staff legitimately sit on a
-- hold for the full TTL while taking cash. The sweeper therefore requires
-- last_seen_at IS NOT NULL before applying the grace window.
--
-- NOTE: uq_cabin_hold_active and cabin_hold_one_owner are deliberately NOT
-- touched. expires_at still governs the hard TTL — a heartbeat proves presence,
-- never entitlement, so it must not extend the deadline.
ALTER TABLE "cabin_hold" ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMPTZ;

-- The sweeper filters on this every 60 seconds.
CREATE INDEX IF NOT EXISTS "cabin_hold_last_seen_at_idx"
  ON "cabin_hold" ("last_seen_at");
