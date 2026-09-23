import {
  childChargeFraction,
  priceForParty,
  ChildBand,
} from './child-policy';
import { money } from './money';

/**
 * Contiguous bands, entered the way owners actually enter them — the editor asks
 * for "Age from" and "Age to", so every age from 0 to 99 belongs to exactly one
 * band and no number is shared between two.
 */
const policy: ChildBand[] = [
  { min: 0, max: 3, chargePct: 0 }, // 0,1,2,3 free
  { min: 4, max: 5, chargePct: 50 }, // 4,5 half
  { min: 6, max: 99, chargePct: 100 }, // 6+ full
];

describe('childChargeFraction', () => {
  it('maps ages to their band fraction (both bounds INCLUSIVE)', () => {
    expect(childChargeFraction(policy, 0)).toBe(0);
    expect(childChargeFraction(policy, 1)).toBe(0);
    expect(childChargeFraction(policy, 2)).toBe(0);
    expect(childChargeFraction(policy, 4)).toBe(0.5);
    expect(childChargeFraction(policy, 6)).toBe(1);
    expect(childChargeFraction(policy, 40)).toBe(1);
  });

  it('includes the TOP age of every band', () => {
    // The regression: treating max as exclusive dropped each band's last age into
    // the "no band" default, so a 3-year-old was billed full fare and the age was
    // reported as having no rate at all.
    expect(childChargeFraction(policy, 3)).toBe(0); // top of 0-3
    expect(childChargeFraction(policy, 5)).toBe(0.5); // top of 4-5
    expect(childChargeFraction(policy, 99)).toBe(1); // top of 6-99
  });

  it('charges full when no policy or unmatched age', () => {
    expect(childChargeFraction(null, 2)).toBe(1);
    expect(childChargeFraction([], 2)).toBe(1);
    expect(childChargeFraction(policy, 200)).toBe(1); // beyond all bands
  });

  it('charges full for an age in a genuine policy gap', () => {
    // A real seeded boat has 0-5 then 12-120 and nothing between: that gap is the
    // owner's own omission, so full fare (and the UI's warning) is correct.
    const gapped: ChildBand[] = [
      { min: 0, max: 5, chargePct: 0 },
      { min: 12, max: 120, chargePct: 100 },
    ];
    expect(childChargeFraction(gapped, 5)).toBe(0); // inclusive top
    expect(childChargeFraction(gapped, 8)).toBe(1); // real gap → full
    expect(childChargeFraction(gapped, 12)).toBe(1);
  });
});

describe('priceForParty', () => {
  const perPerson = money(5000);

  it('adults full + children per age band', () => {
    // 2 adults (10,000) + child age 2 (free) + child age 4 (2,500) = 12,500
    const total = priceForParty({
      pricePerPerson: perPerson,
      adults: 2,
      children: 2,
      childAges: [2, 4],
      childPolicy: policy,
    });
    expect(total.toFixed(2)).toBe('12500.00');
  });

  it('charges children full when ages are not supplied', () => {
    // 2 adults + 1 child, no ages → 3 × 5,000 = 15,000
    const total = priceForParty({
      pricePerPerson: perPerson,
      adults: 2,
      children: 1,
      childPolicy: policy,
    });
    expect(total.toFixed(2)).toBe('15000.00');
  });

  it('charges full with no policy even when ages given', () => {
    const total = priceForParty({
      pricePerPerson: perPerson,
      adults: 1,
      children: 1,
      childAges: [1],
      childPolicy: null,
    });
    expect(total.toFixed(2)).toBe('10000.00');
  });

  it('children beyond supplied ages are charged full', () => {
    // 1 adult (5,000) + age 2 (free) + 1 extra unlisted child (5,000) = 10,000
    const total = priceForParty({
      pricePerPerson: perPerson,
      adults: 1,
      children: 2,
      childAges: [2],
      childPolicy: policy,
    });
    expect(total.toFixed(2)).toBe('10000.00');
  });

  it('ignores childAges beyond the children count (M-M2 backstop)', () => {
    // 1 adult (5,000) + 1 child, but 3 ages sent → only the FIRST age (2, free)
    // is priced; the extra ages must NOT add charge. Total = 5,000.
    const total = priceForParty({
      pricePerPerson: perPerson,
      adults: 1,
      children: 1,
      childAges: [2, 2, 2],
      childPolicy: policy,
    });
    expect(total.toFixed(2)).toBe('5000.00');
  });
});
