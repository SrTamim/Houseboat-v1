// Admin sidebar navigation model — single source of truth.
// Ported from design-previews/admin/_gen.js NAV, with .html files → /admin routes.

export type NavItem = {
  key: string;
  icon: string;
  label: string;
  href: string;
  count?: string;
  countWarn?: boolean;
};

export type NavGroup = {
  group: string;
  items: NavItem[];
};

export const NAV: NavGroup[] = [
  {
    group: 'Overview',
    items: [
      { key: 'dashboard', icon: '▦', label: 'Dashboard', href: '/admin/dashboard' },
      { key: 'analytics', icon: '📈', label: 'Analytics', href: '/admin/analytics' },
    ],
  },
  {
    group: 'Operations',
    items: [
      { key: 'boats', icon: '🚤', label: 'Boats', href: '/admin/boats', count: '3', countWarn: true },
      { key: 'routes', icon: '🗺️', label: 'Routes', href: '/admin/routes' },
      { key: 'bookings', icon: '🎟️', label: 'Bookings', href: '/admin/bookings' },
      { key: 'reviews', icon: '★', label: 'Reviews', href: '/admin/reviews' },
      { key: 'accounts', icon: '👤', label: 'Accounts', href: '/admin/accounts' },
      { key: 'memberships', icon: '👥', label: 'Memberships', href: '/admin/memberships' },
      { key: 'waitlist', icon: '⏳', label: 'Waitlist', href: '/admin/waitlist' },
    ],
  },
  {
    group: 'Finance',
    items: [
      { key: 'verify', icon: '✓', label: 'Verify', href: '/admin/finance/verify', count: '5', countWarn: true },
      { key: 'refunds', icon: '↩', label: 'Refunds', href: '/admin/finance/refunds', count: '2' },
      { key: 'payouts', icon: '💸', label: 'Payouts', href: '/admin/finance/payouts' },
      { key: 'overpayments', icon: '⚖', label: 'Overpayments', href: '/admin/finance/overpayments' },
      { key: 'credits', icon: '🎫', label: 'Credits', href: '/admin/finance/credits' },
      { key: 'commission', icon: '%', label: 'Commission', href: '/admin/finance/commission' },
      { key: 'billing', icon: '🧾', label: 'Subscriptions', href: '/admin/billing' },
      { key: 'billing-config', icon: '⚙', label: 'Billing config', href: '/admin/billing-config' },
      { key: 'debtors', icon: '🔻', label: 'Debtors', href: '/admin/debtors', count: '1', countWarn: true },
    ],
  },
  {
    group: 'System',
    items: [
      { key: 'jobs', icon: '🩺', label: 'Jobs & health', href: '/admin/jobs', count: '1', countWarn: true },
      { key: 'audit', icon: '📜', label: 'Audit log', href: '/admin/audit' },
      { key: 'sync', icon: '🔄', label: 'Sync conflicts', href: '/admin/sync', count: '1', countWarn: true },
      { key: 'notifications', icon: '🔔', label: 'Notifications', href: '/admin/notifications' },
      { key: 'gateway', icon: '💳', label: 'Gateway', href: '/admin/gateway' },
      { key: 'settings', icon: '🛠', label: 'Settings', href: '/admin/settings' },
      { key: 'roles', icon: '🔑', label: 'Roles', href: '/admin/roles' },
    ],
  },
  {
    group: 'Disputes & risk',
    items: [
      { key: 'disputes', icon: '⚑', label: 'Disputes', href: '/admin/disputes' },
      { key: 'idor', icon: '🛡', label: 'Security', href: '/admin/security' },
      { key: 'coupons', icon: '🏷', label: 'Coupons', href: '/admin/coupons' },
      { key: 'reschedules', icon: '🔁', label: 'Reschedules', href: '/admin/reschedules' },
      { key: 'cutoff', icon: '⛔', label: 'Cutoff', href: '/admin/cutoff' },
    ],
  },
];
