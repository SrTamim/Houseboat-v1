import { BadRequestException } from '@nestjs/common';

/**
 * Per-PAGE permission vocabulary for PLATFORM staff — one key per admin console
 * nav page (frontend/src/lib/admin/nav.ts NAV keys). Replaces the old six coarse
 * modules (boats/finance/ops/accounts/roles/settings); those survive only as
 * LEGACY_PLATFORM_MODULES for read-time expansion + the one-off migration of
 * stored roles.
 *
 * Distinct from the per-boat rbac/permission.types.ts — that governs what a
 * boat member can do on their boat; this governs what platform staff can do
 * across all boats.
 *
 * Keep this list in lockstep with the admin sidebar NAV. `gateway` is a static
 * stub today but still gets a key so it gates like any other page.
 */
export const PLATFORM_PAGES = [
  'dashboard',
  'analytics',
  'boats',
  'routes',
  'bookings',
  'reviews',
  'accounts',
  'memberships',
  'waitlist',
  'booking-invoice',
  'verify',
  'payouts',
  'pay-to-vendors',
  'commission',
  'billing',
  'refunds',
  'credits',
  'cashouts',
  'overpayments',
  'billing-config',
  'debtors',
  'jobs',
  'audit',
  'notifications',
  'gateway',
  'roles',
  'coupons',
] as const;

export type PlatformPermPage = (typeof PLATFORM_PAGES)[number];
export type PlatformPermAction = 'view' | 'edit';

export type PlatformPermissionMap = Partial<
  Record<PlatformPermPage, { view?: boolean; edit?: boolean }>
>;

/**
 * The six pre-page modules, retained ONLY to expand un-migrated stored roles
 * and drive the migration. Mirrors rbac/permission.types.ts LEGACY_MODULE_PAGES.
 * Each mapping reproduces how routes were actually gated so existing access is
 * preserved to the page exactly:
 *  - finance covered every finance page + the gateway stub + analytics/commission
 *  - ops covered the operational reads/writes + the audit log
 *  - settings gated the System & health surface (the `jobs` page)
 */
export const LEGACY_PLATFORM_MODULE_PAGES: Record<string, PlatformPermPage[]> = {
  boats: ['boats', 'routes'],
  finance: [
    'booking-invoice',
    'verify',
    'payouts',
    'pay-to-vendors',
    'commission',
    'billing',
    'refunds',
    'credits',
    'cashouts',
    'overpayments',
    'billing-config',
    'debtors',
    'coupons',
    'analytics',
    'gateway',
  ],
  ops: ['bookings', 'reviews', 'waitlist', 'notifications', 'audit'],
  accounts: ['accounts', 'memberships'],
  roles: ['roles'],
  settings: ['jobs'],
};

/**
 * Expand a stored permission map into effective per-page permissions at read
 * time. Page keys pass through unchanged; a legacy module key is expanded to
 * every page it authorized (OR-ing view/edit onto any pages already present).
 * Idempotent — a fully page-shaped map returns an equivalent map. Mirrors
 * rbac.service.ts expandLegacyPermissions.
 */
export function expandLegacyPlatformPermissions(
  // Loose input: stored maps may still carry legacy module keys, so this accepts
  // any string-keyed map and only emits recognised page keys.
  map: Record<string, { view?: boolean; edit?: boolean } | undefined> | null | undefined,
): PlatformPermissionMap {
  if (!map) return {};
  const out: PlatformPermissionMap = {};
  const merge = (page: PlatformPermPage, perms: { view?: boolean; edit?: boolean }) => {
    const cur = out[page] ?? {};
    out[page] = {
      view: Boolean(cur.view || perms.view || perms.edit),
      edit: Boolean(cur.edit || perms.edit),
    };
  };
  for (const [key, perms] of Object.entries(map)) {
    if (!perms) continue;
    const legacyPages = LEGACY_PLATFORM_MODULE_PAGES[key];
    if (legacyPages) {
      for (const page of legacyPages) merge(page, perms);
    } else if ((PLATFORM_PAGES as readonly string[]).includes(key)) {
      merge(key as PlatformPermPage, perms);
    }
    // Unknown keys are dropped — they can never match a route lookup anyway.
  }
  return out;
}

const ACTIONS: readonly string[] = ['view', 'edit'];
// Accept both page keys and legacy module keys at write time, so an
// un-migrated role stays editable (the matrix only ever emits page keys, but a
// PATCH round-trips whatever was loaded until the migration rewrites it).
const WRITABLE_KEYS: readonly string[] = [
  ...PLATFORM_PAGES,
  ...Object.keys(LEGACY_PLATFORM_MODULE_PAGES),
];

/**
 * Validate an untrusted permissions object. Throws on unknown keys, unknown
 * actions, or non-boolean values — a typo'd page name must fail loudly at write
 * time, not silently deny at check time.
 */
export function validatePlatformPermissionMap(
  input: unknown,
): PlatformPermissionMap {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('permissions must be an object');
  }
  for (const [page, actions] of Object.entries(input)) {
    if (!WRITABLE_KEYS.includes(page)) {
      throw new BadRequestException(`Unknown platform page: ${page}`);
    }
    if (actions === null || typeof actions !== 'object' || Array.isArray(actions)) {
      throw new BadRequestException(`permissions.${page} must be an object`);
    }
    for (const [action, value] of Object.entries(actions)) {
      if (!ACTIONS.includes(action)) {
        throw new BadRequestException(`Unknown action on ${page}: ${action}`);
      }
      if (typeof value !== 'boolean') {
        throw new BadRequestException(
          `permissions.${page}.${action} must be a boolean`,
        );
      }
    }
  }
  return input as PlatformPermissionMap;
}
