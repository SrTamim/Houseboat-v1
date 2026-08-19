-- Customer national ID, encrypted at rest.
--
-- Same scheme as booking_guest.nid_encrypted (AES via common/crypto.ts). Stored
-- on the account so a returning customer doesn't re-enter it every booking. The
-- API never echoes the ciphertext — GET /auth/me returns a `nidSet` boolean.
--
-- Nullable, no backfill: existing accounts keep working with no NID on file.
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "nid_encrypted" TEXT;
