-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "account" (
    "id" UUID NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "password_hash" TEXT,
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_platform" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "houseboat_member" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "houseboat_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "shareholder_pct" DECIMAL(5,2),
    "start_date" DATE,
    "end_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "houseboat_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" UUID NOT NULL,
    "houseboat_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_template" BOOLEAN NOT NULL DEFAULT false,
    "permissions" JSONB,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "houseboat_id" UUID,
    "actor_account_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" UUID,
    "before" JSONB,
    "after" JSONB,
    "device_time" TIMESTAMPTZ,
    "server_time" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced_offline" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "houseboat" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "safety_features" TEXT,
    "food_menu" TEXT,
    "bank_account" JSONB,
    "profile_complete_pct" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "billing_config_id" UUID,
    "operating_dates" DATE[],
    "default_crew" UUID[],
    "child_policy" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "houseboat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "houseboat_deck" (
    "id" UUID NOT NULL,
    "houseboat_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "houseboat_deck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "houseboat_cabin" (
    "id" UUID NOT NULL,
    "deck_id" UUID NOT NULL,
    "cabin_category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "grid_row" INTEGER,
    "grid_col" INTEGER,

    CONSTRAINT "houseboat_cabin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "houseboat_cabin_category" (
    "id" UUID NOT NULL,
    "houseboat_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_ac" BOOLEAN NOT NULL DEFAULT false,
    "base_capacity" INTEGER NOT NULL,
    "extended_capacity" INTEGER,
    "facilities" TEXT,

    CONSTRAINT "houseboat_cabin_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "houseboat_route" (
    "id" UUID NOT NULL,
    "houseboat_id" UUID NOT NULL,
    "route_id" UUID NOT NULL,

    CONSTRAINT "houseboat_route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_package" (
    "id" UUID NOT NULL,
    "houseboat_id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "duration_label" TEXT,
    "departure_ghat" TEXT,
    "return_ghat" TEXT,
    "meals" TEXT,
    "included" TEXT,
    "excluded" TEXT,
    "cancellation_policy_id" UUID,

    CONSTRAINT "trip_package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_departure" (
    "id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "departure_time" TIME,
    "arrival_time" TIME,
    "pricing_profile_id" UUID,
    "available_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'scheduled',

    CONSTRAINT "trip_departure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_profile" (
    "id" UUID NOT NULL,
    "houseboat_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "dates" DATE[],

    CONSTRAINT "pricing_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rule" (
    "id" UUID NOT NULL,
    "pricing_profile_id" UUID NOT NULL,
    "cabin_category_id" UUID NOT NULL,
    "occupancy" INTEGER NOT NULL,
    "price_per_person" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "pricing_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_price_band" (
    "id" UUID NOT NULL,
    "houseboat_id" UUID NOT NULL,
    "min_people" INTEGER NOT NULL,
    "max_people" INTEGER NOT NULL,
    "total_price" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "group_price_band_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking" (
    "id" UUID NOT NULL,
    "departure_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "booked_by" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "headcount" INTEGER,
    "special_instructions" TEXT,
    "coupon_id" UUID,
    "reference_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "reschedule_of" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_cabin" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "cabin_id" UUID NOT NULL,
    "adults" INTEGER NOT NULL,
    "children" INTEGER NOT NULL DEFAULT 0,
    "occupancy" INTEGER NOT NULL,
    "room_price" DECIMAL(12,2) NOT NULL,
    "is_open_seat" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "booking_cabin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_guest" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,

    CONSTRAINT "booking_guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_reschedule_history" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "prev_departure_id" UUID NOT NULL,
    "changed_to_departure_id" UUID NOT NULL,
    "old_price" DECIMAL(12,2),
    "new_price" DECIMAL(12,2),
    "reason" TEXT,
    "changed_by" UUID NOT NULL,
    "changed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_reschedule_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cabin_hold" (
    "id" UUID NOT NULL,
    "cabin_id" UUID NOT NULL,
    "departure_id" UUID NOT NULL,
    "held_by" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'held',

    CONSTRAINT "cabin_hold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_waitlist" (
    "id" UUID NOT NULL,
    "departure_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "party_size" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_request" (
    "id" UUID NOT NULL,
    "houseboat_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "date" DATE,
    "group_size" INTEGER,
    "special_needs" TEXT,
    "quoted_price" DECIMAL(12,2),
    "status" TEXT NOT NULL DEFAULT 'requested',
    "expires_at" TIMESTAMPTZ,

    CONSTRAINT "quote_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "houseboat_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "room_total" DECIMAL(12,2) NOT NULL,
    "gateway_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "price_shown" DECIMAL(12,2) NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "display_total" DECIMAL(12,2) NOT NULL,
    "commission" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "due_to_boat" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount_overpaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "policy_snapshot" JSONB,
    "payout_batch_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'customer_due',

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_payment" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" TEXT NOT NULL,
    "gateway_token" TEXT,
    "received_by" UUID,
    "verified_by" UUID,
    "paid_at" TIMESTAMPTZ,

    CONSTRAINT "invoice_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_refund" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "bank_details" JSONB,
    "requested_by" UUID,
    "verified_by" UUID,
    "completed_by" UUID,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "claim_deadline" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "invoice_refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "houseboat_payout_batch" (
    "id" UUID NOT NULL,
    "houseboat_id" UUID NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "prepared_by" UUID,
    "approved_by" UUID,
    "status" TEXT NOT NULL DEFAULT 'prepared',
    "paid_at" TIMESTAMPTZ,

    CONSTRAINT "houseboat_payout_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cancellation_policy" (
    "id" UUID NOT NULL,
    "houseboat_id" UUID NOT NULL,
    "policy_template" TEXT NOT NULL,
    "deposit_pct" INTEGER,
    "shown_at_checkout" BOOLEAN NOT NULL DEFAULT true,
    "tiers" JSONB,

    CONSTRAINT "cancellation_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon" (
    "id" UUID NOT NULL,
    "houseboat_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "valid_from" DATE,
    "valid_to" DATE,

    CONSTRAINT "coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "houseboat_billing_config" (
    "id" UUID NOT NULL,
    "houseboat_id" UUID NOT NULL,
    "commission_pct" DECIMAL(5,2),
    "monthly_fee" DECIMAL(12,2),
    "gateway_fee_pct" DECIMAL(5,2),
    "platform_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "trial_ends" DATE,

    CONSTRAINT "houseboat_billing_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "houseboat_subscription_invoice" (
    "id" UUID NOT NULL,
    "houseboat_id" UUID NOT NULL,
    "billing_config_id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "monthly_fee" DECIMAL(12,2),
    "commission_total" DECIMAL(12,2),
    "amount_due" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "houseboat_subscription_invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_distribution" (
    "id" UUID NOT NULL,
    "houseboat_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "recorded_by" UUID,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owner_distribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_credit" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "source_invoice_id" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "used_in_invoice_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'open',

    CONSTRAINT "customer_credit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "houseboat_staff" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "houseboat_id" UUID NOT NULL,
    "role_id" UUID,
    "nid" TEXT,
    "emergency_contact" TEXT,
    "per_trip_rate" DECIMAL(12,2),
    "monthly_salary" DECIMAL(12,2),

    CONSTRAINT "houseboat_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_crew" (
    "id" UUID NOT NULL,
    "departure_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "trip_crew_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_leave" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "state" TEXT NOT NULL,
    "from_date" DATE,
    "to_date" DATE,
    "note" TEXT,

    CONSTRAINT "staff_leave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_payroll" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "trips_worked" INTEGER,
    "base_amount" DECIMAL(12,2) NOT NULL,
    "bonus" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paid_at" TIMESTAMPTZ,
    "paid_by" UUID,

    CONSTRAINT "staff_payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost" (
    "id" UUID NOT NULL,
    "houseboat_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "trip_id" UUID,
    "paid_by" UUID,
    "due_to_vendor" DECIMAL(12,2),

    CONSTRAINT "cost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_item" (
    "id" UUID NOT NULL,
    "houseboat_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "unit" TEXT,
    "reorder_threshold" DECIMAL(12,2),
    "current_qty" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "inventory_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movement" (
    "id" UUID NOT NULL,
    "inventory_item_id" UUID NOT NULL,
    "trip_id" UUID,
    "direction" TEXT NOT NULL,
    "qty" DECIMAL(12,2) NOT NULL,
    "expected_qty" DECIMAL(12,2),
    "discrepancy" DECIMAL(12,2),
    "logged_by" UUID,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "houseboat_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "owner_reply" TEXT,

    CONSTRAINT "review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_phone_key" ON "account"("phone");

-- CreateIndex
CREATE INDEX "houseboat_member_account_id_idx" ON "houseboat_member"("account_id");

-- CreateIndex
CREATE INDEX "houseboat_member_houseboat_id_idx" ON "houseboat_member"("houseboat_id");

-- CreateIndex
CREATE INDEX "role_houseboat_id_idx" ON "role"("houseboat_id");

-- CreateIndex
CREATE INDEX "audit_log_houseboat_id_idx" ON "audit_log"("houseboat_id");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "houseboat_slug_key" ON "houseboat"("slug");

-- CreateIndex
CREATE INDEX "houseboat_deck_houseboat_id_idx" ON "houseboat_deck"("houseboat_id");

-- CreateIndex
CREATE INDEX "houseboat_cabin_deck_id_idx" ON "houseboat_cabin"("deck_id");

-- CreateIndex
CREATE INDEX "houseboat_cabin_cabin_category_id_idx" ON "houseboat_cabin"("cabin_category_id");

-- CreateIndex
CREATE INDEX "houseboat_cabin_category_houseboat_id_idx" ON "houseboat_cabin_category"("houseboat_id");

-- CreateIndex
CREATE UNIQUE INDEX "houseboat_route_houseboat_id_route_id_key" ON "houseboat_route"("houseboat_id", "route_id");

-- CreateIndex
CREATE INDEX "trip_package_houseboat_id_idx" ON "trip_package"("houseboat_id");

-- CreateIndex
CREATE INDEX "trip_departure_package_id_idx" ON "trip_departure"("package_id");

-- CreateIndex
CREATE INDEX "trip_departure_start_date_idx" ON "trip_departure"("start_date");

-- CreateIndex
CREATE INDEX "trip_departure_status_idx" ON "trip_departure"("status");

-- CreateIndex
CREATE INDEX "pricing_profile_houseboat_id_idx" ON "pricing_profile"("houseboat_id");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_rule_pricing_profile_id_cabin_category_id_occupancy_key" ON "pricing_rule"("pricing_profile_id", "cabin_category_id", "occupancy");

-- CreateIndex
CREATE INDEX "group_price_band_houseboat_id_idx" ON "group_price_band"("houseboat_id");

-- CreateIndex
CREATE INDEX "booking_departure_id_idx" ON "booking"("departure_id");

-- CreateIndex
CREATE INDEX "booking_customer_id_idx" ON "booking"("customer_id");

-- CreateIndex
CREATE INDEX "booking_status_idx" ON "booking"("status");

-- CreateIndex
CREATE INDEX "booking_cabin_booking_id_idx" ON "booking_cabin"("booking_id");

-- CreateIndex
CREATE INDEX "booking_cabin_cabin_id_idx" ON "booking_cabin"("cabin_id");

-- CreateIndex
CREATE INDEX "booking_guest_booking_id_idx" ON "booking_guest"("booking_id");

-- CreateIndex
CREATE INDEX "booking_reschedule_history_booking_id_idx" ON "booking_reschedule_history"("booking_id");

-- CreateIndex
CREATE INDEX "cabin_hold_departure_id_idx" ON "cabin_hold"("departure_id");

-- CreateIndex
CREATE INDEX "cabin_hold_expires_at_idx" ON "cabin_hold"("expires_at");

-- CreateIndex
CREATE INDEX "booking_waitlist_departure_id_idx" ON "booking_waitlist"("departure_id");

-- CreateIndex
CREATE INDEX "quote_request_houseboat_id_idx" ON "quote_request"("houseboat_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_booking_id_key" ON "invoice"("booking_id");

-- CreateIndex
CREATE INDEX "invoice_houseboat_id_idx" ON "invoice"("houseboat_id");

-- CreateIndex
CREATE INDEX "invoice_customer_id_idx" ON "invoice"("customer_id");

-- CreateIndex
CREATE INDEX "invoice_status_idx" ON "invoice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_payment_gateway_token_key" ON "invoice_payment"("gateway_token");

-- CreateIndex
CREATE INDEX "invoice_payment_invoice_id_idx" ON "invoice_payment"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_refund_invoice_id_idx" ON "invoice_refund"("invoice_id");

-- CreateIndex
CREATE INDEX "houseboat_payout_batch_houseboat_id_idx" ON "houseboat_payout_batch"("houseboat_id");

-- CreateIndex
CREATE INDEX "cancellation_policy_houseboat_id_idx" ON "cancellation_policy"("houseboat_id");

-- CreateIndex
CREATE INDEX "coupon_houseboat_id_idx" ON "coupon"("houseboat_id");

-- CreateIndex
CREATE INDEX "coupon_code_idx" ON "coupon"("code");

-- CreateIndex
CREATE INDEX "houseboat_billing_config_houseboat_id_idx" ON "houseboat_billing_config"("houseboat_id");

-- CreateIndex
CREATE INDEX "houseboat_subscription_invoice_houseboat_id_idx" ON "houseboat_subscription_invoice"("houseboat_id");

-- CreateIndex
CREATE INDEX "owner_distribution_houseboat_id_idx" ON "owner_distribution"("houseboat_id");

-- CreateIndex
CREATE INDEX "customer_credit_account_id_idx" ON "customer_credit"("account_id");

-- CreateIndex
CREATE INDEX "houseboat_staff_houseboat_id_idx" ON "houseboat_staff"("houseboat_id");

-- CreateIndex
CREATE INDEX "houseboat_staff_account_id_idx" ON "houseboat_staff"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "trip_crew_departure_id_staff_id_key" ON "trip_crew"("departure_id", "staff_id");

-- CreateIndex
CREATE INDEX "staff_leave_staff_id_idx" ON "staff_leave"("staff_id");

-- CreateIndex
CREATE INDEX "staff_payroll_staff_id_idx" ON "staff_payroll"("staff_id");

-- CreateIndex
CREATE INDEX "cost_houseboat_id_idx" ON "cost"("houseboat_id");

-- CreateIndex
CREATE INDEX "cost_date_idx" ON "cost"("date");

-- CreateIndex
CREATE INDEX "inventory_item_houseboat_id_idx" ON "inventory_item"("houseboat_id");

-- CreateIndex
CREATE INDEX "stock_movement_inventory_item_id_idx" ON "stock_movement"("inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_booking_id_key" ON "review"("booking_id");

-- CreateIndex
CREATE INDEX "review_houseboat_id_idx" ON "review"("houseboat_id");

-- CreateIndex
CREATE INDEX "notification_account_id_idx" ON "notification"("account_id");

-- AddForeignKey
ALTER TABLE "houseboat_member" ADD CONSTRAINT "houseboat_member_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "houseboat_member" ADD CONSTRAINT "houseboat_member_houseboat_id_fkey" FOREIGN KEY ("houseboat_id") REFERENCES "houseboat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "houseboat_member" ADD CONSTRAINT "houseboat_member_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role" ADD CONSTRAINT "role_houseboat_id_fkey" FOREIGN KEY ("houseboat_id") REFERENCES "houseboat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_houseboat_id_fkey" FOREIGN KEY ("houseboat_id") REFERENCES "houseboat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_account_id_fkey" FOREIGN KEY ("actor_account_id") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "houseboat" ADD CONSTRAINT "houseboat_billing_config_id_fkey" FOREIGN KEY ("billing_config_id") REFERENCES "houseboat_billing_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "houseboat_deck" ADD CONSTRAINT "houseboat_deck_houseboat_id_fkey" FOREIGN KEY ("houseboat_id") REFERENCES "houseboat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "houseboat_cabin" ADD CONSTRAINT "houseboat_cabin_deck_id_fkey" FOREIGN KEY ("deck_id") REFERENCES "houseboat_deck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "houseboat_cabin" ADD CONSTRAINT "houseboat_cabin_cabin_category_id_fkey" FOREIGN KEY ("cabin_category_id") REFERENCES "houseboat_cabin_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "houseboat_cabin_category" ADD CONSTRAINT "houseboat_cabin_category_houseboat_id_fkey" FOREIGN KEY ("houseboat_id") REFERENCES "houseboat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "houseboat_route" ADD CONSTRAINT "houseboat_route_houseboat_id_fkey" FOREIGN KEY ("houseboat_id") REFERENCES "houseboat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "houseboat_route" ADD CONSTRAINT "houseboat_route_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_package" ADD CONSTRAINT "trip_package_houseboat_id_fkey" FOREIGN KEY ("houseboat_id") REFERENCES "houseboat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_package" ADD CONSTRAINT "trip_package_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_package" ADD CONSTRAINT "trip_package_cancellation_policy_id_fkey" FOREIGN KEY ("cancellation_policy_id") REFERENCES "cancellation_policy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_departure" ADD CONSTRAINT "trip_departure_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "trip_package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_departure" ADD CONSTRAINT "trip_departure_pricing_profile_id_fkey" FOREIGN KEY ("pricing_profile_id") REFERENCES "pricing_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_profile" ADD CONSTRAINT "pricing_profile_houseboat_id_fkey" FOREIGN KEY ("houseboat_id") REFERENCES "houseboat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rule" ADD CONSTRAINT "pricing_rule_pricing_profile_id_fkey" FOREIGN KEY ("pricing_profile_id") REFERENCES "pricing_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rule" ADD CONSTRAINT "pricing_rule_cabin_category_id_fkey" FOREIGN KEY ("cabin_category_id") REFERENCES "houseboat_cabin_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_price_band" ADD CONSTRAINT "group_price_band_houseboat_id_fkey" FOREIGN KEY ("houseboat_id") REFERENCES "houseboat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_departure_id_fkey" FOREIGN KEY ("departure_id") REFERENCES "trip_departure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_booked_by_fkey" FOREIGN KEY ("booked_by") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_reschedule_of_fkey" FOREIGN KEY ("reschedule_of") REFERENCES "booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_cabin" ADD CONSTRAINT "booking_cabin_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_cabin" ADD CONSTRAINT "booking_cabin_cabin_id_fkey" FOREIGN KEY ("cabin_id") REFERENCES "houseboat_cabin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_guest" ADD CONSTRAINT "booking_guest_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_reschedule_history" ADD CONSTRAINT "booking_reschedule_history_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_reschedule_history" ADD CONSTRAINT "booking_reschedule_history_prev_departure_id_fkey" FOREIGN KEY ("prev_departure_id") REFERENCES "trip_departure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_reschedule_history" ADD CONSTRAINT "booking_reschedule_history_changed_to_departure_id_fkey" FOREIGN KEY ("changed_to_departure_id") REFERENCES "trip_departure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_reschedule_history" ADD CONSTRAINT "booking_reschedule_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabin_hold" ADD CONSTRAINT "cabin_hold_cabin_id_fkey" FOREIGN KEY ("cabin_id") REFERENCES "houseboat_cabin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabin_hold" ADD CONSTRAINT "cabin_hold_departure_id_fkey" FOREIGN KEY ("departure_id") REFERENCES "trip_departure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabin_hold" ADD CONSTRAINT "cabin_hold_held_by_fkey" FOREIGN KEY ("held_by") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_waitlist" ADD CONSTRAINT "booking_waitlist_departure_id_fkey" FOREIGN KEY ("departure_id") REFERENCES "trip_departure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_waitlist" ADD CONSTRAINT "booking_waitlist_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_request" ADD CONSTRAINT "quote_request_houseboat_id_fkey" FOREIGN KEY ("houseboat_id") REFERENCES "houseboat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_request" ADD CONSTRAINT "quote_request_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_houseboat_id_fkey" FOREIGN KEY ("houseboat_id") REFERENCES "houseboat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_payout_batch_id_fkey" FOREIGN KEY ("payout_batch_id") REFERENCES "houseboat_payout_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_refund" ADD CONSTRAINT "invoice_refund_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_refund" ADD CONSTRAINT "invoice_refund_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_refund" ADD CONSTRAINT "invoice_refund_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_refund" ADD CONSTRAINT "invoice_refund_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "houseboat_payout_batch" ADD CONSTRAINT "houseboat_payout_batch_houseboat_id_fkey" FOREIGN KEY ("houseboat_id") REFERENCES "houseboat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "houseboat_payout_batch" ADD CONSTRAINT "houseboat_payout_batch_prepared_by_fkey" FOREIGN KEY ("prepared_by") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "houseboat_payout_batch" ADD CONSTRAINT "houseboat_payout_batch_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cancellation_policy" ADD CONSTRAINT "cancellation_policy_houseboat_id_fkey" FOREIGN KEY ("houseboat_id") REFERENCES "houseboat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon" ADD CONSTRAINT "coupon_houseboat_id_fkey" FOREIGN KEY ("houseboat_id") REFERENCES "houseboat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "houseboat_billing_config" ADD CONSTRAINT "houseboat_billing_config_houseboat_id_fkey" FOREIGN KEY ("houseboat_id") REFERENCES "houseboat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "houseboat_subscription_invoice" ADD CONSTRAINT "houseboat_subscription_invoice_houseboat_id_fkey" FOREIGN KEY ("houseboat_id") REFERENCES "houseboat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "houseboat_subscription_invoice" ADD CONSTRAINT "houseboat_subscription_invoice_billing_config_id_fkey" FOREIGN KEY ("billing_config_id") REFERENCES "houseboat_billing_config"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_distribution" ADD CONSTRAINT "owner_distribution_houseboat_id_fkey" FOREIGN KEY ("houseboat_id") REFERENCES "houseboat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_distribution" ADD CONSTRAINT "owner_distribution_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "houseboat_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_distribution" ADD CONSTRAINT "owner_distribution_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credit" ADD CONSTRAINT "customer_credit_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credit" ADD CONSTRAINT "customer_credit_source_invoice_id_fkey" FOREIGN KEY ("source_invoice_id") REFERENCES "invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credit" ADD CONSTRAINT "customer_credit_used_in_invoice_id_fkey" FOREIGN KEY ("used_in_invoice_id") REFERENCES "invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "houseboat_staff" ADD CONSTRAINT "houseboat_staff_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "houseboat_staff" ADD CONSTRAINT "houseboat_staff_houseboat_id_fkey" FOREIGN KEY ("houseboat_id") REFERENCES "houseboat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "houseboat_staff" ADD CONSTRAINT "houseboat_staff_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_crew" ADD CONSTRAINT "trip_crew_departure_id_fkey" FOREIGN KEY ("departure_id") REFERENCES "trip_departure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_crew" ADD CONSTRAINT "trip_crew_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "houseboat_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_leave" ADD CONSTRAINT "staff_leave_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "houseboat_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_payroll" ADD CONSTRAINT "staff_payroll_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "houseboat_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_payroll" ADD CONSTRAINT "staff_payroll_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost" ADD CONSTRAINT "cost_houseboat_id_fkey" FOREIGN KEY ("houseboat_id") REFERENCES "houseboat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost" ADD CONSTRAINT "cost_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trip_departure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost" ADD CONSTRAINT "cost_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_houseboat_id_fkey" FOREIGN KEY ("houseboat_id") REFERENCES "houseboat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trip_departure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_logged_by_fkey" FOREIGN KEY ("logged_by") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_houseboat_id_fkey" FOREIGN KEY ("houseboat_id") REFERENCES "houseboat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
