-- Granular permissions for platform staff. A platform account with a NULL
-- platform_role_id remains an unrestricted superadmin, so this migration is
-- a no-op for every existing account.
CREATE TABLE "platform_role" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_role_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_role_name_key" ON "platform_role"("name");

ALTER TABLE "account" ADD COLUMN "platform_role_id" UUID;

-- RESTRICT, not SET NULL: deleting a role must not silently promote its
-- assigned staff to unrestricted superadmin.
ALTER TABLE "account" ADD CONSTRAINT "account_platform_role_id_fkey"
  FOREIGN KEY ("platform_role_id") REFERENCES "platform_role"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "account_platform_role_id_idx" ON "account"("platform_role_id");
