-- Owner console: maintenance module + member notification prefs + engine hours.
-- NOTE: generated via `prisma migrate diff` against the live dev DB, with the
-- spurious DROP INDEX statements for the raw-SQL GIN indexes
-- (idx_houseboat_operating_dates_gin, idx_pricing_profile_dates_gin) removed —
-- those live in the *_constraints migration and must never be dropped.

-- AlterTable
ALTER TABLE "houseboat" ADD COLUMN     "engine_hours" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "engine_hours_updated_at" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "houseboat_member" ADD COLUMN     "notification_prefs" JSONB;

-- CreateTable
CREATE TABLE "maintenance_task" (
    "id" UUID NOT NULL,
    "houseboat_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "interval_kind" TEXT NOT NULL,
    "interval_value" INTEGER,
    "due_at_hours" INTEGER,
    "due_date" DATE,
    "last_done_at" TIMESTAMPTZ,
    "last_done_hours" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_service_log" (
    "id" UUID NOT NULL,
    "houseboat_id" UUID NOT NULL,
    "task_id" UUID,
    "service_date" DATE NOT NULL,
    "engine_hours" INTEGER,
    "cost" DECIMAL(12,2),
    "note" TEXT,
    "logged_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_service_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "damage_log" (
    "id" UUID NOT NULL,
    "houseboat_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "repair_cost" DECIMAL(12,2),
    "reported_by" UUID,
    "reported_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fixed_at" TIMESTAMPTZ,

    CONSTRAINT "damage_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "maintenance_task_houseboat_id_idx" ON "maintenance_task"("houseboat_id");

-- CreateIndex
CREATE INDEX "maintenance_service_log_houseboat_id_idx" ON "maintenance_service_log"("houseboat_id");

-- CreateIndex
CREATE INDEX "damage_log_houseboat_id_idx" ON "damage_log"("houseboat_id");

-- AddForeignKey
ALTER TABLE "maintenance_task" ADD CONSTRAINT "maintenance_task_houseboat_id_fkey" FOREIGN KEY ("houseboat_id") REFERENCES "houseboat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_service_log" ADD CONSTRAINT "maintenance_service_log_houseboat_id_fkey" FOREIGN KEY ("houseboat_id") REFERENCES "houseboat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_service_log" ADD CONSTRAINT "maintenance_service_log_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "maintenance_task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damage_log" ADD CONSTRAINT "damage_log_houseboat_id_fkey" FOREIGN KEY ("houseboat_id") REFERENCES "houseboat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
