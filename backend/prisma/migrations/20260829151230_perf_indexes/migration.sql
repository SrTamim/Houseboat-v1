-- CreateIndex
CREATE INDEX "audit_log_houseboat_id_server_time_idx" ON "audit_log"("houseboat_id", "server_time" DESC);

-- CreateIndex
CREATE INDEX "cabin_hold_state_expires_at_idx" ON "cabin_hold"("state", "expires_at");

-- CreateIndex
CREATE INDEX "cabin_hold_state_last_seen_at_idx" ON "cabin_hold"("state", "last_seen_at");

-- CreateIndex
CREATE INDEX "invoice_status_payout_batch_id_idx" ON "invoice"("status", "payout_batch_id");

-- CreateIndex
CREATE INDEX "notification_account_id_at_idx" ON "notification"("account_id", "at" DESC);

-- CreateIndex
CREATE INDEX "trip_departure_package_id_start_date_idx" ON "trip_departure"("package_id", "start_date");

-- CreateIndex
CREATE INDEX "trip_departure_package_id_status_idx" ON "trip_departure"("package_id", "status");
