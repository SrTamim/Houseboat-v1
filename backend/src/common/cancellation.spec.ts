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

    // A blackout tier applies only within its own window, not globally. Here the
    // blackout covers the last 2 days; a cancellation 10 days out falls in the
    // 5-day 50% tier and must NOT be zeroed by the near blackout.
    const scopedBlackout: PolicySnapshot = {
      template: 'custom',
      tiers: [
        { daysBefore: 5, refundPct: 50 },
        { daysBefore: 2, refundPct: 0, isBlackout: true },
      ],
    };
    expect(refundPercent(scopedBlackout, 10)).toBe(50); // in the 50% window
    expect(refundPercent(scopedBlackout, 1)).toBe(0); // inside the blackout
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

  it('daysUntil counts calendar days in Asia/Dhaka, not raw UTC', () => {
    // Departure stored at UTC midnight (@db.Date), the day AFTER the local "now".
    // In Dhaka (UTC+6) a customer cancelling late on the 9th, local time, for a
    // trip on the 10th is 1 day out. Raw UTC math measured < 24h and returned 0,
    // dropping them a tier. Local-calendar math returns 1.
    const departure = new Date('2026-03-10T00:00:00.000Z'); // 10 Mar, 06:00 Dhaka
    const nowLate9thDhaka = new Date('2026-03-09T20:00:00.000Z'); // 10 Mar 02:00 Dhaka
    // Both are "10 March" in Dhaka local time → 0 days.
    expect(daysUntil(departure, nowLate9thDhaka)).toBe(0);
    // Early on the 9th Dhaka time (03:00) → departure is the next calendar day → 1.
    const nowEarly9thDhaka = new Date('2026-03-08T21:00:00.000Z'); // 9 Mar 03:00 Dhaka
    expect(daysUntil(departure, nowEarly9thDhaka)).toBe(1);
  });
});
