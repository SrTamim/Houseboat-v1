-- AlterTable
ALTER TABLE "invoice_refund" ADD COLUMN     "origin" TEXT NOT NULL DEFAULT 'owner';

-- AlterTable
ALTER TABLE "trip_departure" ADD COLUMN     "cancelled_at" TIMESTAMPTZ;

-- Relax separation-of-duties for CUSTOMER-origin refunds. The original CHECK
-- (00000000000001_constraints) forbade verified_by == completed_by so one staffer
-- couldn't verify then complete. Customer-raised web refunds are requested by the
-- customer (not staff), so one admin may do both steps. Owner-origin refunds keep
-- strict separation. Mirrors 20260826024704_drop_payout_separation_of_duties.
ALTER TABLE "invoice_refund"
  DROP CONSTRAINT IF EXISTS chk_refund_verified_ne_completed;
ALTER TABLE "invoice_refund"
  ADD CONSTRAINT chk_refund_verified_ne_completed
  CHECK (
    origin <> 'owner'
    OR completed_by IS NULL
    OR verified_by IS NULL
    OR completed_by <> verified_by
  );

-- One ACTIVE refund per invoice (a completed one may be superseded). Backs the
-- app-level idempotency check in RefundsService against a double-submit race.
CREATE UNIQUE INDEX uq_invoice_refund_active
  ON "invoice_refund" ("invoice_id")
  WHERE status <> 'completed';
