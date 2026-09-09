-- AlterTable
ALTER TABLE "notification" ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "notification" ADD COLUMN "next_attempt_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "notification_delivered_next_attempt_at_idx" ON "notification"("delivered", "next_attempt_at");
