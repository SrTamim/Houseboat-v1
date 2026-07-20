-- ─────────────────────────────────────────────────────────────────────────────
-- audit_log monthly partitioning (plan §schema — "Partition by month").
--
-- audit_log grows forever and is also the offline-sync replay store. We convert
-- it to a RANGE-partitioned table on server_time, one partition per month, with
-- a DEFAULT catch-all and a trigger that auto-creates the month partition on
-- insert so writes never fail for a not-yet-created month.
--
-- Partitioning requires the partition key (server_time) to be part of the
-- primary key, so the PK becomes (id, server_time). The append-only trigger and
-- both foreign keys are re-created on the new parent (they propagate to
-- partitions in PG11+).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Drop the append-only trigger so we can move data during this migration.
DROP TRIGGER IF EXISTS trg_audit_no_update ON audit_log;

-- 2. Set the existing table aside. Rename its PK + indexes too, so the new
--    table can claim the original names without collision.
ALTER TABLE audit_log RENAME TO audit_log_old;
ALTER TABLE audit_log_old RENAME CONSTRAINT audit_log_pkey TO audit_log_old_pkey;
ALTER INDEX IF EXISTS audit_log_houseboat_id_idx RENAME TO audit_log_old_houseboat_id_idx;
ALTER INDEX IF EXISTS audit_log_entity_type_entity_id_idx RENAME TO audit_log_old_entity_idx;

-- 3. New partitioned parent. PK includes the partition key.
CREATE TABLE audit_log (
    id               UUID        NOT NULL,
    houseboat_id     UUID,
    actor_account_id UUID,
    action           TEXT        NOT NULL,
    entity_type      TEXT,
    entity_id        UUID,
    before           JSONB,
    after            JSONB,
    device_time      TIMESTAMPTZ,
    server_time      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    synced_offline   BOOLEAN     NOT NULL DEFAULT false,
    CONSTRAINT audit_log_pkey PRIMARY KEY (id, server_time)
) PARTITION BY RANGE (server_time);

-- 4. DEFAULT partition catches any row whose month partition doesn't exist yet.
CREATE TABLE audit_log_default PARTITION OF audit_log DEFAULT;

-- 5. Helper: ensure the monthly partition for a given timestamp exists.
--    Idempotent — safe to call on every insert.
CREATE OR REPLACE FUNCTION audit_log_ensure_partition(ts TIMESTAMPTZ)
RETURNS void AS $$
DECLARE
  start_ts DATE := date_trunc('month', ts)::date;
  end_ts   DATE := (date_trunc('month', ts) + INTERVAL '1 month')::date;
  part     TEXT := 'audit_log_' || to_char(start_ts, 'YYYY_MM');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = part) THEN
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF audit_log FOR VALUES FROM (%L) TO (%L)',
      part, start_ts, end_ts
    );
  END IF;
EXCEPTION WHEN duplicate_table THEN
  -- Another concurrent insert created it first — fine.
  NULL;
END;
$$ LANGUAGE plpgsql;

-- 6. BEFORE INSERT trigger: make sure this row's month partition exists so the
--    row lands in its month rather than the DEFAULT partition.
CREATE OR REPLACE FUNCTION audit_log_route_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM audit_log_ensure_partition(COALESCE(NEW.server_time, now()));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_route_insert
  BEFORE INSERT ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_route_insert();

-- 7. Pre-create partitions for existing data's months, then copy rows over.
DO $$
DECLARE
  m TIMESTAMPTZ;
BEGIN
  FOR m IN
    SELECT DISTINCT date_trunc('month', server_time) FROM audit_log_old
  LOOP
    PERFORM audit_log_ensure_partition(m);
  END LOOP;
END $$;

INSERT INTO audit_log (
  id, houseboat_id, actor_account_id, action, entity_type, entity_id,
  before, after, device_time, server_time, synced_offline
)
SELECT
  id, houseboat_id, actor_account_id, action, entity_type, entity_id,
  before, after, device_time, server_time, synced_offline
FROM audit_log_old;

-- 8. Indexes (mirror the originals).
CREATE INDEX audit_log_houseboat_id_idx ON audit_log ("houseboat_id");
CREATE INDEX audit_log_entity_type_entity_id_idx ON audit_log ("entity_type", "entity_id");

-- 9. Foreign keys (same as the original table).
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_houseboat_id_fkey
  FOREIGN KEY ("houseboat_id") REFERENCES houseboat ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_actor_account_id_fkey
  FOREIGN KEY ("actor_account_id") REFERENCES account ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 10. Re-attach the append-only guard (blocks UPDATE/DELETE) on the parent.
DROP TRIGGER IF EXISTS trg_audit_no_update ON audit_log;
CREATE TRIGGER trg_audit_no_update
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutation();

-- 11. Drop the old table.
DROP TABLE audit_log_old;
