/**
 * Display helpers for the owner console.
 *
 * Money arrives from the API as a *string*: Prisma Decimal serializes that way,
 * and parsing it into a JS number would reintroduce the float rounding the
 * backend is careful to avoid. So everything here formats strings and never
 * does arithmetic on them.
 */

const TAKA = '৳';

/** "10180.00" → "৳10,180". Fractions are shown only when non-zero. */
export function money(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return `${TAKA}0`;
  const n = Number(value);
  if (!Number.isFinite(n)) return `${TAKA}${value}`;
  const abs = Math.abs(n);
  const body = abs.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(abs) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${n < 0 ? '−' : ''}${TAKA}${body}`;
}

/** Compact money for KPI figures: 964000 → "৳9.6L". */
export function moneyShort(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return money(value);
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 10_000_000) return `${sign}${TAKA}${(abs / 10_000_000).toFixed(1)}Cr`;
  if (abs >= 100_000) return `${sign}${TAKA}${(abs / 100_000).toFixed(1)}L`;
  if (abs >= 1_000) return `${sign}${TAKA}${(abs / 1_000).toFixed(1)}k`;
  return money(n);
}

/** True when a Decimal-as-string is below zero, without parsing risk. */
export function isNegative(value: string | number | null | undefined): boolean {
  return Number(value ?? 0) < 0;
}

/**
 * Booking source label — 'pos' = owner counter sale, else (default 'web') = the
 * public website. Owner-facing only; never shown to a customer or on an invoice.
 */
export function channelLabel(channel: string | null | undefined): string {
  return channel === 'pos' ? 'Counter' : 'Website';
}

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};

/** "2026-07-21T…" → "21 Jul 2026". */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', DATE_OPTS);
}

/** "21 Jul 2026, 07:30". */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('en-GB', DATE_OPTS)}, ${d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

/**
 * Clock time from a Prisma `@db.Time` column: "07:30:00" → "07:30 AM".
 *
 * Postgres `time` carries no date, so the driver hands it back anchored to
 * 1970-01-01Z — only the clock part means anything. It MUST be read back in UTC:
 * rendering in the viewer's zone shifts a 07:30 departure to 01:30 PM on a
 * UTC+6 machine. Returns '' (not '—') so callers can suppress a separator.
 */
export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  });
}

/** Weekday for calendar and departure rows: "Tue". */
export function weekday(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { weekday: 'short' });
}

/** Relative deadline for claim windows and quote expiry: "4h left", "2 days left". */
export function timeLeft(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  const ms = d.getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return `${Math.max(1, Math.floor(ms / 60_000))}m left`;
  if (hours < 48) return `${hours}h left`;
  return `${Math.floor(hours / 24)} days left`;
}

/** Mask the middle of a phone number for list views: +8801711••2290. */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  if (phone.length < 8) return phone;
  return `${phone.slice(0, -6)}••${phone.slice(-4)}`;
}

/** Initials for avatar chips. */
export function initials(name: string | null | undefined, fallback = '?'): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || fallback;
}

/** snake_case status → "Payment verified". */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  const s = value.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Convert Bangla numerals to ASCII digits.
 *
 * Owners type amounts on a Bangla keyboard (৩৫০০), and the plan calls for
 * accepting them at the input layer rather than making the person switch.
 */
export function normalizeDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
}

/** E.164 for Bangladesh: "01711 22 2290" → "+8801711222290". */
export function toE164(phone: string): string {
  const digits = normalizeDigits(phone).replace(/\D/g, '').replace(/^0+/, '');
  return `+880${digits}`;
}

/**
 * Pull a human message out of an axios error.
 *
 * Nest's ValidationPipe returns `message` as an array of field errors, so the
 * array case is the common one, not an edge case.
 */
export function apiErrorMessage(e: unknown, fallback: string): string {
  const message = (e as { response?: { data?: { message?: unknown } } })?.response?.data
    ?.message;
  if (Array.isArray(message)) return message.join(', ');
  return typeof message === 'string' ? message : fallback;
}

/** True when an error is the backend's billing-lock 403. */
export function isBillingLockError(e: unknown): boolean {
  const status = (e as { response?: { status?: number } })?.response?.status;
  if (status !== 403) return false;
  return apiErrorMessage(e, '').toLowerCase().includes('locked');
}

/** Today's date as "YYYY-MM-DD" in the browser's local zone. */
function localToday(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

/**
 * The default day ("YYYY-MM-DD") a schedule filter should land on: the soonest
 * upcoming SCHEDULED departure (startDate today-or-later). If none are upcoming,
 * fall back to the most recent scheduled date so the filter is never blank; ''
 * when there are no scheduled departures at all.
 *
 * The `/departures-list` endpoint returns ALL rows — past dates and cancelled
 * departures included and in no guaranteed order — so this filters on `status`
 * and computes the min/max day-string explicitly rather than trusting the array
 * order (POS sorts ascending, the departures page descending).
 */
export function nextDepartureDate(
  departures: { startDate: string; status: string }[] | undefined,
): string {
  const days = (departures ?? [])
    .filter((d) => d.status === 'scheduled')
    .map((d) => d.startDate.slice(0, 10));
  if (days.length === 0) return '';
  const today = localToday();
  const upcoming = days.filter((d) => d >= today);
  // Soonest upcoming, or (nothing upcoming) the most recent past scheduled day.
  return upcoming.length > 0
    ? upcoming.reduce((min, d) => (d < min ? d : min))
    : days.reduce((max, d) => (d > max ? d : max));
}
