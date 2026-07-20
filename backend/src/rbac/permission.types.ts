/**
 * Per-module permission model. A role's `permissions` JSON is a map of
 * module -> { view, edit }. Read as a unit at request time (plan §10).
 *
 * Modules mirror the 7 plan domains an owner-side user can touch.
 */
export type PermModule =
  | 'bookings'
  | 'assets'
  | 'trips'
  | 'pricing'
  | 'money'
  | 'staff'
  | 'inventory'
  | 'costs'
  | 'reports'
  | 'settings';

export type PermAction = 'view' | 'edit';

export type PermissionMap = Partial<
  Record<PermModule, { view?: boolean; edit?: boolean }>
>;

/** Everything on — used for the auto-generated Owner role. */
export const FULL_PERMISSIONS: PermissionMap = {
  bookings: { view: true, edit: true },
  assets: { view: true, edit: true },
  trips: { view: true, edit: true },
  pricing: { view: true, edit: true },
  money: { view: true, edit: true },
  staff: { view: true, edit: true },
  inventory: { view: true, edit: true },
  costs: { view: true, edit: true },
  reports: { view: true, edit: true },
  settings: { view: true, edit: true },
};

/** The active boat context resolved for a request. */
export interface BoatContext {
  houseboatId: string;
  membershipId: string;
  roleId: string;
  permissions: PermissionMap;
  isExited: boolean; // end_date set → read-only for their period
}
