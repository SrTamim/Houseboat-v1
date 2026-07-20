-- Boat + cabin galleries. Images live in Cloudflare R2 (storage_key); videos are
-- YouTube URLs (youtube_url). One row per media item, ordered by sort_order.
CREATE TABLE "houseboat_media" (
    "id" UUID NOT NULL,
    "houseboat_id" UUID NOT NULL,
    "cabin_id" UUID,
    "kind" TEXT NOT NULL,
    "storage_key" TEXT,
    "youtube_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "uploaded_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "houseboat_media_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "houseboat_media_houseboat_id_idx" ON "houseboat_media"("houseboat_id");
CREATE INDEX "houseboat_media_cabin_id_idx" ON "houseboat_media"("cabin_id");

ALTER TABLE "houseboat_media"
    ADD CONSTRAINT "houseboat_media_houseboat_id_fkey"
    FOREIGN KEY ("houseboat_id") REFERENCES "houseboat"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "houseboat_media"
    ADD CONSTRAINT "houseboat_media_cabin_id_fkey"
    FOREIGN KEY ("cabin_id") REFERENCES "houseboat_cabin"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Each media row is exactly one kind: image → storage_key set, youtube_url null;
-- video → youtube_url set, storage_key null.
ALTER TABLE "houseboat_media"
    ADD CONSTRAINT "houseboat_media_kind_shape" CHECK (
        (kind = 'image' AND storage_key IS NOT NULL AND youtube_url IS NULL)
        OR (kind = 'video' AND youtube_url IS NOT NULL AND storage_key IS NULL)
    );
