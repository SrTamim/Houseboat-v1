import { Money, money, percentOf, ZERO } from './money';

/**
 * Refund policy resolution (plan §4 Path B). The refund percentage is read from
 * the invoice's policy SNAPSHOT (what was agreed that day), never the boat's
 * current policy. Blackout dates → 0% regardless of template. The percentage
 * applies to amount_paid; the platform keeps its commission either way.
 */

export interface PolicySnapshot {
  template?: string;
  depositPct?: number | null;
  /** custom tiers: [{ daysBefore, refundPct, isBlackout }] */
  tiers?: Array<{
    daysBefore?: number;
    refundPct?: number;
    isBlackout?: boolean;
  }> | null;
}

/** Built-in templates: refund % by how many days before departure. */
const TEMPLATE_TIERS: Record<string, Array<{ daysBefore: number; refundPct: number }>> = {
  // Full refund up to 1 day before.
  flexible: [
    { daysBefore: 1, refundPct: 100 },
    { daysBefore: 0, refundPct: 0 },
  ],
  // Full up to 7 days, 50% up to 3, none after.
  moderate: [
    { daysBefore: 7, refundPct: 100 },
    { daysBefore: 3, refundPct: 50 },
    { daysBefore: 0, refundPct: 0 },
  ],
  // 50% up to 14 days, none after.
  strict: [
    { daysBefore: 14, refundPct: 50 },
    { daysBefore: 0, refundPct: 0 },
  ],
  non_refundable: [{ daysBefore: 0, refundPct: 0 }],
};

/**
 * Bangladesh Standard Time offset (UTC+6). Boats operate in Asia/Dhaka, which
 * has no DST, so a fixed offset is exact. Cancellation day-counts must be judged
 * in the boat's local calendar, not UTC: departure.startDate is stored at UTC
 * midnight (@db.Date), and "now" is a UTC instant — differencing them raw put a
 * customer 6 hours off, so a trip ~1 day out could count as 0 days and drop them
 * a refund tier near midnight. (If boats ever span timezones, replace this fixed
 * offset with a per-boat timezone field.)
 */
const BST_OFFSET_MS = 6 * 60 * 60 * 1000;

/** Midnight (start of day) in Asia/Dhaka for an instant, expressed as a UTC ms value. */
function dhakaDayStartMs(instant: Date): number {
  const local = instant.getTime() + BST_OFFSET_MS;
  const dayStartLocal = Math.floor(local / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
  return dayStartLocal - BST_OFFSET_MS;
}

/**
 * Whole calendar days between now and the departure, in the boat's timezone
 * (Asia/Dhaka), floored at 0. Both sides are normalised to local midnight first
 * so the count is a difference of calendar dates, not a raw millisecond gap —
 * this is what keeps a same-day cancellation at 0 and a next-day one at 1
 * regardless of the time of day the customer cancels.
 */
export function daysUntil(departure: Date, now: Date = new Date()): number {
  const ms = dhakaDayStartMs(departure) - dhakaDayStartMs(now);
  return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)));
}

/**
 * Resolve the refund percentage (0–100) for a cancellation, given the policy
 * snapshot and how far out the departure is. Custom tiers win; blackout → 0.
 */
export function refundPercent(
  snapshot: PolicySnapshot | null | undefined,
  daysBefore: number,
): number {
  if (!snapshot) return 0;

  // Custom tiers (from the snapshot) take precedence.
  if (snapshot.template === 'custom' && Array.isArray(snapshot.tiers)) {
    const applicable = snapshot.tiers
      .filter((t) => (t.daysBefore ?? 0) <= daysBefore)
      .sort((a, b) => (b.daysBefore ?? 0) - (a.daysBefore ?? 0));
    // The nearest tier whose window covers this cancellation decides the outcome.
    // Blackout applies ONLY when it is that selected tier — previously ANY
    // blackout tier anywhere in the array forced 0% for every cancellation,
    // so a single "no refund 0–1 days" rule wrongly voided refunds weeks out.
    const selected = applicable[0];
    if (!selected) return 0;
    if (selected.isBlackout) return 0;
    return selected.refundPct ?? 0;
  }

  const tiers = TEMPLATE_TIERS[snapshot.template ?? 'non_refundable'];
  if (!tiers) return 0;
  const applicable = tiers
    .filter((t) => t.daysBefore <= daysBefore)
    .sort((a, b) => b.daysBefore - a.daysBefore);
  return applicable[0]?.refundPct ?? 0;
}

/** Refund amount = refundPct of amount_paid, rounded. */
export function refundAmount(amountPaid: Money, pct: number): Money {
  if (pct <= 0) return ZERO;
  return percentOf(amountPaid, money(pct));
}
