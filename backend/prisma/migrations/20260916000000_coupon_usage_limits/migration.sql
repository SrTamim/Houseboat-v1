-- Coupon usage limits (audit M-H1): cap redemptions so a leaked code is not an
-- unbounded discount liability. All columns nullable → existing coupons keep
-- their current "unlimited" behavior; no row rewrite.

-- AlterTable
ALTER TABLE "coupon" ADD COLUMN     "max_uses" INTEGER;
ALTER TABLE "coupon" ADD COLUMN     "per_user_limit" INTEGER;
ALTER TABLE "coupon" ADD COLUMN     "min_spend" DECIMAL(12,2);

-- Enforce one code per boat (M2). A service-level check existed but was not
-- atomic. If this fails, deduplicate existing (houseboat_id, code) rows first.
-- CreateIndex
CREATE UNIQUE INDEX "coupon_houseboat_id_code_key" ON "coupon"("houseboat_id", "code");
