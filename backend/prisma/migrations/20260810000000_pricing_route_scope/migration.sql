-- Per-route pricing. A boat runs many routes; each route has its own price tables.
-- Additive & non-breaking: new columns are nullable so existing free-form profiles
-- (used by the schedule page) keep working. Route pricing sets both columns.

ALTER TABLE "pricing_profile" ADD COLUMN "route_id" UUID;
ALTER TABLE "pricing_profile" ADD COLUMN "price_type" TEXT;

ALTER TABLE "pricing_profile"
  ADD CONSTRAINT "pricing_profile_route_id_fkey"
  FOREIGN KEY ("route_id") REFERENCES "route"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "pricing_profile_route_id_idx"
  ON "pricing_profile"("route_id");

-- Exactly one profile per (boat, route, price_type) — but only for route-scoped
-- rows. Partial index leaves legacy/free-form profiles (route_id null) unconstrained.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_pricing_profile_route_type_uniq"
  ON "pricing_profile" ("houseboat_id", "route_id", "price_type")
  WHERE "route_id" IS NOT NULL;
