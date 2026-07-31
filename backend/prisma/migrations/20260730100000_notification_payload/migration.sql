-- Replay payload for console resend. Nullable with no default: no table
-- rewrite, and legacy rows stay NULL — they simply cannot be resent.
ALTER TABLE "notification" ADD COLUMN "payload" JSONB;
