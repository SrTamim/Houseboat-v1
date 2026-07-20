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

/** Whole days between now and the departure (floor 0). */
export function daysUntil(departure: Date, now: Date = new Date()): number {
  const ms = departure.getTime() - now.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
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

  // Custom tiers (from the snapshot) take precedence. Blackout forces 0.
  if (snapshot.template === 'custom' && Array.isArray(snapshot.tiers)) {
    const applicable = snapshot.tiers
      .filter((t) => (t.daysBefore ?? 0) <= daysBefore)
      .sort((a, b) => (b.daysBefore ?? 0) - (a.daysBefore ?? 0));
    // Any blackout tier that covers this window → 0%.
    if (snapshot.tiers.some((t) => t.isBlackout)) return 0;
    return applicable[0]?.refundPct ?? 0;
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
