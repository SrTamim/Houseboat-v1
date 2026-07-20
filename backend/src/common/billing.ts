import { Money, money, ZERO, add, sub, percentOf, round2, nonNegative } from './money';

/**
 * The invoice bill order — plan/houseboat_logic.md §1 "Building the bill".
 * This is the single source of truth for how a booking becomes money.
 * Order is FIXED and must not change:
 *
 *   1 room_total     = owner-set room price (sum of booking_cabin.room_price)
 *   2 gateway_fee    = platform % of room_total, added on top
 *   3 price_shown    = room_total + gateway_fee        (customer sees this)
 *   4 discount       = coupon applied LAST, to price_shown
 *   5 display_total  = price_shown - discount          (customer pays this)
 *   6 commission     = platform % of ROOM_TOTAL (original, NOT discounted)
 *   7 due_to_boat    = amount_received - commission
 *
 * The boat absorbs the full cost of its own coupon — commission is unaffected
 * by discounts. See the worked example in the plan.
 */

export interface CouponInput {
  kind: 'percent' | 'flat' | 'referral';
  value: Money; // percent (e.g. 10) for 'percent'; taka amount for 'flat'
}

export interface BillInput {
  /** Sum of owner-set room prices for the chosen headcount(s). */
  roomTotal: Money;
  /** Platform gateway fee percent (whole number, e.g. 1.8). */
  gatewayFeePct: Money;
  /** Platform commission percent (whole number, e.g. 5). null = not on commission. */
  commissionPct: Money | null;
  /** Optional coupon. Referral coupons are recorded but do not discount here. */
  coupon?: CouponInput | null;
}

export interface Bill {
  roomTotal: Money;
  gatewayFee: Money;
  priceShown: Money;
  discountAmount: Money;
  displayTotal: Money;
  commission: Money;
}

function couponDiscount(priceShown: Money, coupon?: CouponInput | null): Money {
  if (!coupon) return ZERO;
  if (coupon.kind === 'percent') {
    return percentOf(priceShown, coupon.value);
  }
  if (coupon.kind === 'flat') {
    // A flat coupon can't exceed the price shown.
    return round2(coupon.value.greaterThan(priceShown) ? priceShown : coupon.value);
  }
  // referral — recorded on the booking, no price effect at bill time.
  return ZERO;
}

export function buildBill(input: BillInput): Bill {
  const roomTotal = round2(input.roomTotal);
  const gatewayFee = percentOf(roomTotal, input.gatewayFeePct); // step 2
  const priceShown = add(roomTotal, gatewayFee); // step 3
  const discountAmount = couponDiscount(priceShown, input.coupon); // step 4
  const displayTotal = nonNegative(sub(priceShown, discountAmount)); // step 5
  const commission = input.commissionPct // step 6 — off ROOM_TOTAL
    ? percentOf(roomTotal, input.commissionPct)
    : ZERO;

  return {
    roomTotal,
    gatewayFee,
    priceShown,
    discountAmount,
    displayTotal,
    commission,
  };
}

/**
 * Step 7 — computed at settlement, not at booking, because it depends on what
 * was actually received (cash never entered the platform account).
 * due_to_boat = amount_received - commission
 */
export function dueToBoat(amountReceived: Money, commission: Money): Money {
  return sub(amountReceived, commission); // SIGNED — can be negative
}

/** Deposit amount from a policy deposit percent applied to display_total. */
export function depositAmount(displayTotal: Money, depositPct: number): Money {
  return percentOf(displayTotal, money(depositPct));
}
