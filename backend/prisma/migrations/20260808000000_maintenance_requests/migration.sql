-- DropForeignKey
ALTER TABLE "damage_log" DROP CONSTRAINT "damage_log_houseboat_id_fkey";

-- DropForeignKey
ALTER TABLE "maintenance_service_log" DROP CONSTRAINT "maintenance_service_log_houseboat_id_fkey";

-- DropForeignKey
ALTER TABLE "maintenance_service_log" DROP CONSTRAINT "maintenance_service_log_task_id_fkey";

-- DropForeignKey
ALTER TABLE "maintenance_task" DROP CONSTRAINT "maintenance_task_houseboat_id_fkey";

-- AlterTable
ALTER TABLE "houseboat" DROP COLUMN "engine_hours",
DROP COLUMN "engine_hours_updated_at";

-- DropTable
DROP TABLE "damage_log";

-- DropTable
DROP TABLE "maintenance_service_log";

-- DropTable
DROP TABLE "maintenance_task";

-- CreateTable
CREATE TABLE "maintenance_request" (
    "id" UUID NOT NULL,
    "houseboat_id" UUID NOT NULL,
    "topic" TEXT NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMPTZ NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ,

    CONSTRAINT "maintenance_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_request_comment" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "status_change" TEXT,
    "author_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_request_comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "maintenance_request_houseboat_id_idx" ON "maintenance_request"("houseboat_id");

-- CreateIndex
CREATE INDEX "maintenance_request_comment_request_id_idx" ON "maintenance_request_comment"("request_id");

-- AddForeignKey
ALTER TABLE "maintenance_request" ADD CONSTRAINT "maintenance_request_houseboat_id_fkey" FOREIGN KEY ("houseboat_id") REFERENCES "houseboat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_request_comment" ADD CONSTRAINT "maintenance_request_comment_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "maintenance_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
