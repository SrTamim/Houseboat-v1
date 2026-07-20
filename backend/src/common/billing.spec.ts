import { buildBill, dueToBoat } from './billing';
import { money } from './money';

describe('buildBill — plan §1 worked example', () => {
  // Room 10,000 + 1.8% gateway = 10,180 shown; 10% coupon = 9,162 paid;
  // received 8,982; commission 5% of 10,000 = 500; boat gets 8,482.
  const bill = buildBill({
    roomTotal: money(10000),
    gatewayFeePct: money(1.8),
    commissionPct: money(5),
    coupon: { kind: 'percent', value: money(10) },
  });

  it('gateway fee is % of room_total', () => {
    expect(bill.gatewayFee.toFixed(2)).toBe('180.00');
  });

  it('price_shown = room_total + gateway_fee', () => {
    expect(bill.priceShown.toFixed(2)).toBe('10180.00');
  });

  it('discount applies to price_shown', () => {
    expect(bill.discountAmount.toFixed(2)).toBe('1018.00');
  });

  it('display_total = price_shown - discount (customer pays)', () => {
    expect(bill.displayTotal.toFixed(2)).toBe('9162.00');
  });

  it('commission is % of ORIGINAL room_total, not discounted', () => {
    expect(bill.commission.toFixed(2)).toBe('500.00');
  });

  it('boat receives amount_received - commission', () => {
    // platform receives price_shown - gateway_fee - discount = 8,982
    const received = money(8982);
    expect(dueToBoat(received, bill.commission).toFixed(2)).toBe('8482.00');
  });
});

describe('buildBill — no coupon, no commission', () => {
  it('display_total equals price_shown', () => {
    const b = buildBill({
      roomTotal: money(5000),
      gatewayFeePct: money(0),
      commissionPct: null,
    });
    expect(b.displayTotal.toFixed(2)).toBe('5000.00');
    expect(b.commission.toFixed(2)).toBe('0.00');
  });
});

describe('buildBill — flat coupon capped at price', () => {
  it('never discounts below zero', () => {
    const b = buildBill({
      roomTotal: money(1000),
      gatewayFeePct: money(0),
      commissionPct: money(5),
      coupon: { kind: 'flat', value: money(5000) },
    });
    expect(b.displayTotal.toFixed(2)).toBe('0.00');
    expect(b.discountAmount.toFixed(2)).toBe('1000.00');
  });
});
