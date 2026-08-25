-- Separation of duties removed: one finance member now runs the whole payout
-- flow (verify-in -> approve -> pay). Drop the preparer<>approver CHECK.
ALTER TABLE houseboat_payout_batch
  DROP CONSTRAINT IF EXISTS chk_payout_prepared_ne_approved;
