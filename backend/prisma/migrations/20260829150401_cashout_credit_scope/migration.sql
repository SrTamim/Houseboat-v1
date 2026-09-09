-- AlterTable
ALTER TABLE "customer_credit" ADD COLUMN     "cashout_request_id" UUID;

-- CreateIndex
CREATE INDEX "customer_credit_cashout_request_id_idx" ON "customer_credit"("cashout_request_id");

-- AddForeignKey
ALTER TABLE "customer_credit" ADD CONSTRAINT "customer_credit_cashout_request_id_fkey" FOREIGN KEY ("cashout_request_id") REFERENCES "cashout_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;
