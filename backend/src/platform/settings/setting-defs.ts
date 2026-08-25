/**
 * Registry of runtime-editable operational settings.
 *
 * Each entry declares a stable `key`, the compiled-in `default` (which MUST equal
 * the value the code used before it became editable, so an empty app_setting table
 * reproduces prior behaviour exactly), and `min`/`max` guard rails the API enforces
 * on every write. `ceiling`, when present, is the hard upper bound baked into a
 * request-validation decorator elsewhere — the admin may set a value up to `ceiling`
 * but never above it (see the note on MAX_CABINS_PER_BOOKING / MAX_CHILDREN_PER_CABIN
 * in booking.dto.ts: those decorators cannot read a live value, so we keep them as the
 * ceiling and enforce the editable, lower number in the service layer).
 *
 * All settings are integers today. `unit`/`label`/`help` are display metadata the
 * admin console renders; they never affect behaviour.
 */
export interface SettingDef {
  key: string;
  label: string;
  help: string;
  unit: string;
  default: number;
  min: number;
  max: number;
  /** Group heading in the admin UI. */
  group: string;
}

export const SETTING_DEFS = [
  {
    key: 'hold.ttlMin',
    label: 'Cabin hold time',
    help: 'How long a cabin stays reserved while a guest books, before it is released.',
    unit: 'minutes',
    default: 10,
    min: 2,
    max: 60,
    group: 'Booking holds',
  },
  {
    key: 'hold.checkoutExtensionMin',
    label: 'Checkout time extension',
    help: 'One-time extra time granted (added to what is left) when a guest reaches checkout.',
    unit: 'minutes',
    default: 10,
    min: 0,
    max: 60,
    group: 'Booking holds',
  },
  {
    key: 'hold.graceMin',
    label: 'Hold heartbeat grace',
    help: 'How long a hold may go silent (tab closed) before the sweeper reclaims its cabins.',
    unit: 'minutes',
    default: 2,
    min: 1,
    max: 30,
    group: 'Booking holds',
  },
  {
    key: 'booking.maxCabins',
    label: 'Max cabins per booking',
    help: 'Cabins one self-service booking may hold at once. Ceiling is 4 (a hard cap in request validation); you may set this lower to tighten it.',
    unit: 'cabins',
    default: 4,
    min: 1,
    max: 4,
    group: 'Booking limits',
  },
  {
    key: 'booking.maxChildrenPerCabin',
    label: 'Max children per cabin',
    help: 'Children allowed in one cabin on top of its adults. Ceiling is 4 (a hard cap in request validation); you may set this lower to tighten it.',
    unit: 'children',
    default: 4,
    min: 0,
    max: 4,
    group: 'Booking limits',
  },
  {
    key: 'auth.loginLockThreshold',
    label: 'Login lockout threshold',
    help: 'Consecutive failed logins for one phone before logins are temporarily blocked.',
    unit: 'attempts',
    default: 8,
    min: 3,
    max: 50,
    group: 'Security',
  },
  {
    key: 'auth.loginLockWindowSec',
    label: 'Login lockout window',
    help: 'How long logins stay blocked after the threshold is hit.',
    unit: 'seconds',
    default: 15 * 60,
    min: 60,
    max: 24 * 60 * 60,
    group: 'Security',
  },
  {
    key: 'billing.graceDays',
    label: 'Billing grace period',
    help: 'Days an unpaid subscription invoice may age before the boat is marked overdue / locked.',
    unit: 'days',
    default: 14,
    min: 0,
    max: 90,
    group: 'Billing',
  },
] as const satisfies readonly SettingDef[];

export type SettingKey = (typeof SETTING_DEFS)[number]['key'];

export const SETTING_DEF_BY_KEY: Record<string, SettingDef> = Object.fromEntries(
  SETTING_DEFS.map((d) => [d.key, d]),
);
