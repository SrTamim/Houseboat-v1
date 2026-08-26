// Admin sidebar navigation model — single source of truth.
// Ported from design-previews/admin/_gen.js NAV, with .html files → /admin routes.

export type NavItem = {
  key: string;
  icon: string;
  label: string;
  href: string;
};

export type NavSubgroup = {
  subgroup: string;
  items: NavItem[];
};

export type NavGroup = {
  group: string;
  // Flat groups carry `items`; grouped ones (Finance) carry `subgroups`.
  items?: NavItem[];
  subgroups?: NavSubgroup[];
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
      { key: 'boats', icon: '🚤', label: 'Boats', href: '/admin/boats' },
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
    subgroups: [
      {
        subgroup: 'Vendor',
        items: [
          { key: 'booking-invoice', icon: '📋', label: 'Booking Invoice', href: '/admin/finance/booking-invoice' },
          { key: 'verify', icon: '✓', label: 'Verify', href: '/admin/finance/verify' },
          { key: 'payouts', icon: '💸', label: 'Payouts', href: '/admin/finance/payouts' },
          { key: 'pay-to-vendors', icon: '🏦', label: 'Pay to Vendors', href: '/admin/finance/pay-to-vendors' },
          { key: 'commission', icon: '%', label: 'Commission', href: '/admin/finance/commission' },
          { key: 'billing', icon: '🧾', label: 'Subscriptions', href: '/admin/billing' },
        ],
      },
      {
        subgroup: 'Customer',
        items: [
          { key: 'refunds', icon: '↩', label: 'Refunds', href: '/admin/finance/refunds' },
          { key: 'credits', icon: '🎫', label: 'Credits', href: '/admin/finance/credits' },
          { key: 'cashouts', icon: '🏧', label: 'Cash-outs', href: '/admin/finance/cashouts' },
        ],
      },
      {
        subgroup: 'Other',
        items: [
          { key: 'overpayments', icon: '⚖', label: 'Overpayments', href: '/admin/finance/overpayments' },
          { key: 'billing-config', icon: '⚙', label: 'Billing config', href: '/admin/billing-config' },
          { key: 'debtors', icon: '🔻', label: 'Debtors', href: '/admin/debtors' },
        ],
      },
    ],
  },
  {
    group: 'System',
    items: [
      { key: 'jobs', icon: '🛠', label: 'System & health', href: '/admin/jobs' },
      { key: 'audit', icon: '📜', label: 'Audit log', href: '/admin/audit' },
      { key: 'notifications', icon: '🔔', label: 'Notifications', href: '/admin/notifications' },
      { key: 'gateway', icon: '💳', label: 'Gateway', href: '/admin/gateway' },
      { key: 'roles', icon: '🔑', label: 'Roles', href: '/admin/roles' },
    ],
  },
  {
    group: 'Disputes & risk',
    items: [
      { key: 'coupons', icon: '🏷', label: 'Coupons', href: '/admin/coupons' },
    ],
  },
];
