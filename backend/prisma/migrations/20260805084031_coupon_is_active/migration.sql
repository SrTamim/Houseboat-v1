-- DropIndex
DROP INDEX "idx_houseboat_operating_dates_gin";

-- DropIndex
DROP INDEX "idx_pricing_profile_dates_gin";

-- AlterTable
ALTER TABLE "coupon" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;
