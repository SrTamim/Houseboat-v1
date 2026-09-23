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

/**
 * Minimum deposit, as a percent of the bill's display total, required to turn a
 * priced checkout into a confirmed booking (audit M-H2).
 *
 * The customer UI offers a 50% advance or 100% full payment; this is the
 * server-side floor that makes that real — the client value is no longer
 * trusted, so a hand-crafted "pay ৳1" request is rejected. A booking is created
 * only once a payment of at least this share of the total is confirmed; until
 * then the cabins are reserved solely by their live holds.
 */
export const MIN_DEPOSIT_PCT = 50;
