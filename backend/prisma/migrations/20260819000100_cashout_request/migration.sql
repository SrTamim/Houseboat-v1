-- Customer wallet cash-out requests.
--
-- A customer asks to withdraw their open wallet balance to bKash/Nagad/bank. At
-- request time the account's `open` customer_credit rows are flipped to
-- `pending_cashout` (see the app layer) so the money is locked from booking use
-- while finance reviews. Finance approves (credits → used) or rejects
-- (credits → open) from the platform console.
CREATE TABLE IF NOT EXISTS "cashout_request" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" TEXT NOT NULL,
    "account_ref" TEXT NOT NULL,
    "bank_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ,
    "resolved_by_account_id" UUID,

    CONSTRAINT "cashout_request_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cashout_request_account_id_idx" ON "cashout_request"("account_id");
CREATE INDEX IF NOT EXISTS "cashout_request_status_idx" ON "cashout_request"("status");

ALTER TABLE "cashout_request"
    ADD CONSTRAINT "cashout_request_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cashout_request"
    ADD CONSTRAINT "cashout_request_resolved_by_account_id_fkey"
    FOREIGN KEY ("resolved_by_account_id") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
