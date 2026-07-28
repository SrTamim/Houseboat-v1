// Invoice status labels (business language) → pill tone.
// Ported from design-previews/admin/partials.js STATUS.
// See admin/README.md for the label → schema-state mapping used by the real build.

export type PillTone = 'blue' | 'ok' | 'warn' | 'danger' | 'amb' | 'mut';

export const INVOICE_STATUS: Record<string, PillTone> = {
  'Advance Paid': 'amb',
  'Due Paid': 'blue',
  Canceled: 'mut',
  'Canceled by Boat': 'danger',
  'Refund Requested': 'warn',
  'Refund Verified': 'blue',
  Refunded: 'ok',
  'Ready for Payout': 'warn',
  'Payout Verified': 'blue',
  'Paid to Boat': 'ok',
  'Over Paid': 'danger',
};

export const INVOICE_STATUS_LIST = Object.keys(INVOICE_STATUS);

export const statusTone = (s: string): PillTone => INVOICE_STATUS[s] ?? 'mut';
export const tripTone = (t: string): PillTone => (t === 'Completed' ? 'ok' : 'mut');
