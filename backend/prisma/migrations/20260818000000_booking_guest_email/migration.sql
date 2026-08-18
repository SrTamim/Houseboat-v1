-- Lead-guest contact email, captured at checkout.
--
-- Plaintext, unlike nid_encrypted: this is a contact address used to send the
-- voucher and trip updates, not an identity document. Per-booking rather than
-- read off the account because the person paying is often not the person
-- travelling — the same reason booking_guest carries its own name and phone.
--
-- Nullable with no backfill: every existing booking keeps working, and the
-- gateway/e-ticket paths already fall back to the account's email.
ALTER TABLE "booking_guest" ADD COLUMN IF NOT EXISTS "email" TEXT;
