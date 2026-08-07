import { buildBill, dueToBoat } from './billing';
import { money } from './money';

describe('buildBill — worked example (no gateway fee)', () => {
  // Gateway fee removed platform-wide: room 10,000 shown as-is; 10% coupon =
  // 1,000 discount → 9,000 paid; received 9,000; commission 5% of 10,000 = 500;
  // boat gets 8,500.
  const bill = buildBill({
    roomTotal: money(10000),
    commissionPct: money(5),
    coupon: { kind: 'percent', value: money(10) },
  });

  it('gateway fee is always 0', () => {
    expect(bill.gatewayFee.toFixed(2)).toBe('0.00');
  });

  it('price_shown = room_total (no fee added)', () => {
    expect(bill.priceShown.toFixed(2)).toBe('10000.00');
  });

  it('discount applies to room_total', () => {
    expect(bill.discountAmount.toFixed(2)).toBe('1000.00');
  });

  it('display_total = price_shown - discount (customer pays)', () => {
    expect(bill.displayTotal.toFixed(2)).toBe('9000.00');
  });

  it('commission is % of ORIGINAL room_total, not discounted', () => {
    expect(bill.commission.toFixed(2)).toBe('500.00');
  });

  it('boat receives amount_received - commission', () => {
    // platform receives display_total = 9,000 (no gateway fee to net out)
    const received = money(9000);
    expect(dueToBoat(received, bill.commission).toFixed(2)).toBe('8500.00');
  });
});

describe('buildBill — no coupon, no commission', () => {
  it('display_total equals room_total', () => {
    const b = buildBill({
      roomTotal: money(5000),
      commissionPct: null,
    });
    expect(b.displayTotal.toFixed(2)).toBe('5000.00');
    expect(b.priceShown.toFixed(2)).toBe('5000.00');
    expect(b.gatewayFee.toFixed(2)).toBe('0.00');
    expect(b.commission.toFixed(2)).toBe('0.00');
  });
});

describe('buildBill — flat coupon capped at price', () => {
  it('never discounts below zero', () => {
    const b = buildBill({
      roomTotal: money(1000),
      commissionPct: money(5),
      coupon: { kind: 'flat', value: money(5000) },
    });
    expect(b.displayTotal.toFixed(2)).toBe('0.00');
    expect(b.discountAmount.toFixed(2)).toBe('1000.00');
  });
});

describe('buildBill — owner discount', () => {
  it('deducts the owner discount from display_total', () => {
    const b = buildBill({
      roomTotal: money(10000),
      commissionPct: money(5),
      ownerDiscount: money(1500),
    });
    expect(b.discountAmount.toFixed(2)).toBe('1500.00');
    expect(b.displayTotal.toFixed(2)).toBe('8500.00');
    // Commission is still off the ORIGINAL room total — boat absorbs it.
    expect(b.commission.toFixed(2)).toBe('500.00');
  });

  it('stacks on top of a coupon', () => {
    const b = buildBill({
      roomTotal: money(10000),
      commissionPct: money(5),
      coupon: { kind: 'percent', value: money(10) }, // 1,000
      ownerDiscount: money(500),
    });
    expect(b.discountAmount.toFixed(2)).toBe('1500.00');
    expect(b.displayTotal.toFixed(2)).toBe('8500.00');
    expect(b.commission.toFixed(2)).toBe('500.00');
  });

  it('coupon + owner discount together cannot exceed price shown', () => {
    const b = buildBill({
      roomTotal: money(1000),
      commissionPct: null,
      coupon: { kind: 'flat', value: money(800) },
      ownerDiscount: money(800),
    });
    expect(b.discountAmount.toFixed(2)).toBe('1000.00');
    expect(b.displayTotal.toFixed(2)).toBe('0.00');
  });

  it('is a no-op when null/absent (coupon-only path unchanged)', () => {
    const withNull = buildBill({
      roomTotal: money(5000),
      commissionPct: money(5),
      ownerDiscount: null,
    });
    const without = buildBill({ roomTotal: money(5000), commissionPct: money(5) });
    expect(withNull.displayTotal.toFixed(2)).toBe(without.displayTotal.toFixed(2));
    expect(withNull.displayTotal.toFixed(2)).toBe('5000.00');
  });
});
