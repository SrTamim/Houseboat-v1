-- Owner console rework: check-in status, structured food menu, weekly schedule engine.
-- NOTE: GIN indexes idx_houseboat_operating_dates_gin / idx_pricing_profile_dates_gin
-- are created by a raw-SQL migration and are intentionally preserved here.

-- AlterTable: departure attendance status on bookings (§5)
ALTER TABLE "booking" ADD COLUMN "checkin_status" TEXT NOT NULL DEFAULT 'pending';

-- AlterTable: food menu becomes structured JSON { breakfast, brunch, lunch, snacks, dinner } (§9)
ALTER TABLE "houseboat" DROP COLUMN "food_menu",
ADD COLUMN "food_menu" JSONB;

-- AlterTable: link a departure back to the schedule slot that generated it (§1)
ALTER TABLE "trip_departure" ADD COLUMN "schedule_slot_id" UUID;

-- CreateTable: weekly recurring schedule (§1)
CREATE TABLE "boat_schedule" (
    "id" UUID NOT NULL,
    "houseboat_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boat_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable: one weekly trip slot (Trip 1/2/3) with its own weekdays (§1)
CREATE TABLE "trip_schedule_slot" (
    "id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "slot_no" INTEGER NOT NULL,
    "weekdays" INTEGER[],
    "departure_time" TIME,
    "pricing_profile_id" UUID,

    CONSTRAINT "trip_schedule_slot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "boat_schedule_houseboat_id_idx" ON "boat_schedule"("houseboat_id");

-- CreateIndex
CREATE INDEX "trip_schedule_slot_schedule_id_idx" ON "trip_schedule_slot"("schedule_id");

-- CreateIndex
CREATE UNIQUE INDEX "trip_schedule_slot_schedule_id_slot_no_key" ON "trip_schedule_slot"("schedule_id", "slot_no");

-- CreateIndex
CREATE INDEX "trip_departure_schedule_slot_id_idx" ON "trip_departure"("schedule_slot_id");

-- AddForeignKey
ALTER TABLE "boat_schedule" ADD CONSTRAINT "boat_schedule_houseboat_id_fkey" FOREIGN KEY ("houseboat_id") REFERENCES "houseboat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boat_schedule" ADD CONSTRAINT "boat_schedule_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "trip_package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_schedule_slot" ADD CONSTRAINT "trip_schedule_slot_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "boat_schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_departure" ADD CONSTRAINT "trip_departure_schedule_slot_id_fkey" FOREIGN KEY ("schedule_slot_id") REFERENCES "trip_schedule_slot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
