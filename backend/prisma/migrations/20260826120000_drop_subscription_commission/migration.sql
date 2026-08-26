-- Subscription bills are the monthly fee only. Booking commission is already
-- withheld from booking money, so it must not be re-billed here.

-- 1) Correct historical rows: strip the commission that was folded into amount_due.
--    Trial rows stay at their $0 amount_due.
UPDATE "houseboat_subscription_invoice"
SET "amount_due" = COALESCE("monthly_fee", 0)
WHERE "status" <> 'trial';

-- 2) Drop the now-unused column.
ALTER TABLE "houseboat_subscription_invoice" DROP COLUMN "commission_total";
