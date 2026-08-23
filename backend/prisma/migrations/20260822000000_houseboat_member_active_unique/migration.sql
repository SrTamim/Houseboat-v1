-- A person is a member of a boat at most once while active. Mirrors the
-- uq_cabin_hold_active partial-unique precedent. The predicate is status =
-- 'active' (NOT end_date IS NULL): an active row may carry an end_date for the
-- read-only "exited period" semantics, and every membership-create path sets
-- status = 'active'. An exited row may coexist so a re-hire can reactivate it.
--
-- Safe on existing data: the dedupe-members cleanup collapses any pre-existing
-- duplicate active rows before this runs.
CREATE UNIQUE INDEX IF NOT EXISTS uq_member_active
  ON houseboat_member (account_id, houseboat_id)
  WHERE status = 'active';
