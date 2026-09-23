-- Deposit-gated booking (audit M-H2): a checkout is priced into a booking_intent
-- and the booking is only created once a valid deposit is confirmed. Additive —
-- no change to existing booking/invoice rows.

-- CreateTable
CREATE TABLE "booking_intent" (
    "id" UUID NOT NULL,
    "departure_id" UUID NOT NULL,
    "houseboat_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "booked_by" UUID NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'web',
    "payload" JSONB NOT NULL,
    "display_total" DECIMAL(12,2) NOT NULL,
    "min_deposit" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "booking_id" UUID,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_intent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_intent_departure_id_idx" ON "booking_intent"("departure_id");
CREATE INDEX "booking_intent_customer_id_idx" ON "booking_intent"("customer_id");
CREATE INDEX "booking_intent_status_idx" ON "booking_intent"("status");
