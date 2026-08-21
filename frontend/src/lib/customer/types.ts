/**
 * Customer-facing response shapes. Hand-written to match the public endpoints in
 * backend/src/houseboats + booking + me. Kept in sync with those services (the
 * generated api-types.ts covers request bodies; these are the read models the UI
 * renders).
 */

/** One card in search / featured results (GET /houseboats/search). */
export interface SearchBoat {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** Free-text on the boat row (Prisma `String?`), not a list. */
  safetyFeatures: string | null;
  routes: { route: { name: string; region: string | null } }[];
  reviewCount: number;
  priceFrom: number | null;
  hasAc: boolean;
  hasNonAc: boolean;
  maxCapacity: number;
  cabinCount: number;
  ratingAvg: number | null;
  /**
   * Rolled-up cabin-category facilities text, used by the search Amenities
   * filter. Optional: the field is added to the search projection in a
   * follow-up step, so older responses simply omit it.
   */
  facilities?: string[];
}

/** Owner-entered meal plan (Prisma `Houseboat.foodMenu` JSON). */
export interface FoodMenu {
  breakfast?: string;
  brunch?: string;
  lunch?: string;
  snacks?: string;
  dinner?: string;
}

/** One age band of `Houseboat.childPolicy` — `chargePct` of the adult fare. */
export interface ChildPolicyBand {
  min: number;
  max: number;
  chargePct: number;
}

/** GET /houseboats/:slug — boat detail. */
export interface BoatDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** Free-text on the boat row (Prisma `String?`), not a list. */
  safetyFeatures: string | null;
  /** `{ breakfast, brunch, lunch, snacks, dinner }` — any field may be blank. */
  foodMenu: FoodMenu | null;
  childPolicy: ChildPolicyBand[] | null;
  /**
   * Boat-level gallery, already resolved to public URLs by the API
   * (StorageService.publicUrl → root-relative `/uploads/*` under the dev
   * driver). Empty when the owner has uploaded nothing.
   */
  photos: string[];
  ratingAvg: number | null;
  reviewCount: number;
  reviews: {
    id: string;
    rating: number;
    text: string | null;
    ownerReply: string | null;
    customer: { name: string | null } | null;
  }[];
  decks: {
    id: string;
    name: string;
    position: number;
    cabins: {
      id: string;
      name: string;
      gridRow: number | null;
      gridCol: number | null;
      /** Cabin gallery, same URL treatment as `photos` above. */
      photos: string[];
      /** Lowest per-person pricing rule for the cabin's category. */
      pricePerPerson: number | null;
      category: {
        name: string;
        isAc: boolean;
        baseCapacity: number;
        extendedCapacity: number | null;
        /** Free-text on the category row — a single string, not a list. */
        facilities: string | null;
      };
    }[];
  }[];
  routes: { route: { name: string; region: string | null } }[];
}

/** GET /houseboats/:slug/departures. */
export interface Departure {
  id: string;
  startDate: string;
  endDate: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
  availableCount: number;
  package: {
    durationDays: number;
    durationLabel: string | null;
    departureGhat: string | null;
    returnGhat: string | null;
    route: { name: string; region: string | null } | null;
  };
}

/** One cabin in the per-cabin availability snapshot. */
export interface CabinAvailability {
  cabinId: string;
  /**
   * `held_by_me` is a live hold owned by THIS viewer (account or hb_gid cookie),
   * `held_by_other` is someone else's live hold (temporary — it lapses in ~10
   * min), and `booked` is a genuinely sold cabin. The server draws all three
   * distinctions because the client cannot: without them the guest's own cabin
   * reads as fully booked after a reload, and a cabin someone is merely holding
   * looks permanently gone.
   */
  state: 'available' | 'booked' | 'open_seat' | 'held_by_me' | 'held_by_other';
  spare: number;
  /** Present only on `held_by_me`: the viewer's own countdown, ISO string. */
  holdExpiresAt?: string;
  /** Present only on `held_by_me`: this viewer's hold id, for release/checkout. */
  holdId?: string;
}

export interface DepartureCabins {
  departureId: string;
  availableCount: number;
  cabins: CabinAvailability[];
}

/** GET /houseboats/:slug/group-bands. */
export interface GroupBand {
  id: string;
  minPeople: number;
  maxPeople: number;
  totalPrice: string;
}

/** POST /booking/quote response. */
export interface Quote {
  perCabin: {
    cabinId: string;
    adults: number;
    children: number;
    occupancy: number;
    isOpenSeat: boolean;
    roomPrice: string;
    priced: boolean;
  }[];
  couponApplied: boolean;
  roomTotal: string;
  discountAmount: string;
  displayTotal: string;
}

/** A hold (POST /booking/hold). */
export interface Hold {
  id: string;
  expiresAt: string;
  cabinId?: string;
  departureId?: string;
}

