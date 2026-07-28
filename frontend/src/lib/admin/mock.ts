// Mock data for the admin preview screens (no backend yet).
// Ported from design-previews/admin/partials.js + content-*.js.
// Replace with SWR/api calls in the backend-wiring pass.

export type InvoiceCabin = {
  name: string;
  cat: string;
  adults: number;
  children: number;
  price: string;
};

export type InvoicePayment = {
  method: string;
  amount: string;
  token: string;
  by: string;
  at: string;
};

export type Invoice = {
  inv: string;
  bk: string;
  status: string;
  boat: string;
  date: string;
  trip: string;
  method: string;
  lock?: boolean;
  customer: { name: string; phone: string; email: string; lead: string };
  booking: {
    route: string;
    dates: string;
    duration: string;
    type: string;
    headcount: string;
    reference: string;
    notes: string;
    cabins: InvoiceCabin[];
  };
  money: {
    room: string;
    gatewayPct: string;
    gatewayFee: string;
    shown: string;
    coupon: string;
    discount: string;
    total: string;
    advance: string;
    due: string;
    paid: string;
    overpaid: string;
    commission: string;
    dueToBoat: string;
  };
  payments: InvoicePayment[];
  meta: { policy: string; batch: string; created: string; updated: string };
};

export const SAMPLE_INVOICE: Invoice = {
  inv: 'INV-8410',
  bk: 'BK-8f3a',
  status: 'Due Paid',
  boat: 'Jol Kolol',
  date: '18 Jul 2026',
  trip: 'Completed',
  method: 'Online',
  lock: false,
  customer: {
    name: 'Tanvir Hasan',
    phone: '+8801711002200',
    email: 'tanvir@example.com',
    lead: 'Tanvir Hasan',
  },
  booking: {
    route: 'Tanguar Haor · Sunamganj',
    dates: '24–25 Jul 2026',
    duration: '2 days 1 night',
    type: 'Cabin booking',
    headcount: '2 adults',
    reference: 'Rakib (referral)',
    notes: 'One guest is vegetarian. Late check-in around 9pm.',
    cabins: [{ name: '101', cat: 'Luxury AC', adults: 2, children: 0, price: '10,000' }],
  },
  money: {
    room: '10,000',
    gatewayPct: '1.8%',
    gatewayFee: '180',
    shown: '10,180',
    coupon: 'EID10 · 10%',
    discount: '1,018',
    total: '9,162',
    advance: '3,000',
    due: '6,162',
    paid: '9,162',
    overpaid: '',
    commission: '500',
    dueToBoat: '8,482',
  },
  payments: [
    { method: 'Online', amount: '3,000', token: 'sslcz_a0…4d12', by: 'Nusrat J.', at: '18 Jul 15:22' },
    { method: 'Online', amount: '6,162', token: 'sslcz_b7…9f55', by: 'Nusrat J.', at: '24 Jul 09:10' },
  ],
  meta: {
    policy: 'Moderate · 50% if >7 days',
    batch: '—',
    created: '18 Jul 2026 15:20',
    updated: '24 Jul 2026 09:11',
  },
};

// Merge helper so screens can derive a variant invoice from the sample.
// Nested objects (customer/booking/money/meta) may be supplied partially —
// each is shallow-merged onto the sample, so callers pass only changed fields.
export type InvoiceOverride = Partial<Omit<Invoice, 'customer' | 'booking' | 'money' | 'meta'>> & {
  customer?: Partial<Invoice['customer']>;
  booking?: Partial<Invoice['booking']>;
  money?: Partial<Invoice['money']>;
  meta?: Partial<Invoice['meta']>;
};

export const makeInvoice = (over: InvoiceOverride): Invoice => ({
  ...SAMPLE_INVOICE,
  ...over,
  customer: { ...SAMPLE_INVOICE.customer, ...over.customer },
  booking: { ...SAMPLE_INVOICE.booking, ...over.booking },
  money: { ...SAMPLE_INVOICE.money, ...over.money },
  meta: { ...SAMPLE_INVOICE.meta, ...over.meta },
});

export type InvoiceRow = {
  inv: string;
  bk: string;
  status: string;
  boat: string;
  date: string;
  trip: string;
  method: string;
  amount: string;
  token: string;
  primary?: boolean;
};
