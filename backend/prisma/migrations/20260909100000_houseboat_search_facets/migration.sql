-- AlterTable: denormalized search facets on houseboat
ALTER TABLE "houseboat" ADD COLUMN "min_price_per_person" DECIMAL(12,2);
ALTER TABLE "houseboat" ADD COLUMN "max_capacity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "houseboat" ADD COLUMN "has_ac" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "houseboat" ADD COLUMN "has_non_ac" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "houseboat" ADD COLUMN "rating_avg" DOUBLE PRECISION;
ALTER TABLE "houseboat" ADD COLUMN "review_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "houseboat" ADD COLUMN "amenities_text" TEXT;

-- CreateIndex
CREATE INDEX "houseboat_status_idx" ON "houseboat"("status");
CREATE INDEX "houseboat_status_created_at_idx" ON "houseboat"("status", "created_at" DESC);
CREATE INDEX "houseboat_status_min_price_per_person_idx" ON "houseboat"("status", "min_price_per_person");
CREATE INDEX "houseboat_status_rating_avg_idx" ON "houseboat"("status", "rating_avg");
CREATE INDEX "houseboat_status_review_count_idx" ON "houseboat"("status", "review_count");

-- Backfill: derive the facets for every existing boat with the SAME rollups the
-- application service uses, so rows are correct immediately (defaults above are
-- only placeholders until this runs).

-- min price = MIN(price_per_person > 0) across the DEFAULT profile's rules
UPDATE "houseboat" h SET "min_price_per_person" = sub.min_price
FROM (
  SELECT pp."houseboat_id" AS hid, MIN(pr."price_per_person") AS min_price
  FROM "pricing_profile" pp
  JOIN "pricing_rule" pr ON pr."pricing_profile_id" = pp."id"
  WHERE pp."is_default" = true AND pr."price_per_person" > 0
  GROUP BY pp."houseboat_id"
) sub
WHERE h."id" = sub.hid;

-- capacity + AC flags + amenity text from cabin categories
UPDATE "houseboat" h SET
  "max_capacity"  = COALESCE(sub.max_cap, 0),
  "has_ac"        = COALESCE(sub.has_ac, false),
  "has_non_ac"    = COALESCE(sub.has_non_ac, false),
  "amenities_text" = sub.amenities
FROM (
  SELECT c."houseboat_id" AS hid,
         MAX(COALESCE(c."extended_capacity", c."base_capacity")) AS max_cap,
         bool_or(c."is_ac") AS has_ac,
         bool_or(NOT c."is_ac") AS has_non_ac,
         NULLIF(lower(string_agg(COALESCE(NULLIF(trim(c."facilities"), ''), ''), ' ')), '') AS amenities
  FROM "houseboat_cabin_category" c
  GROUP BY c."houseboat_id"
) sub
WHERE h."id" = sub.hid;

-- rating average + count from non-hidden reviews
UPDATE "houseboat" h SET
  "rating_avg"   = sub.avg_rating,
  "review_count" = sub.cnt
FROM (
  SELECT r."houseboat_id" AS hid, AVG(r."rating")::double precision AS avg_rating, COUNT(*)::int AS cnt
  FROM "review" r
  WHERE r."hidden" = false
  GROUP BY r."houseboat_id"
) sub
WHERE h."id" = sub.hid;
