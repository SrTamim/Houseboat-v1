-- Request context on the audit trail.
--
-- audit_log previously recorded WHO (actor_account_id) and WHAT, but not
-- WHERE FROM. Without an address and user agent an audit row can't support
-- an incident investigation: you cannot tell a normal action from the same
-- account being driven by someone else.
--
-- audit_log is PARTITIONED BY RANGE (server_time) and carries an append-only
-- trigger (trg_audit_no_update). ADD COLUMN on the partitioned parent cascades
-- to every existing and future partition, and does not rewrite the table since
-- both columns are nullable with no default. The trigger is untouched.

ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS ip inet;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS user_agent text;
