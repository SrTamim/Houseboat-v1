-- Generalize video media from YouTube-only to an allowlist of providers.
-- Existing rows are all YouTube (the only prior option), so rename the column
-- to preserve their canonical URLs and backfill the provider.

ALTER TABLE "houseboat_media" RENAME COLUMN "youtube_url" TO "video_url";
ALTER TABLE "houseboat_media" ADD COLUMN "video_provider" TEXT;

UPDATE "houseboat_media"
SET "video_provider" = 'youtube'
WHERE "kind" = 'video' AND "video_url" IS NOT NULL;
