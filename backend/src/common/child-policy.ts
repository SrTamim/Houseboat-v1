import { Money, money, round2, ZERO, add } from './money';

/**
 * Child pricing (plan §pricing + houseboat.child_policy). Age bands charge a
 * fraction of the per-person price, e.g. [{min:0,max:3,chargePct:0},
 * {min:3,max:5,chargePct:50},{min:5,max:99,chargePct:100}] = 0-3 free, 3-5 half,
 * 5+ full. A child whose age matches no band is charged full (safe default).
 */
export interface ChildBand {
  min?: number;
  max?: number;
  chargePct?: number;
}

/** Charge fraction (0..1) for a child of the given age under this policy. */
export function childChargeFraction(
  policy: ChildBand[] | null | undefined,
  age: number,
): number {
  if (!Array.isArray(policy) || policy.length === 0) return 1; // no policy → full
  // First band whose [min,max) contains the age. max is exclusive.
  const band = policy.find(
    (b) => age >= (b.min ?? 0) && age < (b.max ?? Infinity),
  );
  if (!band) return 1; // unmatched age → full charge
  return Math.max(0, Math.min(100, band.chargePct ?? 100)) / 100;
}

/**
 * Room price for a party: adults at full per-person price, each child at its
 * age-band fraction. When childAges aren't supplied, children are charged full
 * (occupancy-based fallback — preserves prior behavior).
 */
export function priceForParty(params: {
  pricePerPerson: Money;
  adults: number;
  children: number;
  childAges?: number[];
  childPolicy?: ChildBand[] | null;
}): Money {
  const perPerson = params.pricePerPerson;
  let total = round2(perPerson.mul(params.adults));

  if (params.childAges && params.childAges.length > 0) {
    for (const age of params.childAges) {
      const frac = childChargeFraction(params.childPolicy, age);
      total = add(total, round2(perPerson.mul(money(frac))));
    }
    // Any children beyond the supplied ages are charged full.
    const extra = Math.max(0, params.children - params.childAges.length);
    if (extra > 0) total = add(total, round2(perPerson.mul(extra)));
  } else {
    // No ages → full charge per child (previous behavior).
    total = add(total, round2(perPerson.mul(params.children)));
  }
  return total;
}
