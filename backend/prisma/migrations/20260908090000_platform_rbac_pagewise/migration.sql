-- Data migration: rewrite platform_role.permissions from the six legacy modules
-- (boats/finance/ops/accounts/roles/settings) to per-page keys, mirroring the
-- backend LEGACY_PLATFORM_MODULE_PAGES map. Idempotent: page keys pass through,
-- edit implies view, page + legacy overlaps OR-merge. Superadmins (no role) are
-- untouched. No schema change — permissions stays jsonb.

DO $$
DECLARE
  r RECORD;
  legacy jsonb := jsonb_build_object(
    'boats',    jsonb_build_array('boats','routes'),
    'finance',  jsonb_build_array('booking-invoice','verify','payouts','pay-to-vendors','commission','billing','refunds','credits','cashouts','overpayments','billing-config','debtors','coupons','analytics','gateway'),
    'ops',      jsonb_build_array('bookings','reviews','waitlist','notifications','audit'),
    'accounts', jsonb_build_array('accounts','memberships'),
    'roles',    jsonb_build_array('roles'),
    'settings', jsonb_build_array('jobs')
  );
  key TEXT;
  val jsonb;
  page TEXT;
  v BOOLEAN;
  e BOOLEAN;
  cur jsonb;
  out jsonb;
  cur_v BOOLEAN;
  cur_e BOOLEAN;
BEGIN
  FOR r IN SELECT id, permissions FROM platform_role LOOP
    out := '{}'::jsonb;
    -- Walk every stored key; expand legacy modules to their pages, keep page keys.
    FOR key, val IN SELECT * FROM jsonb_each(COALESCE(r.permissions, '{}'::jsonb)) LOOP
      v := COALESCE((val->>'view')::boolean, false);
      e := COALESCE((val->>'edit')::boolean, false);
      IF legacy ? key THEN
        FOR page IN SELECT jsonb_array_elements_text(legacy->key) LOOP
          cur := out->page;
          cur_v := COALESCE((cur->>'view')::boolean, false);
          cur_e := COALESCE((cur->>'edit')::boolean, false);
          out := jsonb_set(out, ARRAY[page], jsonb_build_object(
            'view', (cur_v OR v OR e),
            'edit', (cur_e OR e)
          ), true);
        END LOOP;
      ELSE
        -- Already a page key (or an unknown key we simply carry forward as a page).
        cur := out->key;
        cur_v := COALESCE((cur->>'view')::boolean, false);
        cur_e := COALESCE((cur->>'edit')::boolean, false);
        out := jsonb_set(out, ARRAY[key], jsonb_build_object(
          'view', (cur_v OR v OR e),
          'edit', (cur_e OR e)
        ), true);
      END IF;
    END LOOP;
    UPDATE platform_role SET permissions = out WHERE id = r.id;
  END LOOP;
END $$;