/** One row of GET /booking (the customer's trips). */
export interface TripListItem {
  id: string;
  type: string;
  status: string;
  checkinStatus: string;
  headcount: number | null;
  referenceName: string | null;
  createdAt: string;
  invoice: {
    id: string;
    status: string;
    displayTotal: string;
    amountPaid: string;
  } | null;
  departure: {
    id: string;
    startDate: string;
    endDate: string | null;
  } | null;
}

/**
 * GET /me/invoices/:id — the payment-return poll. Money is `.toFixed(2)`'d
 * server-side here, unlike GET /booking/:id which serializes raw Decimals.
 */
export interface InvoiceView {
  id: string;
  bookingId: string;
  status: string;
  displayTotal: string;
  amountPaid: string;
  discountAmount: string;
}

/**
 * GET /booking/:id — full booking detail.
 *
 * Money arrives as a *string* (Prisma Decimal serializes that way) — but as raw
 * `toJSON()` output, so "1234.5", not "1234.50". Always render it through
 * `money()`; never do arithmetic on the raw value.
 *
 * NID is deliberately absent: `BookingGuest.nidEncrypted` is ciphertext and the
 * backend never echoes it.
 */
export interface BookingDetail {
  id: string;
  type: string;
  status: string;
  checkinStatus: string;
  referenceName: string | null;
  createdAt?: string;
  cabins: {
    id: string;
    adults: number;
    children: number;
    occupancy: number;
    roomPrice: string;
    isOpenSeat: boolean;
    cabin: {
      name: string;
      deck?: { name: string } | null;
      category?: { name: string; isAc: boolean } | null;
    } | null;
  }[];
  guests: { id: string; name: string; phone: string | null }[];
  customer?: { name: string | null; email: string | null; phone: string } | null;
  coupon?: { code: string } | null;
  /** The guest's own review, present once left (one per booking). */
  review?: {
    id: string;
    rating: number;
    text: string | null;
    ownerReply: string | null;
  } | null;
  invoice: {
    id: string;
    status: string;
    displayTotal: string;
    amountPaid: string;
    discountAmount: string;
    roomTotal?: string;
    payments?: { amount: string; method: string; paidAt: string | null }[];
  } | null;
  departure: {
    id: string;
    startDate: string;
    endDate: string | null;
    departureTime?: string | null;
    /**
     * Departure lifecycle: scheduled / in_progress / completed / cancelled.
     * `cancelled` here means the OWNER cancelled the whole departure — that is
     * how a customer's booking becomes host-cancelled (they are then entitled to
     * a refund), distinct from the customer cancelling their own booking.
     */
    status?: string;
    /** Owner-supplied reason, present when the departure was host-cancelled. */
    cancelReason?: string | null;
    package: {
      durationLabel: string | null;
      durationDays?: number;
      departureGhat?: string | null;
      returnGhat?: string | null;
      route: { name: string; region: string | null } | null;
      /** `logoUrl` is resolved server-side from the storage key (root-relative). */
      houseboat?: {
        id: string;
        name: string;
        slug: string;
        logoUrl?: string | null;
      } | null;
    } | null;
  } | null;
}

/** GET /me/credits. */
export interface WalletView {
  balance: string;
  /** Sum of credits locked against an open cash-out request (not spendable). */
  pendingCashout: string;
  /** The caller's currently-pending cash-out request, if any. */
  pendingRequest: {
    id: string;
    amount: string;
    method: string;
    createdAt: string;
  } | null;
  credits: {
    id: string;
    amount: string;
    /** open | used | pending_cashout */
    status: string;
    sourceInvoiceId: string | null;
    usedInInvoiceId: string | null;
  }[];
}

/** GET /booking/waitlist row. */
export interface WaitlistEntry {
  id: string;
  partySize: number;
  createdAt: string;
  /**
   * The specific cabin waited on. Null/absent = any cabin on the trip, which is
   * what entries created before per-cabin waitlisting mean.
   */
  cabin?: { id: string; name: string; deck: { name: string } | null } | null;
  /**
   * Has the waited-for cabin freed? For a cabin-specific row this answers about
   * that cabin; for a trip-level row it falls back to "any cabin is free".
   * Prefer this over `departure.availableCount`, which is always trip-wide.
   */
  cabinFree?: boolean;
  departure: {
    id: string;
    startDate: string;
    endDate: string | null;
    departureTime: string | null;
    availableCount: number;
    package: {
      durationLabel: string | null;
      houseboat: { name: string; slug: string };
      route: { name: string; region: string | null } | null;
    } | null;
  } | null;
}

/** GET /me/notifications row. */
export interface NotificationItem {
  id: string;
  event: string;
  channel: string;
  delivered: boolean;
  readAt: string | null;
  payload: unknown;
  at: string;
}
