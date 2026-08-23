/**
 * Booking business limits.
 *
 * Kept in their own module so DTOs can import them without pulling in
 * HoldsService (and with it Prisma, Redis and the realtime gateway) just to
 * read a number.
 */

/**
 * Cabins one self-service booking may hold at once.
 *
 * Caps how much inventory a single visitor — including an anonymous one — can
 * lock, and keeps a customer-sized booking distinct from a whole-boat buyout.
 *
 * Enforced on the customer hold route (HoldsService, at hold time, so inventory
 * is never locked beyond the cap) and again on the customer CheckoutDto as a
 * backstop. Owner POS is deliberately uncapped: counter staff sell arbitrarily
 * many cabins in one transaction.
 */
export const MAX_CABINS_PER_BOOKING = 4;

/**
 * Children one cabin may carry, on top of its adults.
 *
 * Children share their parents' berths, so a family is allowed past the rated
 * bed count — a 2-berth cabin can take 2 adults + several children. This caps
 * how far that goes, so "ignore capacity" cannot mean "unlimited".
 *
 * Enforced on the customer DTOs (quote + checkout). Owner POS is deliberately
 * uncapped for the same reason it is uncapped on cabins: counter staff squeeze in
 * real walk-ups and already pass allowOverCapacity.
 */
export const MAX_CHILDREN_PER_CABIN = 4;
