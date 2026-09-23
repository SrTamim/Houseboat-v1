-- Bill-off-shown-price (audit #10 / F12).
--
-- confirmIntent re-prices fresh at payment time (never trusts a stale snapshot
-- for availability), but that meant an owner pricing change between checkout and
-- payment could bill the customer a different total than they agreed to. Store
-- the full bill breakdown at createIntent so confirmIntent can bill exactly the
-- price shown. Nullable — intents created before this migration re-price as
-- before (no breaking change to in-flight checkouts).
ALTER TABLE "booking_intent" ADD COLUMN IF NOT EXISTS "bill_snapshot" JSONB;
