-- DropForeignKey
ALTER TABLE "booking_waitlist" DROP CONSTRAINT "booking_waitlist_cabin_id_fkey";

-- DropForeignKey
ALTER TABLE "cabin_hold" DROP CONSTRAINT "cabin_hold_held_by_fkey";

-- AlterTable
ALTER TABLE "review" ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "app_setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "app_setting_pkey" PRIMARY KEY ("key")
);

-- AddForeignKey
ALTER TABLE "cabin_hold" ADD CONSTRAINT "cabin_hold_held_by_fkey" FOREIGN KEY ("held_by") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_waitlist" ADD CONSTRAINT "booking_waitlist_cabin_id_fkey" FOREIGN KEY ("cabin_id") REFERENCES "houseboat_cabin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
