import { humanize } from '@/lib/owner/format';

export type PillTone = 'blue' | 'ok' | 'warn' | 'danger' | 'amb' | 'mut' | 'lock';

export function Pill({
  tone = 'mut',
  children,
}: {
  tone?: PillTone;
  children: React.ReactNode;
}) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

/**
 * Tone for a booking status. Kept next to the pill rather than in each page so
 * "cancelled" is red everywhere it appears.
 */
const BOOKING_TONES: Record<string, PillTone> = {
  confirmed: 'ok',
  completed: 'blue',
  rescheduled: 'amb',
  cancelled: 'danger',
  not_arrived: 'warn',
};

export function BookingStatusPill({ status }: { status: string }) {
  return <Pill tone={BOOKING_TONES[status] ?? 'mut'}>{humanize(status)}</Pill>;
}

/**
 * Invoice states, in the order money moves through them:
 * customer_due → paid → payment_verified → in_payout → bill_cleared.
 * in_payout gets the lock tone because the invoice is frozen inside a batch.
 */
const INVOICE_TONES: Record<string, PillTone> = {
  customer_due: 'warn',
  paid: 'blue',
  payment_verified: 'ok',
  in_payout: 'lock',
  bill_cleared: 'mut',
};

export function InvoiceStatusPill({ status }: { status: string }) {
  return <Pill tone={INVOICE_TONES[status] ?? 'mut'}>{humanize(status)}</Pill>;
}

const DEPARTURE_TONES: Record<string, PillTone> = {
  scheduled: 'blue',
  in_progress: 'amb',
  completed: 'ok',
  cancelled: 'danger',
};

export function DepartureStatusPill({ status }: { status: string }) {
  return <Pill tone={DEPARTURE_TONES[status] ?? 'mut'}>{humanize(status)}</Pill>;
}
