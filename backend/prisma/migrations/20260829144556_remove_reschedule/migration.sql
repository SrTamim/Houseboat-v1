/*
  Warnings:

  - You are about to drop the column `reschedule_of` on the `booking` table. All the data in the column will be lost.
  - You are about to drop the `booking_reschedule_history` table. If the table is not empty, all the data it contains will be lost.

*/
-- Data: retire any legacy 'rescheduled' booking status. Nothing writes it any
-- more (the reschedule feature is removed); collapse existing rows to 'confirmed'
-- so status filters/counts and the cancellable check stay correct. No-op if none.
UPDATE "booking" SET "status" = 'confirmed' WHERE "status" = 'rescheduled';

-- DropForeignKey
ALTER TABLE "booking" DROP CONSTRAINT "booking_reschedule_of_fkey";

-- DropForeignKey
ALTER TABLE "booking_reschedule_history" DROP CONSTRAINT "booking_reschedule_history_booking_id_fkey";

-- DropForeignKey
ALTER TABLE "booking_reschedule_history" DROP CONSTRAINT "booking_reschedule_history_changed_by_fkey";

-- DropForeignKey
ALTER TABLE "booking_reschedule_history" DROP CONSTRAINT "booking_reschedule_history_changed_to_departure_id_fkey";

-- DropForeignKey
ALTER TABLE "booking_reschedule_history" DROP CONSTRAINT "booking_reschedule_history_prev_departure_id_fkey";

-- AlterTable
ALTER TABLE "booking" DROP COLUMN "reschedule_of";

-- DropTable
DROP TABLE "booking_reschedule_history";
