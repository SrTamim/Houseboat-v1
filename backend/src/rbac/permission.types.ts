/**
 * Per-page permission model. A role's `permissions` JSON is a map of
 * page -> { view, edit }. Read as a unit at request time (plan §10).
 *
 * The vocabulary is a SUPERSET: it lists the 29 owner-console pages AND keeps
 * the 10 legacy business modules as still-valid keys. This lets older stored
 * roles (and any code that still hardcodes a module string — sync replay, a few
 * service-level asserts, seeds, specs) keep resolving without a lockstep
 * rewrite. `expandLegacyPermissions` (RbacService) turns a stored legacy key
 * into its owning pages at read time, and a migration rewrites stored roles to
 * explicit page keys. See LEGACY_MODULE_PAGES below for the mapping.
 */

/** The 29 owner-console pages a per-boat role can grant. Mirrors OWNER_NAV keys. */
export type PermPage =
  | 'dashboard'
  | 'bookings'
  | 'pos'
  | 'departure'
  | 'waitlist'
  | 'quotes'
  | 'reviews'
  | 'guests'
  | 'packages'
  | 'schedule'
  | 'pricing'
  | 'profile'
  | 'cabins'
  | 'coupons'
  | 'refunds'
  | 'payouts'
  | 'earnings'
  | 'billing'
  | 'crew'
  | 'attendance'
  | 'payroll'
  | 'team'
  | 'costs'
  | 'inventory'
  | 'maintenance'
  | 'reports'
  | 'audit'
  | 'sync'
  | 'settings'
  // ── Legacy business modules — retained so existing keys stay assignable. ──
  | 'assets'
  | 'trips'
  | 'money'
  | 'staff';

/**
 * Backwards-compatible alias. Older code imports `PermModule`; it now widens to
 * the page vocabulary. New code should prefer `PermPage`.
 */
export type PermModule = PermPage;

export type PermAction = 'view' | 'edit';

export type PermissionMap = Partial<
  Record<PermPage, { view?: boolean; edit?: boolean }>
>;

/** The 29 page keys, in OWNER_NAV order — iterate this for UI and migration. */
export const PERM_PAGES: PermPage[] = [
  'dashboard',
  'bookings',
  'pos',
  'departure',
  'waitlist',
  'quotes',
  'reviews',
  'guests',
  'packages',
  'schedule',
  'pricing',
  'profile',
  'cabins',
  'coupons',
  'refunds',
  'payouts',
  'earnings',
  'billing',
  'crew',
  'attendance',
  'payroll',
  'team',
  'costs',
  'inventory',
  'maintenance',
  'reports',
  'audit',
  'sync',
  'settings',
];

/**
 * Legacy module → the pages it authorized. Used to (a) expand a stored legacy
 * permission map into effective per-page permissions at read time, and (b)
 * rewrite stored roles in the data migration. The mapping mirrors how routes
 * were actually gated (e.g. earnings sat under `money`, audit under `settings`,
 * maintenance under `assets`), so existing access is preserved exactly.
 */
export const LEGACY_MODULE_PAGES: Record<string, PermPage[]> = {
  bookings: ['bookings', 'pos', 'departure', 'waitlist', 'quotes', 'reviews', 'guests'],
  trips: ['packages', 'schedule'],
  pricing: ['pricing', 'coupons'],
  assets: ['profile', 'cabins', 'maintenance'],
  money: ['refunds', 'payouts', 'earnings', 'billing'],
  staff: ['crew', 'attendance', 'payroll', 'team'],
  costs: ['costs'],
  inventory: ['inventory'],
  reports: ['dashboard', 'reports'],
  settings: ['settings', 'audit', 'sync', 'team'],
};

/** Everything on — used for the auto-generated Owner role. All 29 pages. */
export const FULL_PERMISSIONS: PermissionMap = Object.fromEntries(
  PERM_PAGES.map((p) => [p, { view: true, edit: true }]),
) as PermissionMap;

/** The active boat context resolved for a request. */
export interface BoatContext {
  houseboatId: string;
  membershipId: string;
  roleId: string;
  permissions: PermissionMap;
  isExited: boolean; // end_date set → read-only for their period
}
