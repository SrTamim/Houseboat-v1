import { Prisma } from '@prisma/client';

/**
 * Money helpers. All amounts are Prisma.Decimal (maps to Postgres numeric(12,2)).
 * NEVER use JS number for money — floating point rounds wrong on currency.
 *
 * Bangladeshi Taka has no minor unit in common use here; we still keep 2 dp
 * because gateway fees and percentages produce fractions that must round
 * deterministically. Rounding mode: half-up, to 2 dp, everywhere.
 */

export type Money = Prisma.Decimal;
export const D = Prisma.Decimal;

/** Build a Decimal from anything. */
export const money = (v: Prisma.Decimal.Value): Money => new Prisma.Decimal(v);

export const ZERO = money(0);

/** Round to 2 decimal places, half-up. Apply after every multiply/percent. */
export const round2 = (v: Money): Money =>
  v.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

/** percentOf(1000, 5) => 50.00 . pct is a whole-number percent (5 = 5%). */
export const percentOf = (base: Money, pct: Prisma.Decimal.Value): Money =>
  round2(base.mul(money(pct)).div(100));

export const add = (a: Money, b: Money): Money => round2(a.add(b));
export const sub = (a: Money, b: Money): Money => round2(a.sub(b));

/** Clamp to >= 0 — invoices and dues never go negative on the customer side. */
export const nonNegative = (v: Money): Money => (v.isNegative() ? ZERO : v);

export const isNegative = (v: Money): boolean => v.isNegative();
export const eq = (a: Money, b: Money): boolean => a.equals(b);
export const gt = (a: Money, b: Money): boolean => a.greaterThan(b);
export const gte = (a: Money, b: Money): boolean => a.greaterThanOrEqualTo(b);
