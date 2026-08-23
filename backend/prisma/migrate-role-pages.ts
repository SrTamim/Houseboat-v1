/**
 * Data migration: rewrite stored Role.permissions from the legacy 10-module
 * vocabulary to the 29 per-page vocabulary.
 *
 * Role.permissions is a free-form JSON column, so there is no schema change —
 * this is a one-off data rewrite. It reuses the SAME expansion the runtime shim
 * uses (expandLegacyPermissions), so a migrated row resolves identically to how
 * it did before, just stored explicitly as page keys.
 *
 * Idempotent: a role whose map already contains page-only keys is detected as
 * page-shaped and left untouched, so this can be run repeatedly and after the
 * app has already been serving expanded permissions.
 *
 *   pnpm tsx prisma/migrate-role-pages.ts
 */
import { PrismaClient } from '@prisma/client';
import { expandLegacyPermissions } from '../src/rbac/rbac.service';
import { PermissionMap } from '../src/rbac/permission.types';

const prisma = new PrismaClient();

async function main() {
  const roles = await prisma.role.findMany({
    select: { id: true, name: true, permissions: true },
  });

  let rewritten = 0;
  let skipped = 0;

  for (const role of roles) {
    const stored = (role.permissions as PermissionMap) ?? {};
    const expanded = expandLegacyPermissions(stored);

    // If expansion produced the same key set, the row was already page-shaped
    // (or empty) — nothing to write.
    const before = JSON.stringify(sortedEntries(stored));
    const after = JSON.stringify(sortedEntries(expanded));
    if (before === after) {
      skipped++;
      continue;
    }

    await prisma.role.update({
      where: { id: role.id },
      data: { permissions: expanded as never },
    });
    rewritten++;
    console.log(`  rewrote role ${role.id} (${role.name})`);
  }

  console.log(
    `\nDone. ${rewritten} role(s) rewritten to page keys, ${skipped} already page-shaped/empty.`,
  );
}

/** Stable, comparable representation of a permission map. */
function sortedEntries(map: PermissionMap) {
  return Object.entries(map)
    .map(([k, v]) => [k, { view: !!v?.view, edit: !!v?.edit }] as const)
    .sort((a, b) => a[0].localeCompare(b[0]));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
