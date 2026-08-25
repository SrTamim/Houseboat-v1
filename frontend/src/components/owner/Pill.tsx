import { humanize } from '@/lib/owner/format';

export type PillTone = 'blue' | 'ok' | 'warn' | 'danger' | 'amb' | 'mut' | 'lock';

// Base pill shape (was .pill). Colours per tone (was .pill.<tone>).
const PILL_BASE =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[11.5px] font-semibold leading-[1.5]';
// Leading dot (was .pill::before) — currentColor, 6px.
const PILL_DOT = "before:h-1.5 before:w-1.5 before:flex-none before:rounded-full before:bg-current before:content-['']";
const PILL_TONE: Record<PillTone, string> = {
  blue: 'border-[color-mix(in_srgb,var(--blue)_20%,transparent)] bg-[color-mix(in_srgb,var(--blue)_12%,transparent)] text-blue-600',
  ok: 'border-[color-mix(in_srgb,var(--ok)_22%,transparent)] bg-[color-mix(in_srgb,var(--ok)_13%,transparent)] text-ok',
  warn: 'border-[color-mix(in_srgb,var(--warn)_24%,transparent)] bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] text-warn',
  danger:
    'border-[color-mix(in_srgb,var(--danger)_22%,transparent)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-danger',
  amb: 'border-[color-mix(in_srgb,var(--amber)_26%,transparent)] bg-[color-mix(in_srgb,var(--amber)_16%,transparent)] text-amber-700 dark:text-amber',
  mut: 'border-hair bg-chip text-muted',
  lock: 'border-hair bg-chip text-muted',
};

export function Pill({
  tone = 'mut',
  children,
}: {
  tone?: PillTone;
  children: React.ReactNode;
}) {
  // .lock swapped the dot for a padlock glyph; render it as content instead.
  const dot = tone === 'lock' ? '' : PILL_DOT;
  return (
    <span className={`${PILL_BASE} ${dot} ${PILL_TONE[tone]}`}>
      {tone === 'lock' ? <span className="text-[9px] leading-none">🔒</span> : null}
      {children}
    </span>
  );
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
  payout_approved: 'blue',
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
