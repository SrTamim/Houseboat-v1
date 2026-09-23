-- Idempotency ledger for offline-sync replay (audit #7 / F19).
--
-- audit_log is RANGE-partitioned on server_time (PK id, server_time), so it
-- cannot carry a unique index on intent_id alone — the marker there can't enforce
-- once-only. This dedicated, non-partitioned table can: the replay engine claims
-- an intentId here (INSERT) BEFORE applying the action, and the PK makes a
-- duplicate/concurrent replay fail atomically instead of double-applying money.
CREATE TABLE IF NOT EXISTS "sync_intent_applied" (
  "intent_id"    TEXT        NOT NULL,
  "account_id"   UUID        NOT NULL,
  "houseboat_id" UUID        NOT NULL,
  "action"       TEXT        NOT NULL,
  "applied_at"   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sync_intent_applied_pkey" PRIMARY KEY ("intent_id")
);
