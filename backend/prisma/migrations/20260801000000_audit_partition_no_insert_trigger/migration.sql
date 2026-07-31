-- ─────────────────────────────────────────────────────────────────────────────
-- Remove the BEFORE-INSERT partition-creation trigger on audit_log.
--
-- Migration 00000000000003 added trg_audit_route_insert, which called
-- audit_log_ensure_partition() — i.e. `CREATE TABLE ... PARTITION OF audit_log`
-- — from a BEFORE INSERT trigger on audit_log itself. The very first insert of
-- any new month has to create that month's partition, but the partition cannot
-- be created while the parent is locked by the in-flight INSERT. Postgres
-- rejects it with SQLSTATE 55006:
--
--   cannot CREATE TABLE .. PARTITION OF "audit_log" because it is being used
--   by active queries in this session
--
-- Successful logins call AuditService.log() (which throws, unlike tryLog), so
-- on the 1st of every month the first audited write turned into a 500 — most
-- visibly, owner/admin login broke.
--
-- The DEFAULT partition (audit_log_default) already catches any month without
-- a dedicated partition, so rows never actually fail without the trigger. We
-- drop the insert-time creation entirely and instead pre-create month
-- partitions ahead of time — here in the migration, and on every app boot via
-- AuditService.onModuleInit (both call audit_log_ensure_partition OUTSIDE any
-- insert, so 55006 can't occur).
--
-- audit_log_ensure_partition() is kept and reused by the app.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Drop the unsafe insert-time trigger and its function.
DROP TRIGGER IF EXISTS trg_audit_route_insert ON audit_log;
DROP FUNCTION IF EXISTS audit_log_route_insert();

-- 2. Pre-create the current and next month partitions so writes route correctly
--    right after this migration, before the app's boot hook has run.
SELECT audit_log_ensure_partition(date_trunc('month', now())::timestamptz);
SELECT audit_log_ensure_partition(
  (date_trunc('month', now()) + interval '1 month')::timestamptz
);
