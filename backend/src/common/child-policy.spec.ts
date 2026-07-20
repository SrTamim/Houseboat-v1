import {
  childChargeFraction,
  priceForParty,
  ChildBand,
} from './child-policy';
import { money } from './money';

const policy: ChildBand[] = [
  { min: 0, max: 3, chargePct: 0 }, // 0-3 free
  { min: 3, max: 5, chargePct: 50 }, // 3-5 half
  { min: 5, max: 99, chargePct: 100 }, // 5+ full
];

describe('childChargeFraction', () => {
  it('maps ages to their band fraction (max exclusive)', () => {
    expect(childChargeFraction(policy, 1)).toBe(0);
    expect(childChargeFraction(policy, 3)).toBe(0.5);
    expect(childChargeFraction(policy, 4)).toBe(0.5);
    expect(childChargeFraction(policy, 5)).toBe(1);
    expect(childChargeFraction(policy, 40)).toBe(1);
  });

  it('charges full when no policy or unmatched age', () => {
    expect(childChargeFraction(null, 2)).toBe(1);
    expect(childChargeFraction([], 2)).toBe(1);
    expect(childChargeFraction(policy, 200)).toBe(1); // beyond all bands
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
});
