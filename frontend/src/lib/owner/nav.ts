/**
 * Owner console navigation — the single source of truth for the sidebar.
 *
 * Ported from design-previews/owner/_gen.js NAV. `badge` names a key on the
 * dashboard endpoint's `badges` object; the sidebar reads all counts from that
 * one response rather than firing a call per item.
 */

export interface OwnerNavItem {
  key: string;
  icon: string;
  label: string;
  href: string;
  /** Key in the dashboard `badges` map. */
  badge?: string;
  /** Render the badge amber (needs attention) rather than neutral. */
  badgeWarn?: boolean;
}

export interface OwnerNavGroup {
  group: string;
  items: OwnerNavItem[];
}

export const OWNER_NAV: OwnerNavGroup[] = [
  {
    group: 'Overview',
    items: [
      { key: 'dashboard', icon: '▦', label: 'Dashboard', href: '/owner/dashboard' },
      { key: 'calendar', icon: '🗓️', label: 'Calendar', href: '/owner/calendar' },
    ],
  },
  {
    group: 'Bookings',
    items: [
      { key: 'bookings', icon: '🎟️', label: 'Bookings', href: '/owner/bookings' },
      { key: 'pos', icon: '🧾', label: 'Counter sale', href: '/owner/pos' },
      {
        key: 'departure',
        icon: '⛴️',
        label: 'Departures',
        href: '/owner/departure',
        badge: 'departures',
        badgeWarn: true,
      },
      { key: 'waitlist', icon: '⏳', label: 'Waitlist', href: '/owner/waitlist', badge: 'waitlist' },
      {
        key: 'quotes',
        icon: '💬',
        label: 'Quotes',
        href: '/owner/quotes',
        badge: 'quotes',
        badgeWarn: true,
      },
      { key: 'reviews', icon: '★', label: 'Reviews', href: '/owner/reviews' },
      { key: 'guests', icon: '👥', label: 'Guests', href: '/owner/guests' },
    ],
  },
  {
    group: 'Trips & pricing',
    items: [
      { key: 'packages', icon: '📦', label: 'Packages', href: '/owner/packages' },
      { key: 'schedule', icon: '📅', label: 'Schedule', href: '/owner/schedule' },
      { key: 'pricing', icon: '৳', label: 'Pricing', href: '/owner/pricing' },
    ],
  },
  {
    group: 'Boat setup',
    items: [
      { key: 'profile', icon: '⛵', label: 'Boat profile', href: '/owner/profile' },
      { key: 'cabins', icon: '🚪', label: 'Decks & cabins', href: '/owner/cabins' },
      { key: 'coupons', icon: '🏷', label: 'Coupons', href: '/owner/coupons' },
    ],
  },
  {
    group: 'Money',
    items: [
      { key: 'invoices', icon: '🧮', label: 'Invoices', href: '/owner/invoices' },
      {
        key: 'payments',
        icon: '💵',
        label: 'Payments',
        href: '/owner/payments',
        badge: 'payments',
        badgeWarn: true,
      },
      { key: 'refunds', icon: '↩', label: 'Refunds', href: '/owner/refunds', badge: 'refunds' },
      { key: 'payouts', icon: '💸', label: 'Payouts', href: '/owner/payouts' },
      { key: 'earnings', icon: '📊', label: 'Earnings', href: '/owner/earnings' },
      {
        key: 'billing',
        icon: '🏛',
        label: 'Platform billing',
        href: '/owner/billing',
        badge: 'billing',
        badgeWarn: true,
      },
    ],
  },
  {
    group: 'People',
    items: [
      { key: 'crew', icon: '⚓', label: 'Crew', href: '/owner/crew' },
      { key: 'attendance', icon: '✓', label: 'Attendance', href: '/owner/attendance' },
      {
        key: 'payroll',
        icon: '💰',
        label: 'Payroll',
        href: '/owner/payroll',
        badge: 'payroll',
        badgeWarn: true,
      },
      { key: 'team', icon: '🔑', label: 'Team & roles', href: '/owner/team' },
    ],
  },
  {
    group: 'Operations',
    items: [
      { key: 'costs', icon: '🧾', label: 'Costs', href: '/owner/costs' },
      {
        key: 'inventory',
        icon: '📦',
        label: 'Inventory',
        href: '/owner/inventory',
        badge: 'inventory',
        badgeWarn: true,
      },
      {
        key: 'maintenance',
        icon: '🛠',
        label: 'Maintenance',
        href: '/owner/maintenance',
        badge: 'maintenance',
        badgeWarn: true,
      },
      { key: 'reports', icon: '📈', label: 'Reports', href: '/owner/reports' },
      { key: 'notifications', icon: '🔔', label: 'Notifications', href: '/owner/notifications' },
      { key: 'audit', icon: '📜', label: 'Audit log', href: '/owner/audit' },
      { key: 'sync', icon: '🔄', label: 'Sync', href: '/owner/sync' },
      { key: 'settings', icon: '⚙', label: 'Settings', href: '/owner/settings' },
    ],
  },
];
