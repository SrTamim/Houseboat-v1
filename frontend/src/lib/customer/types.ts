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
  safetyFeatures: string[];
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

/** GET /houseboats/:slug — boat detail. */
export interface BoatDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  safetyFeatures: string[];
  foodMenu: unknown;
  childPolicy: unknown;
  decks: {
    id: string;
    name: string;
    position: number;
    cabins: {
      id: string;
      name: string;
      gridRow: number | null;
      gridCol: number | null;
      category: {
        name: string;
        isAc: boolean;
        baseCapacity: number;
        facilities: string[];
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
  state: 'available' | 'booked' | 'open_seat';
  spare: number;
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

/** GET /booking/:id — full booking detail. */
export interface BookingDetail {
  id: string;
  type: string;
  status: string;
  checkinStatus: string;
  referenceName: string | null;
  cabins: {
    id: string;
    adults: number;
    children: number;
    occupancy: number;
    roomPrice: string;
    isOpenSeat: boolean;
    cabin: { name: string } | null;
  }[];
  guests: { id: string; name: string; phone: string | null }[];
  invoice: {
    id: string;
    status: string;
    displayTotal: string;
    amountPaid: string;
    discountAmount: string;
  } | null;
  departure: {
    id: string;
    startDate: string;
    endDate: string | null;
    package: {
      durationLabel: string | null;
      route: { name: string; region: string | null } | null;
    } | null;
  } | null;
}

/** GET /me/credits. */
export interface WalletView {
  balance: string;
  credits: {
    id: string;
    amount: string;
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
  departure: {
    id: string;
    startDate: string;
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
