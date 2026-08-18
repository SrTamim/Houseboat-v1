import type { ChildPolicyBand } from './types';

/**
 * Reading the boat's child_policy age bands, the same way the server does.
 *
 * Both ends are INCLUSIVE — the owner's editor labels them "Age from"/"Age to",
 * so `{min:0,max:3}` covers 0, 1, 2 and 3. This must stay in step with
 * `childChargeFraction` in backend/src/common/child-policy.ts: if the two
 * disagree, the badge shown beside the age input contradicts the invoice.
 *
 * An age matching no band is not a discounted child at all — it bills full fare
 * (the server returns 1 for it). The owner's bands define what counts as a child;
 * anything outside them is a full-price person, and the UI says so instead of
 * letting the total quietly jump.
 */

/** The band covering `age`, or null when the policy has no rate for it. */
export function bandForAge(
  policy: ChildPolicyBand[] | null | undefined,
  age: number,
): ChildPolicyBand | null {
  if (!Array.isArray(policy) || policy.length === 0) return null;
  return (
    policy.find((b) => age >= (b.min ?? 0) && age <= (b.max ?? Infinity)) ?? null
  );
}

/**
 * What this age costs, as a share of the adult per-person rate:
 *   { pct: 0..100, matched: true }  — a real band
 *   { pct: 100, matched: false }    — no band; full fare, and worth warning about
 */
export function chargeForAge(
  policy: ChildPolicyBand[] | null | undefined,
  age: number,
): { pct: number; matched: boolean } {
  const band = bandForAge(policy, age);
  if (!band) return { pct: 100, matched: false };
  return {
    pct: Math.max(0, Math.min(100, band.chargePct ?? 100)),
    matched: true,
  };
}

/** "free" / "50%" / "full" — how a charge share reads on screen. */
export function chargeLabel(pct: number): string {
  if (pct <= 0) return 'free';
  if (pct >= 100) return 'full';
  return `${pct}%`;
}

/**
 * One band as the owner typed it: `{min:0,max:3}` → "0–3". A very high ceiling
 * (the usual 120/150) is really "and older", so it reads "12+" rather than
 * quoting an age nobody is.
 */
function bandRange(band: ChildPolicyBand): string {
  const min = band.min ?? 0;
  const max = band.max;
  if (max == null || max >= 100) return `${min}+`;
  return max <= min ? `${min}` : `${min}–${max}`;
}

/**
 * The whole policy in one short line for the Child stepper, e.g.
 * "0–3 free · 5–10 50% · 12+ full". Sorted by age so it reads in order.
 */
export function summarizeChildPolicy(
  policy: ChildPolicyBand[] | null | undefined,
): string {
  if (!Array.isArray(policy) || policy.length === 0) {
    return 'children charged full fare';
  }
  return [...policy]
    .sort((a, b) => (a.min ?? 0) - (b.min ?? 0))
    .map((b) => `${bandRange(b)} ${chargeLabel(b.chargePct ?? 100)}`)
    .join(' · ');
}

/**
 * Highest age the policy prices as a child, for the input's `max`. The band's own
 * ceiling — subtracting 1 here rejected the oldest age the owner had priced.
 */
export function maxChildAge(
  policy: ChildPolicyBand[] | null | undefined,
): number {
  if (!Array.isArray(policy) || policy.length === 0) return 17;
  const top = Math.max(...policy.map((b) => b.max ?? 0));
  return top > 0 ? Math.min(top, 120) : 17;
}
