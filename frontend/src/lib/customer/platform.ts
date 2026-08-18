/**
 * Platform identity for customer-facing documents (invoices, vouchers).
 *
 * A single source so the printed invoice and the site footer cannot drift.
 * These are the same values CustomerFooter renders inline today; swap in real
 * trade-license / BIN numbers here once they are issued and every document
 * picks them up.
 */
export const PLATFORM = {
  name: 'HaorBoat',
  legalName: 'HaorBoat',
  address: 'Banani, Dhaka 1213, Bangladesh',
  email: 'hello@haorboat.com',
  site: 'haorboat.com',
  mark: '⚓',
} as const;
