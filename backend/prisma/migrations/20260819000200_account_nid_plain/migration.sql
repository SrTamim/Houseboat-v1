-- NID is not secret: the customer, boat owner and admin all need to read it
-- (ghat verification). Drop the encrypted column added in the previous migration
-- and store it as plaintext instead. Safe to rename with no data preservation —
-- the encrypted column was just added and holds nothing meaningful for anyone.
ALTER TABLE "account" RENAME COLUMN "nid_encrypted" TO "nid";
