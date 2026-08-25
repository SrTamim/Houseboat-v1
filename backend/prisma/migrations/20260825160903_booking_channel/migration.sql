-- AlterTable
ALTER TABLE "booking" ADD COLUMN     "channel" TEXT NOT NULL DEFAULT 'web';

-- Backfill frozen history: rows booked by someone other than the customer are
-- owner counter sales (POS). One-time heuristic on existing rows only; new rows
-- set channel explicitly at creation.
UPDATE "booking" SET "channel" = 'pos' WHERE "booked_by" <> "customer_id";

-- CreateIndex
CREATE INDEX "booking_channel_idx" ON "booking"("channel");
