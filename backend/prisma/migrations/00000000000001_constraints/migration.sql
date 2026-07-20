-- ============================================================
--  Hand-written constraints Prisma cannot express.
--  Run AFTER the generated schema migration. These are the rules
--  the plan says MUST live in the database, not app code.
--
--  NOTE: keep this migration idempotent-ish (IF NOT EXISTS) so it
--  survives re-runs during early dev.
-- ============================================================

-- ── 1. cabin_hold: partial unique index ──────────────────────
-- The single most important line in the system. Two simultaneous
-- taps on the same cabin+departure: the second INSERT fails at the
-- DB. This is what makes double-booking impossible. (plan §2)
CREATE UNIQUE INDEX IF NOT EXISTS uq_cabin_hold_active
  ON cabin_hold (cabin_id, departure_id)
  WHERE state = 'held';

-- ── 2. booking_cabin: one active booking per cabin per departure ─
-- booking_cabin has no departure_id column (it hangs off booking),
-- so we cannot write a plain partial unique index. Enforce with a
-- trigger that rejects a second ACTIVE (non-cancelled) booking_cabin
-- for the same cabin on the same departure. (plan schema note)
CREATE OR REPLACE FUNCTION enforce_one_active_cabin_per_departure()
RETURNS TRIGGER AS $$
DECLARE
  dep uuid;
  clash int;
BEGIN
  SELECT departure_id INTO dep FROM booking WHERE id = NEW.booking_id;

  SELECT count(*) INTO clash
  FROM booking_cabin bc
  JOIN booking b ON b.id = bc.booking_id
  WHERE bc.cabin_id = NEW.cabin_id
    AND b.departure_id = dep
    AND b.status NOT IN ('cancelled')
    AND bc.id <> NEW.id;

  IF clash > 0 THEN
    RAISE EXCEPTION 'cabin % already booked on this departure', NEW.cabin_id
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_one_active_cabin ON booking_cabin;
CREATE TRIGGER trg_one_active_cabin
  BEFORE INSERT OR UPDATE ON booking_cabin
  FOR EACH ROW EXECUTE FUNCTION enforce_one_active_cabin_per_departure();

-- ── 3. audit_log: APPEND-ONLY ────────────────────────────────
-- No UPDATE, no DELETE — ever. This is the co-owner fraud evidence
-- store; nobody rewrites history, not even the platform. (plan §Audit)
CREATE OR REPLACE FUNCTION audit_log_block_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_no_update ON audit_log;
CREATE TRIGGER trg_audit_no_update
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutation();

-- ── 4. pricing_profile.dates: GIN index for date lookups ─────
-- Search resolves "which profile applies to date X" against this. (plan)
CREATE INDEX IF NOT EXISTS idx_pricing_profile_dates_gin
  ON pricing_profile USING GIN (dates);

-- ── 5. houseboat.operating_dates: GIN index ──────────────────
CREATE INDEX IF NOT EXISTS idx_houseboat_operating_dates_gin
  ON houseboat USING GIN (operating_dates);

-- ── 6. Guard rails on separation-of-duties (defence in depth) ─
-- App enforces these too, but a CHECK stops a bad direct write.
ALTER TABLE houseboat_payout_batch
  DROP CONSTRAINT IF EXISTS chk_payout_prepared_ne_approved;
ALTER TABLE houseboat_payout_batch
  ADD CONSTRAINT chk_payout_prepared_ne_approved
  CHECK (approved_by IS NULL OR prepared_by IS NULL OR approved_by <> prepared_by);

ALTER TABLE invoice_refund
  DROP CONSTRAINT IF EXISTS chk_refund_verified_ne_completed;
ALTER TABLE invoice_refund
  ADD CONSTRAINT chk_refund_verified_ne_completed
  CHECK (completed_by IS NULL OR verified_by IS NULL OR completed_by <> verified_by);

-- ── 7. Rating range on reviews ───────────────────────────────
ALTER TABLE review
  DROP CONSTRAINT IF EXISTS chk_review_rating;
ALTER TABLE review
  ADD CONSTRAINT chk_review_rating CHECK (rating BETWEEN 1 AND 5);

-- NOTE: audit_log monthly partitioning is deferred to its own migration
-- once the table shape is stable — partitioning a table with a PK and
-- FKs needs the PK to include the partition key, which is a schema change
-- best done deliberately. Tracked in the build plan (Foundation phase).
