-- CustomerCredit.kind (audit M-M1): distinguish a cancellation REFUND (must
-- reduce the boat payout even once spent) from an open-seat REBATE (never
-- subtracted — it already cut the invoice's displayTotal). Nullable; existing
-- rows stay null and keep their prior settlement behavior.

-- AlterTable
ALTER TABLE "customer_credit" ADD COLUMN "kind" TEXT;
