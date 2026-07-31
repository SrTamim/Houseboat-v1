/**
 * Money formatting for the admin console.
 *
 * Prisma serializes Decimal(12,2) columns as JSON *strings*, not numbers, so
 * amounts arrive as e.g. "8482.00". Never parseFloat them for display — that
 * reintroduces the binary-float error the Decimal column exists to avoid.
 * Intl handles the string via Number only at the presentation boundary, where
 * a rounding artefact can't propagate into stored data.
 */

/**
 * en-IN, not en-US: the design uses lakh grouping (৳1,84,000), which en-US
 * would render as 184,000.
 */
const BDT = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/**
 * Format an amount for display, without the currency mark — pages render
 * `<span className="u">৳</span>` separately so it picks up its own styling.
 *
 * Negative values are meaningful here (a boat owing the platform, a negative
 * payout batch), so the sign is preserved rather than stripped.
 */
export function formatBDT(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return '—';
  return BDT.format(n);
}

/** True when an amount is below zero — callers style these distinctly. */
export function isNegative(amount: string | number | null | undefined): boolean {
  if (amount === null || amount === undefined || amount === '') return false;
  const n = typeof amount === 'number' ? amount : Number(amount);
  return Number.isFinite(n) && n < 0;
}
