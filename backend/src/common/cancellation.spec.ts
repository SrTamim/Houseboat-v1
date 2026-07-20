import {
  refundPercent,
  refundAmount,
  daysUntil,
  PolicySnapshot,
} from './cancellation';
import { money } from './money';

describe('cancellation refund policy (plan §4 Path B)', () => {
  it('flexible: full refund up to 1 day before, none same-day', () => {
    const p: PolicySnapshot = { template: 'flexible' };
    expect(refundPercent(p, 5)).toBe(100);
    expect(refundPercent(p, 1)).toBe(100);
    expect(refundPercent(p, 0)).toBe(0);
  });

  it('moderate: 100/50/0 tiers', () => {
    const p: PolicySnapshot = { template: 'moderate' };
    expect(refundPercent(p, 10)).toBe(100);
    expect(refundPercent(p, 5)).toBe(50);
    expect(refundPercent(p, 2)).toBe(0);
  });

  it('strict: 50% up to 14 days, else none', () => {
    const p: PolicySnapshot = { template: 'strict' };
    expect(refundPercent(p, 20)).toBe(50);
    expect(refundPercent(p, 10)).toBe(0);
  });

  it('non_refundable and null → 0', () => {
    expect(refundPercent({ template: 'non_refundable' }, 30)).toBe(0);
    expect(refundPercent(null, 30)).toBe(0);
  });

  it('custom tiers apply; a blackout tier forces 0', () => {
    const custom: PolicySnapshot = {
      template: 'custom',
      tiers: [
        { daysBefore: 7, refundPct: 80 },
        { daysBefore: 2, refundPct: 30 },
      ],
    };
    expect(refundPercent(custom, 10)).toBe(80);
    expect(refundPercent(custom, 3)).toBe(30);

    const blackout: PolicySnapshot = {
      template: 'custom',
      tiers: [{ daysBefore: 7, refundPct: 100, isBlackout: true }],
    };
    expect(refundPercent(blackout, 30)).toBe(0);
  });

  it('refundAmount = pct of amount_paid', () => {
    expect(refundAmount(money(10000), 50).toFixed(2)).toBe('5000.00');
    expect(refundAmount(money(10000), 0).toFixed(2)).toBe('0.00');
  });

  it('daysUntil never negative', () => {
    const past = new Date(Date.now() - 5 * 86400_000);
    expect(daysUntil(past)).toBe(0);
    const future = new Date(Date.now() + 3 * 86400_000 + 60_000);
    expect(daysUntil(future)).toBe(3);
  });
});
