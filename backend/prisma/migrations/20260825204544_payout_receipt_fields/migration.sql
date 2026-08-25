-- AlterTable
ALTER TABLE "houseboat_payout_batch" ADD COLUMN     "bank_snapshot" JSONB,
ADD COLUMN     "paid_by" UUID;

-- AddForeignKey
ALTER TABLE "houseboat_payout_batch" ADD CONSTRAINT "houseboat_payout_batch_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
