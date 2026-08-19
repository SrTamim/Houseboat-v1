'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useDepartureAvailability } from '@/lib/owner/useDepartureAvailability';
import { money, apiErrorMessage } from '@/lib/owner/format';
import { BoatMap, type BoatMapCabin } from '@/components/customer/BoatMap';
import {
  CabinInfoModal,
  type CabinInfo,
  type InfoTab,
} from '@/components/customer/CabinInfoModal';
import { PhotoLightbox } from '@/components/customer/PhotoLightbox';
import { useAuthModal } from '@/components/customer/AuthModalProvider';
import { PRIMARY_BTN } from '@/lib/customer/boat-card';
import { useHoldHeartbeat } from '@/lib/customer/useHoldHeartbeat';
import {
  chargeForAge,
  chargeLabel,
  maxChildAge,
  summarizeChildPolicy,
} from '@/lib/customer/child-policy';
import type {
  BoatDetail,
  Departure,
  DepartureCabins,
  GroupBand,
  Hold,
  Quote,
} from '@/lib/customer/types';

/**
 * Cabin selection, group buyout and the live price summary
 * (design: haorboat-boat.html markup 578–668, behaviour 776–1087).
 *
 * The preview computed its own totals (`NIGHTS * price * units` plus a 7%
 * fee). That math is fiction: the server owns pricing, so every figure in the
 * summary comes from `POST /booking/quote` and the only client-side arithmetic
 * is counting heads. The layout, wording and states are the preview's.
 *
 * Rebuilt in Tailwind — no legacy `customer.css` class names.
 */

interface Cabin {
  id: string;
  name: string;
  deck: string;
  isAc: boolean;
  capacity: number;
  facilities: string | null;
  pricePerPerson: number | null;
  photos: string[];
}

interface Pax {
  adults: number;
  children: number;
  childAges: number[];
}

/** sessionStorage key the checkout page reads to restore the selection. */
const SELECTION_KEY = 'hb-selection';

/**
 * Cabins one self-service booking may hold. Mirrors MAX_CABINS_PER_BOOKING in
 * backend/src/booking/booking.limits.ts — the server is the authority; this copy
 * only keeps the UI from offering something it will refuse.
 */
const MAX_CABINS_PER_BOOKING = 4;

/**
 * Children one cabin may carry on top of its adults. Mirrors
 * MAX_CHILDREN_PER_CABIN in backend/src/booking/booking.limits.ts — the customer
 * DTOs are the authority; this copy only stops the stepper offering a 5th.
 */
const MAX_CHILDREN_PER_CABIN = 4;


/**
 * The cart handed to checkout through sessionStorage.
 *
 * Everything optional below is presentation the checkout summary needs and
 * cannot derive: departure facts, the boat photo, and the quote's per-cabin
 * lines. Optional rather than required on purpose — a selection written by an
 * older build (a guest mid-funnel across a deploy) simply lacks them, and
 * checkout falls back to the boat name and grand total instead of crashing.
 *
 * The fields checkout actually POSTs — departureId, cabins[].holdId, adults,
 * children, childAges, groupHeadcount, displayTotal — are all required and
 * unchanged.
 */
export interface StoredSelection {
  slug: string;
  boatName: string;
  departureId: string;
  kind: 'cabin' | 'group';
  cabins: {
    cabinId: string;
    cabinName: string;
    adults: number;
    children: number;
    childAges: number[];
    /**
     * The hold the boat page already took for this cabin. Checkout reuses it
     * instead of holding again — a second hold on the same cabin+departure trips
     * the partial unique index and would fail as "that cabin was just taken",
     * against the customer's own hold.
     */
    holdId?: string;
    /** Deck name, for the cabin line's "Upper deck · 2A+1C" sub-label. */
    deck?: string;
    /** This cabin's share of the quote, so checkout shows a price per line. */
    roomPrice?: string;
  }[];
  groupHeadcount?: number;
  displayTotal: string;
  /**
   * Departure facts for the checkout summary, straight off the departure the
   * guest picked. Not re-fetched there: the boat page already has them.
   */
  trip?: {
    startDate: string;
    endDate: string | null;
    departureTime: string | null;
    durationDays: number;
    durationLabel: string | null;
    departureGhat: string | null;
    routeName: string | null;
    routeRegion: string | null;
  };
  /** First gallery photo (a real upload when the owner has one). */
  boatPhoto?: string;
  ratingAvg?: number | null;
  /** Quote breakdown, so checkout can show subtotal and discount rows. */
  roomTotal?: string;
  discountAmount?: string;
}

const CARD =
  'mb-[22px] rounded-2xl border border-hair bg-raise-1 p-6 shadow-e1 dark:border-[color-mix(in_srgb,var(--blue)_12%,var(--hair))] dark:bg-[linear-gradient(160deg,color-mix(in_srgb,var(--blue)_8%,var(--raise-1)),var(--raise-1)_62%)]';
const SECTION_H2 = 'mb-3.5 font-display text-xl font-semibold text-ink';
const CHIP =
  'inline-flex items-center gap-1.5 rounded-md border border-hair bg-chip px-2 py-[3px] text-[11.5px] font-semibold text-bodytext';
const TAB_BTN =
  'inline-flex items-center gap-1.5 rounded-full border border-hair bg-raise-1 px-3.5 py-[7px] text-[12.5px] font-bold text-bodytext shadow-e1 transition-all duration-150 hover:-translate-y-px hover:border-blue hover:text-blue';

export function BoatBooking({
  slug,
  boat,
  departures,
  bands,
  initialAvailability,
  isSignedIn,
  boatPhotos,
}: {
  slug: string;
  boat: BoatDetail;
  departures: Departure[];
  bands: GroupBand[];
  initialAvailability: DepartureCabins | null;
  isSignedIn: boolean;
  /** Boat gallery already resolved by the server shell (real uploads + padding). */
  boatPhotos: string[];
}) {
  const router = useRouter();
  const { openAuth } = useAuthModal();

  const [departureId, setDepartureId] = useState(departures[0]?.id ?? '');
  const departure = departures.find((d) => d.id === departureId) ?? null;

  const cabins: Cabin[] = useMemo(
    () =>
      boat.decks.flatMap((d) =>
        d.cabins.map((c) => ({
          id: c.id,
          name: c.name,
          deck: d.name,
          isAc: c.category.isAc,
          capacity: c.category.baseCapacity,
          facilities: c.category.facilities,
          pricePerPerson: c.pricePerPerson,
          photos: c.photos,
        })),
      ),
    [boat],
  );

  // Availability for the chosen departure. Seeded from the server render, then
  // refetched whenever the customer picks a different date.
  const [availability, setAvailability] = useState(initialAvailability);
  /** Re-read per-cabin availability — after a lost race, or on date change. */
  const refreshAvailability = useCallback(async () => {
    if (!departureId) return;
    try {
      const { data } = await api.get<DepartureCabins>(
        `/houseboats/${slug}/departures/${departureId}/cabins`,
      );
      setAvailability(data);
    } catch {
      /* keep the last known snapshot rather than blanking the page */
    }
  }, [departureId, slug]);

  useEffect(() => {
    if (!departureId) return;
    if (departureId === initialAvailability?.departureId) {
      setAvailability(initialAvailability);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<DepartureCabins>(
          `/houseboats/${slug}/departures/${departureId}/cabins`,
        );
        if (!cancelled) setAvailability(data);
      } catch {
        if (!cancelled) setAvailability(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [departureId, slug, initialAvailability]);

  const availByCabin = useMemo(() => {
    const m = new Map<string, { state: string; spare: number }>();
    availability?.cabins.forEach((c) =>
      m.set(c.cabinId, { state: c.state, spare: c.spare }),
    );
    return m;
  }, [availability]);

  // The boat's child bands, rendered once: "0–3 free · 5–10 50% · 12+ full".
  // Upper bounds are exclusive in the data, so the helper shows them inclusive.
  const childPolicyText = useMemo(
    () => summarizeChildPolicy(boat.childPolicy),
    [boat.childPolicy],
  );
  const childAgeMax = useMemo(() => maxChildAge(boat.childPolicy), [boat.childPolicy]);

  const [pax, setPax] = useState<Record<string, Pax>>({});
  const [group, setGroup] = useState<{
    bandId: string;
    adults: number;
    children: number;
    share: boolean;
  } | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  /** Why the last quote failed, so a missing price is never unexplained. */
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [waitlisted, setWaitlisted] = useState<Record<string, boolean>>({});

  // ---- real cabin holds --------------------------------------------------
  // cabinId → holdId for every cabin this browser currently locks server-side.
  // A ref shadows the state so unmount/pagehide cleanup can read the live value
  // without stale-closure surprises.
  const [holds, setHolds] = useState<Record<string, string>>({});
  const holdsRef = useRef<Record<string, string>>({});
  holdsRef.current = holds;
  const [holdError, setHoldError] = useState<Record<string, string>>({});
  /** Server-issued expiry shared by every hold in this cart. */
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null);
  /**
   * Cabins with a hold request in flight. Two requests for the same cabin would
   * trip the partial unique index and return 409 about our OWN hold, so the
   * second is dropped here instead. A ref, not state: the guard must be visible
   * to the very next click, before any re-render.
   */
  const holdInFlight = useRef<Set<string>>(new Set());
  /**
   * The same set again, as state this time, because the ref cannot drive
   * rendering — and a cabin we are *about* to own has to look owned immediately.
   *
   * The server emits the `held` socket event before its HTTP response finishes
   * unwinding (holds.service.ts), and that event is broadcast to the holder too.
   * It therefore beats our own POST by ~200ms, during which `live.held` knows
   * about the cabin but `holds` does not — which rendered the guest's own pick
   * as "Fully booked" for a visible flash. Marking it pending closes that gap.
   *
   * Kept alongside the ref rather than replacing it: the ref is read
   * synchronously before the await (StrictMode double-invokes the handler), and
   * state would not be readable in time to stop the duplicate POST.
   */
  const [pendingHolds, setPendingHolds] = useState<Set<string>>(new Set());

  const takeHold = useCallback(
    async (cabinId: string) => {
      if (!departure) return;
      if (holdInFlight.current.has(cabinId)) return;
      holdInFlight.current.add(cabinId);
      // New Set, not a mutation: same reference = no re-render.
      setPendingHolds((s) => new Set(s).add(cabinId));
      try {
        const { data } = await api.post<Hold>('/booking/hold', {
          cabinId,
          departureId: departure.id,
        });
        setHolds((h) => ({ ...h, [cabinId]: data.id }));
        // Every hold in a cart shares one countdown; the server returns the
        // current expiry each time, so the newest response is authoritative.
        setHoldExpiresAt(data.expiresAt);
        setHoldError((e) => {
          const { [cabinId]: _drop, ...rest } = e;
          return rest;
        });
      } catch (err) {
        // Show why on this cabin and leave every count alone — the guest's
        // typing is never erased by a failed request. A real 409 means someone
        // else got there first, so re-read availability to grey the cabin out;
        // any other failure (offline, 500) leaves the grid as it was.
        const status = (err as { response?: { status?: number } })?.response?.status;
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? 'Could not hold that cabin — please try again.';
        setHoldError((e) => ({ ...e, [cabinId]: msg }));
        if (status === 409) void refreshAvailability();
      } finally {
        // Both, always together, so the two views of "in flight" cannot drift.
        // Runs on success AND failure: a hold that lost the race stops counting
        // as ours and the cabin correctly falls back to booked.
        holdInFlight.current.delete(cabinId);
        setPendingHolds((s) => {
          if (!s.has(cabinId)) return s;
          const next = new Set(s);
          next.delete(cabinId);
          return next;
        });
      }
    },
    [departure, refreshAvailability],
  );

  const dropHold = useCallback(async (cabinId: string) => {
    const holdId = holdsRef.current[cabinId];
    if (!holdId) return;
    // Derive the remaining cart here rather than inside the updater: updaters
    // must stay pure, and the countdown has to be cleared alongside the holds.
    const { [cabinId]: _drop, ...rest } = holdsRef.current;
    holdsRef.current = rest;
    setHolds(rest);
    // Last cabin deselected — the cart is empty, so stop the timer instead of
    // letting it run down to the "your hold expired" banner. That message is for
    // a genuine lapse, not for someone who deselected on purpose.
    if (Object.keys(rest).length === 0) setHoldExpiresAt(null);
    try {
      await api.post(`/booking/hold/${holdId}/release`);
    } catch {
      // Already gone or expired — the sweeper will reconcile.
    }
  }, []);

  /** Release everything this browser holds (departure change, group pick, unmount). */
  const releaseAllHolds = useCallback(() => {
    const current = holdsRef.current;
    holdsRef.current = {};
    setHolds({});
    setHoldExpiresAt(null);
    Object.values(current).forEach((holdId) => {
      void api.post(`/booking/hold/${holdId}/release`).catch(() => {});
    });
  }, []);

  const [infoFor, setInfoFor] = useState<{
    cabin: CabinInfo | null;
    tab: InfoTab;
  } | null>(null);
  const [photosFor, setPhotosFor] = useState<{
    photos: string[];
    title: string;
  } | null>(null);

  const selectedCabins = useMemo(
    () =>
      cabins.filter((c) => {
        const p = pax[c.id];
        return p && p.adults + p.children > 0;
      }),
    [cabins, pax],
  );

  /**
   * A selected cabin has children whose ages are not all filled in yet. The
   * server prices each child from its age, so quoting now would show a total
   * that changes as soon as the guest finishes typing.
   */
  const needsChildAges = useMemo(
    () =>
      selectedCabins.some((c) => {
        const p = pax[c.id];
        if (!p) return false;
        for (let i = 0; i < p.children; i++) {
          const age = p.childAges[i];
          if (age === undefined || age === null || Number.isNaN(age)) return true;
        }
        return false;
      }),
    [selectedCabins, pax],
  );

  // Debounced server quote. The server is the single source of truth for price
  // — no client-side nights/fee/child math.
  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (group || selectedCabins.length === 0 || !departure) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    // Every child needs an age before the server can price them. Firing anyway
    // sends an incomplete childAges array, and the guest would see a total that
    // silently changes once they finish typing.
    if (needsChildAges) {
      setQuote(null);
      setQuoteError(null); // not an error — just not finished yet
      return;
    }

    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    quoteTimer.current = setTimeout(async () => {
      setQuoting(true);
      try {
        const body = {
          departureId: departure.id,
          cabins: selectedCabins.map((c) => ({
            cabinId: c.id,
            adults: pax[c.id].adults,
            children: pax[c.id].children,
            childAges: pax[c.id].childAges.slice(0, pax[c.id].children),
          })),
        };
        const { data } = await api.post<Quote>('/booking/quote', body);
        setQuote(data);
        setQuoteError(null);
      } catch (e) {
        // Say WHY instead of blanking the price with no explanation — a rejected
        // quote used to leave the guest staring at a missing total.
        setQuote(null);
        setQuoteError(apiErrorMessage(e, 'Could not price this selection.'));
      } finally {
        setQuoting(false);
      }
    }, 350);
    return () => {
      if (quoteTimer.current) clearTimeout(quoteTimer.current);
    };
  }, [selectedCabins, pax, group, departure, needsChildAges]);

  const setCabinPax = (cabinId: string, next: Partial<Pax>) => {
    if (group) releaseAllHolds(); // switching away from a group clears nothing held
    setGroup(null); // picking a cabin clears any group selection

    // Work out the transition HERE, from the current pax, and fire the hold
    // from the handler. Doing it inside the setPax updater made the request a
    // side effect of a function React is free to call more than once — and
    // StrictMode does exactly that in dev, so one click sent two POSTs: the
    // first took the hold, the second hit the unique index and came back 409
    // "that cabin was just taken" about the guest's own hold.
    const cur = pax[cabinId] ?? { adults: 0, children: 0, childAges: [] };
    const merged = { ...cur, ...next };
    if (merged.children < merged.childAges.length) {
      merged.childAges = merged.childAges.slice(0, merged.children);
    }
    const wasEmpty = cur.adults + cur.children === 0;
    const isEmpty = merged.adults + merged.children === 0;

    setPax((prev) => ({ ...prev, [cabinId]: merged }));

    // The hold follows the selection: taken the moment a cabin gains its first
    // guest, released the moment it loses its last. Fire-and-forget so the
    // stepper stays responsive; failures surface on the card.
    if (wasEmpty && !isEmpty) void takeHold(cabinId);
    if (!wasEmpty && isEmpty) void dropHold(cabinId);
  };

  const pickBand = (band: GroupBand) => {
    // Clicking the selected band again clears it, so a group booking can be
    // abandoned without reloading the page.
    if (group?.bandId === band.id) {
      setGroup(null);
      return;
    }
    // A buyout takes the whole boat and is not built from per-cabin holds, so
    // free anything this browser was holding rather than sitting on cabins the
    // guest no longer wants.
    releaseAllHolds();
    setPax({}); // group buyout clears cabin picks
    setGroup({
      bandId: band.id,
      adults: band.minPeople,
      children: 0,
      share: false,
    });
  };

  const groupBand = bands.find((b) => b.id === group?.bandId) ?? null;
  const groupHead = group ? group.adults + group.children : 0;
  const groupValid =
    !!groupBand &&
    groupHead >= groupBand.minPeople &&
    groupHead <= groupBand.maxPeople;

  const joinWaitlist = async (cabinId: string) => {
    if (!departure) return;
    try {
      await api.post('/booking/waitlist', {
        departureId: departure.id,
        partySize: 1,
        // Wait for THIS cabin, not merely the trip — so several cabins can be
        // waitlisted separately and the alert names the one that freed.
        cabinId,
      });
      setWaitlisted((w) => ({ ...w, [cabinId]: true }));
    } catch {
      // Signed-out or duplicate entry — open sign-in in place so they keep the
      // date and cabin selection they already made.
      if (!isSignedIn) openAuth('login', { reason: 'login_required' });
    }
  };

  // Map slot → scroll to the cabin card and flash it (preview 938–947).
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const focusCabin = useCallback((cabinId: string) => {
    const el = cardRefs.current[cabinId];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.transition = 'box-shadow .2s';
    el.style.boxShadow = '0 0 0 3px var(--blue)';
    setTimeout(() => {
      el.style.boxShadow = '';
    }, 900);
  }, []);

  const ready = group ? groupValid : selectedCabins.length > 0 && !!quote;
  const totalText = group
    ? groupValid && groupBand
      ? money(groupBand.totalPrice)
      : '—'
    : quote
      ? money(quote.displayTotal)
      : '—';

  const guestsLabel = group
    ? `${groupHead} guest${groupHead === 1 ? '' : 's'} · full boat`
    : selectedCabins.length === 0
      ? 'Nothing selected yet'
      : `${selectedCabins.length} cabin${selectedCabins.length > 1 ? 's' : ''} · ${selectedCabins.reduce(
          (n, c) => n + pax[c.id].adults + pax[c.id].children,
          0,
        )} guests`;

  const reserve = () => {
    if (!departure) return;
    // Presentation the checkout summary cannot derive on its own. Same for both
    // branches, so it is built once — the guest picked this departure and this
    // boat whether they took cabins or the whole boat.
    const shared = {
      slug,
      boatName: boat.name,
      departureId: departure.id,
      trip: {
        startDate: departure.startDate,
        endDate: departure.endDate,
        departureTime: departure.departureTime,
        durationDays: departure.package.durationDays,
        durationLabel: departure.package.durationLabel,
        departureGhat: departure.package.departureGhat,
        routeName: departure.package.route?.name ?? null,
        routeRegion: departure.package.route?.region ?? null,
      },
      // Head of the gallery the shell already resolved (real uploads first,
      // padded with stock). Checkout falls back to photoFor() if absent.
      boatPhoto: boatPhotos[0],
      ratingAvg: boat.ratingAvg,
    };
    let selection: StoredSelection;
    if (group && groupBand && groupValid) {
      selection = {
        ...shared,
        kind: 'group',
        cabins: [],
        groupHeadcount: groupHead,
        displayTotal: groupBand.totalPrice,
      };
    } else {
      if (!quote) return;
      selection = {
        ...shared,
        kind: 'cabin',
        cabins: selectedCabins.map((c) => ({
          cabinId: c.id,
          cabinName: c.name,
          adults: pax[c.id].adults,
          children: pax[c.id].children,
          childAges: pax[c.id].childAges.slice(0, pax[c.id].children),
          holdId: holds[c.id],
          deck: c.deck,
          // The server's price for this cabin, never recomputed here.
          roomPrice: quote.perCabin.find((q) => q.cabinId === c.id)?.roomPrice,
        })),
        displayTotal: quote.displayTotal,
        roomTotal: quote.roomTotal,
        discountAmount: quote.discountAmount,
      };
    }
    try {
      sessionStorage.setItem(SELECTION_KEY, JSON.stringify(selection));
    } catch {}
    // Checkout enforces auth server-side; signed-out users hit the login wall
    // there with the selection preserved in storage.
    router.push('/checkout');
  };

  // Available cabins first; anything the guest cannot pick right now — sold OR
  // held by someone else — sinks to the bottom (preview line 809). Held cabins
  // must be included or they jump to the top the moment a rival takes one.
  const orderedCabins = useMemo(() => {
    const unavailable = (c: Cabin) => {
      const s = availByCabin.get(c.id)?.state;
      return s === 'booked' || s === 'held_by_other' ? 1 : 0;
    };
    return [...cabins].sort((a, b) => unavailable(a) - unavailable(b));
  }, [cabins, availByCabin]);

  // Cabins other visitors are holding, live over the /rt socket, so a cabin
  // someone else takes goes unavailable here within ~1s instead of only being
  // discovered on Reserve. Same hook the owner POS grid uses. Declared above
  // mapCabins because that reads it.
  const live = useDepartureAvailability(departureId || null);

  const mapCabins: BoatMapCabin[] = cabins.map((c) => {
    const s = availByCabin.get(c.id)?.state;
    // Mirror the cabin cards exactly, or the two halves of the page disagree:
    // ours is never blocked (even mid-request), and a rival's hold counts whether
    // it came from the snapshot or the live socket.
    const isMine =
      !!holds[c.id] || pendingHolds.has(c.id) || s === 'held_by_me';
    const heldByOther = !isMine && (live.held.has(c.id) || s === 'held_by_other');
    return {
      id: c.id,
      name: c.name,
      deck: c.deck,
      capacity: c.capacity,
      // Both block the tile, but they read differently: a sold cabin is gone for
      // good (red), a held one frees up in ~10 min (amber).
      unavailable:
        !isMine && s === 'booked'
          ? ('sold' as const)
          : heldByOther
            ? ('held' as const)
            : null,
      guests: (pax[c.id]?.adults ?? 0) + (pax[c.id]?.children ?? 0),
    };
  });

  // ---- selection window ------------------------------------------------
  // A 10-minute UI reservation window, mirroring the owner POS countdown
  // (pos/page.tsx:243–260): count down to an absolute deadline rather than
  // decrementing a counter, so a throttled background tab still shows the
  // right time when it wakes. This is NOT a server hold — the real cabin lock
  // is taken at checkout — so the copy must not promise the cabin is reserved.
  const [remainingMs, setRemainingMs] = useState(0);
  const [expired, setExpired] = useState(false);

  // Restore the holds this browser already owns. The server marks them
  // `held_by_me` (it knows the account / hb_gid cookie), so after a reload the
  // guest's cabins come back selected with the REAL remaining time instead of
  // reading as "Fully booked" — which is what they did while the snapshot
  // reported every hold, including the viewer's own, as taken.
  useEffect(() => {
    const own = availability?.cabins.filter((c) => c.state === 'held_by_me') ?? [];
    if (own.length === 0) return;
    // Only seed cabins we are not already tracking; a live selection in this
    // tab always wins over the snapshot it was rendered from. A row without a
    // holdId cannot be released or converted, so it is not worth selecting.
    const missing = own.filter((c) => c.holdId && !holdsRef.current[c.cabinId]);
    if (missing.length === 0) return;
    setPax((prev) => {
      const next = { ...prev };
      missing.forEach((c) => {
        const cur = next[c.cabinId];
        // One adult is the minimum that makes a cabin "selected"; the guest can
        // adjust. Existing picks win over this default.
        if (!cur || cur.adults + cur.children === 0) {
          next[c.cabinId] = { adults: 1, children: 0, childAges: [] };
        }
      });
      return next;
    });
    // Resume from the server's expiry, not a fresh 10:00. All holds in a cart
    // share one countdown, so any of them carries the right deadline.
    const expiry = own.find((c) => c.holdExpiresAt)?.holdExpiresAt;
    if (expiry) setHoldExpiresAt(expiry);
    // Real hold ids, so a restored cabin can be deselected (dropHold needs the
    // id) and converted at checkout exactly like one held in this tab.
    setHolds((h) => {
      const next = { ...h };
      missing.forEach((c) => {
        if (c.holdId && !next[c.cabinId]) next[c.cabinId] = c.holdId;
      });
      holdsRef.current = next;
      return next;
    });
  }, [availability]);

  // While this page holds cabins it reports in every 30s; when it stops — tab
  // closed, browser quit, laptop shut — the server reclaims those cabins after a
  // ~2 minute grace instead of letting them sit out the full TTL.
  //
  // This replaces the old pagehide/sessionStorage dance that tried to tell a
  // reload apart from a real exit. It could not: pagehide fires the same for
  // both (`persisted` marks only a bfcache restore, never F5), so the code had
  // to defer the release and a closed tab leaked its cabins for 10+ minutes.
  // A heartbeat answers the question definitively — a reloaded page starts
  // beating again, a closed one never does — and needs no unload event at all.
  //
  // Reserve → /checkout is a router.push, and the checkout page keeps beating
  // for the same departure, so those holds stay alive through the handover.
  useHoldHeartbeat(departureId || null, Object.keys(holds).length > 0);

  // Count down to the SERVER's expiry, not a locally invented one: this is the
  // moment the sweeper will actually release the cabins. Absolute timestamp, so
  // a throttled background tab still shows the right time when it wakes.
  useEffect(() => {
    if (!holdExpiresAt) {
      setRemainingMs(0);
      return;
    }
    const tick = () => {
      const ms = new Date(holdExpiresAt).getTime() - Date.now();
      setRemainingMs(Math.max(0, ms));
      if (ms <= 0) {
        // Stop the clock and hand the page over to the expiry dialog. No
        // refetch here: the sweeper runs only once a minute, so an immediate
        // re-read still reports our own lapsed rows as held — which, with the
        // selection cleared, rendered the guest's cabins as "Fully booked" for
        // up to a minute. The reload from the dialog is the honest reset.
        setHoldExpiresAt(null);
        setExpired(true);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [holdExpiresAt]);

  const countdown = holdExpiresAt
    ? `${String(Math.floor(remainingMs / 60000)).padStart(2, '0')}:${String(
        Math.floor((remainingMs % 60000) / 1000),
      ).padStart(2, '0')}`
    : null;

  // Self-service bookings are capped server-side (MAX_CABINS_PER_BOOKING); mirror
  // it here so the + buttons go dead instead of round-tripping to a 409.
  const atCabinLimit = Object.keys(holds).length >= MAX_CABINS_PER_BOOKING;

  const lowestPrice = cabins.reduce<number | null>(
    (m, c) =>
      c.pricePerPerson == null ? m : m == null ? c.pricePerPerson : Math.min(m, c.pricePerPerson),
    null,
  );

  // The headline figure tracks what is actually selected: a chosen group band
  // is a flat buyout, so showing a per-person "from" rate beside it would
  // contradict the total in the summary below.
  const headlinePrice =
    group && groupBand
      ? {
          lead: 'whole boat',
          amount: money(groupBand.totalPrice),
          unit: 'full boat',
        }
      : {
          lead: 'from',
          amount: lowestPrice != null ? money(lowestPrice) : '—',
          unit: '/ person',
        };

  return (
    <div className="grid grid-cols-[1fr_360px] items-start gap-[34px] max-[940px]:grid-cols-1">
      <div>
        {/* ---------- CABINS ---------- */}
        <div className={CARD}>
          <h2 className={SECTION_H2}>Choose your cabins</h2>
          <p className="mb-4 text-[15px] text-bodytext">
            Add adults or children to a cabin to select it. Pick as many cabins
            as you like — the summary totals them all at the live price.
          </p>
          <div className="mb-4 flex items-center gap-1.5 rounded border border-hair bg-bg px-3 py-2.5 text-xs text-muted">
            ℹ️ Child fares follow this boat’s age policy · infants under 1 free.
          </div>

          {atCabinLimit ? (
            <div
              role="status"
              className="mb-4 rounded border border-[color-mix(in_srgb,var(--amber)_35%,transparent)] bg-[color-mix(in_srgb,var(--amber)_12%,transparent)] px-3 py-2.5 text-xs font-bold text-[var(--amber-700)] dark:text-amber"
            >
              You can book up to {MAX_CABINS_PER_BOOKING} cabins per booking.
            </div>
          ) : null}

          {orderedCabins.length === 0 ? (
            <p className="text-sm text-muted">
              This boat has no cabins published yet.
            </p>
          ) : null}

          {orderedCabins.map((c) => {
            const av = availByCabin.get(c.id);
            // Ours three ways, and all three are needed:
            //   holds        — the hold response landed in this tab.
            //   pendingHolds — the request is still in flight. The server's
            //                  `held` socket event is broadcast to the holder as
            //                  well and arrives BEFORE our own POST resolves, so
            //                  without this the cabin flashes "Fully booked" for
            //                  ~200ms against its own owner.
            //   held_by_me   — the server recognised us (account or hb_gid) when
            //                  it rendered the snapshot, which is what survives a
            //                  reload.
            const mine =
              !!holds[c.id] || pendingHolds.has(c.id) || av?.state === 'held_by_me';
            // Two different reasons a cabin is out of reach, shown differently:
            // a hold lapses in ~10 minutes and the cabin usually comes back, a
            // sold cabin does not. The socket only ever reports holds, so it
            // feeds heldByOther.
            const heldByOther =
              !mine && (live.held.has(c.id) || av?.state === 'held_by_other');
            const soldOut = !mine && av?.state === 'booked';
            const unavailable = heldByOther || soldOut;
            const openSeat = av?.state === 'open_seat';
            const cap = openSeat ? av!.spare : c.capacity;
            const p = pax[c.id] ?? { adults: 0, children: 0, childAges: [] };
            const used = p.adults + p.children;
            const picked = used > 0;
            // At the cabin cap, cabins we don't already hold stop accepting
            // guests — adding one would be refused by the server anyway. Cabins
            // we do hold stay editable so headcounts can still be adjusted.
            const capReached = !mine && atCabinLimit;
            const canInc = used < cap && !group && !capReached;
            // A cabin with its own photos shows them; otherwise it borrows the
            // boat gallery, which the shell has already padded to a scrollable
            // set. Either way the lightbox gets more than one image.
            const cabinPhotos = c.photos.length > 0 ? c.photos : boatPhotos;
            const photo = cabinPhotos[0];
            const perCabin = quote?.perCabin.find((q) => q.cabinId === c.id);

            return (
              <div
                key={c.id}
                ref={(el) => {
                  cardRefs.current[c.id] = el;
                }}
                className={`relative mb-6 flex items-center gap-3.5 rounded-2xl border bg-raise-1 p-3 pb-[42px] transition-[border-color,box-shadow] duration-150 max-[640px]:flex-wrap ${
                  picked
                    ? 'border-blue shadow-[0_0_0_3px_var(--blue-050)]'
                    : 'border-hair'
                } ${unavailable ? 'opacity-95' : ''}`}
              >
                <button
                  type="button"
                  onClick={() =>
                    setPhotosFor({
                      photos: cabinPhotos,
                      title:
                        c.photos.length > 0
                          ? `${c.name} · photos`
                          : `${boat.name} · photos`,
                    })
                  }
                  aria-label={`View ${c.name} photos`}
                  className="group relative h-24 w-[132px] flex-none overflow-hidden rounded bg-chip max-[640px]:h-[170px] max-[640px]:w-full"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo}
                    alt={c.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-[400ms] group-hover:scale-[1.06]"
                  />
                  {cabinPhotos.length > 1 ? (
                    <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-[rgba(15,36,64,.7)] px-2 py-[3px] text-[11px] font-bold text-white">
                      🔍 {cabinPhotos.length} photos
                    </span>
                  ) : null}
                </button>

                <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                  {/*
                    No status pill here: the price column on the right already
                    states availability (sold / on hold / price + steppers), and
                    repeating it beside the name was the same fact twice. The
                    capacity chip below still carries the open-seat spare count.
                  */}
                  <div className="flex flex-wrap items-center gap-2.5 font-display text-base font-extrabold text-ink">
                    {c.name}
                  </div>

                  <div className="flex flex-wrap gap-[7px]">
                    <span className={CHIP}>
                      👥 {openSeat ? `${av!.spare} spare` : `up to ${c.capacity}`}
                    </span>
                    <span className={CHIP}>{c.isAc ? '❄️ AC' : '🌀 Non-AC'}</span>
                    <span className={CHIP}>📍 {c.deck}</span>
                  </div>

                  {openSeat ? (
                    <div className="rounded-md border border-[color-mix(in_srgb,var(--amber)_35%,transparent)] bg-[color-mix(in_srgb,var(--amber)_12%,transparent)] px-2.5 py-[5px] text-xs font-bold text-[var(--amber-700)] dark:text-amber">
                      🪑 Shared cabin · only {av!.spare} place
                      {av!.spare > 1 ? 's' : ''} spare
                    </div>
                  ) : null}

                  {holdError[c.id] ? (
                    <div
                      role="alert"
                      className="rounded-md border border-[color-mix(in_srgb,var(--danger)_45%,transparent)] bg-[color-mix(in_srgb,var(--danger)_10%,var(--raise-1))] px-2.5 py-[5px] text-xs font-bold text-danger"
                    >
                      {holdError[c.id]}
                    </div>
                  ) : null}
                </div>

                <div className="flex w-[230px] flex-none flex-col justify-center gap-2.5 border-l border-hair pl-4 max-[640px]:w-full max-[640px]:border-l-0 max-[640px]:border-t max-[640px]:pl-0 max-[640px]:pt-3">
                  {unavailable ? (
                    <>
                      {heldByOther ? (
                        // Amber, not red: this cabin is only reserved while
                        // another guest checks out, and the hold expires in ~10
                        // minutes. Saying "fully booked" would be untrue.
                        <div className="rounded border border-dashed border-[color-mix(in_srgb,var(--amber)_45%,transparent)] p-2.5 text-center text-[11.5px] font-extrabold uppercase tracking-[.04em] text-[var(--amber-700)] dark:text-amber">
                          ⏳ On hold by another guest
                          <span className="mt-0.5 block text-[10.5px] font-bold normal-case tracking-normal opacity-80">
                            may free up shortly
                          </span>
                        </div>
                      ) : (
                        <div className="rounded border border-dashed border-[color-mix(in_srgb,var(--danger)_45%,transparent)] p-2.5 text-center text-[11.5px] font-extrabold uppercase tracking-[.04em] text-danger">
                          ⛔ Fully booked
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => joinWaitlist(c.id)}
                        disabled={waitlisted[c.id]}
                        className={`w-full rounded-full border-[1.5px] px-3.5 py-2.5 text-[13px] font-extrabold transition-all duration-150 ${
                          waitlisted[c.id]
                            ? 'border-[color-mix(in_srgb,var(--ok)_45%,transparent)] bg-[color-mix(in_srgb,var(--ok)_12%,var(--raise-1))] text-ok'
                            : 'border-blue bg-blue text-white shadow-[0_4px_12px_-5px_var(--blue)] hover:bg-blue-600'
                        }`}
                      >
                        {waitlisted[c.id]
                          ? '✓ On waitlist — we’ll notify you'
                          : '🔔 Join waitlist'}
                      </button>
                    </>
                  ) : (
                    <>
                      {picked && perCabin ? (
                        <div className="text-right font-display text-[21px] font-black leading-none tracking-[-.03em] text-blue">
                          <span className="block text-[11px] font-bold text-muted">
                            {used} guest{used > 1 ? 's' : ''}
                          </span>
                          {money(perCabin.roomPrice)}
                          <small className="mt-0.5 block font-sans text-[11px] font-semibold text-muted">
                            cabin total
                          </small>
                        </div>
                      ) : (
                        <div className="text-right font-display text-[21px] font-black leading-none tracking-[-.03em] text-ink">
                          {c.pricePerPerson != null ? money(c.pricePerPerson) : '—'}
                          <small className="mt-0.5 block font-sans text-[11px] font-semibold text-muted">
                            {c.pricePerPerson != null
                              ? '/ person'
                              : 'see summary'}
                          </small>
                        </div>
                      )}

                      <div className="grid gap-1.5">
                        <CounterRow
                          label="Adult"
                          hint="full fare"
                          value={p.adults}
                          canInc={canInc}
                          onDec={() =>
                            setCabinPax(c.id, { adults: Math.max(0, p.adults - 1) })
                          }
                          onInc={() => setCabinPax(c.id, { adults: p.adults + 1 })}
                        />
                        <CounterRow
                          label="Child"
                          // The boat's real bands, not a vague "policy applies".
                          hint={childPolicyText}
                          value={p.children}
                          // Children share their parents' berths, so they are not
                          // bound by cabin capacity — only by their own cap.
                          canInc={
                            !group &&
                            !capReached &&
                            p.children < MAX_CHILDREN_PER_CABIN
                          }
                          onDec={() =>
                            setCabinPax(c.id, {
                              children: Math.max(0, p.children - 1),
                            })
                          }
                          onInc={() =>
                            setCabinPax(c.id, { children: p.children + 1 })
                          }
                        />
                        {p.children >= MAX_CHILDREN_PER_CABIN ? (
                          <div className="text-[11px] font-semibold text-muted">
                            Up to {MAX_CHILDREN_PER_CABIN} children per cabin.
                          </div>
                        ) : null}
                        {p.children > 0 ? (
                          <div className="grid gap-1.5 pt-1">
                            {Array.from({ length: p.children }).map((_, i) => {
                              const raw = p.childAges[i];
                              const typed =
                                raw !== undefined && raw !== null && !Number.isNaN(raw);
                              const charge = typed
                                ? chargeForAge(boat.childPolicy, raw)
                                : null;
                              return (
                                <div key={i} className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min={0}
                                    max={childAgeMax}
                                    placeholder={`Child ${i + 1} age`}
                                    value={raw ?? ''}
                                    onChange={(e) => {
                                      const ages = [...p.childAges];
                                      const v = e.target.value;
                                      // Empty clears the entry rather than
                                      // becoming 0, which is a real age here.
                                      ages[i] =
                                        v === ''
                                          ? (undefined as unknown as number)
                                          : Number(v);
                                      setCabinPax(c.id, { childAges: ages });
                                    }}
                                    aria-label={`Child ${i + 1} age`}
                                    className={`w-[92px] rounded border bg-field px-2 py-1.5 text-[13px] text-ink ${
                                      charge && !charge.matched
                                        ? 'border-[color-mix(in_srgb,var(--amber)_55%,transparent)]'
                                        : 'border-hair'
                                    }`}
                                  />
                                  {charge ? (
                                    charge.matched ? (
                                      <span className="text-[11.5px] font-bold text-ok">
                                        {chargeLabel(charge.pct)}
                                      </span>
                                    ) : (
                                      // The owner's bands define what a child is.
                                      // Outside them this guest is full fare — say
                                      // so rather than surprising them at checkout.
                                      <span className="text-[11.5px] font-semibold text-[var(--amber-700)] dark:text-amber">
                                        No child rate for age {raw} — charged full
                                        fare. Add as an adult instead.
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-[11.5px] font-semibold text-muted">
                                      Enter age to price
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>

                {/* attached tab strip, overlapping the card's bottom edge */}
                <div className="absolute -bottom-4 left-4 flex flex-wrap gap-2">
                  {(
                    [
                      ['info', '⚓ Boat info'],
                      ['incl', '✔️ Inclusions'],
                      ['itin', '🗺️ Itinerary'],
                      ['pol', '🛡️ Policies'],
                    ] as const
                  ).map(([tab, label]) => (
                    <button
                      key={tab}
                      type="button"
                      className={TAB_BTN}
                      onClick={() =>
                        setInfoFor({
                          cabin: {
                            name: c.name,
                            deck: c.deck,
                            isAc: c.isAc,
                            capacity: c.capacity,
                            facilities: c.facilities,
                          },
                          tab,
                        })
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ---------- GROUP BUYOUT ---------- */}
        {bands.length > 0 ? (
          <div className={CARD}>
            <h2 className={SECTION_H2}>👥 Book the whole boat (group)</h2>
            <p className="mb-4 text-[15px] text-bodytext">
              Buy out the entire houseboat at a flat group rate. Pick a size band
              and enter your headcount — one payment, no per-cabin split.
              Selecting a group clears any picked cabins.
            </p>

            <div className="mb-[18px] grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
              {bands.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={group?.bandId === b.id}
                  title={
                    group?.bandId === b.id
                      ? 'Click again to clear this group booking'
                      : undefined
                  }
                  onClick={() => pickBand(b)}
                  className={`rounded-2xl border-[1.5px] bg-raise-1 px-3.5 py-4 text-center transition-all duration-150 ${
                    group?.bandId === b.id
                      ? 'border-blue bg-[var(--blue-050)] shadow-[0_0_0_3px_var(--blue-050)]'
                      : 'border-hair hover:-translate-y-0.5 hover:border-[var(--blue-100)]'
                  }`}
                >
                  <div className="text-[13px] font-bold text-bodytext">
                    {b.minPeople}–{b.maxPeople} people
                  </div>
                  <div
                    className={`mt-[5px] font-display text-xl font-black tracking-[-.03em] ${
                      group?.bandId === b.id ? 'text-blue' : 'text-ink'
                    }`}
                  >
                    {money(b.totalPrice)}
                    <small className="block font-sans text-[11px] font-semibold text-muted">
                      full boat
                    </small>
                  </div>
                </button>
              ))}
            </div>

            {group && groupBand ? (
              <div className="rounded-2xl border border-hair bg-bg px-5 py-[18px]">
                <div className="mb-3.5 text-sm font-extrabold text-ink">
                  Your group · {groupBand.minPeople}–{groupBand.maxPeople} people
                </div>
                <div className="grid max-w-[420px] gap-2.5">
                  <CounterRow
                    label="Adults"
                    hint="full fare"
                    value={group.adults}
                    canInc={groupHead < groupBand.maxPeople}
                    onDec={() =>
                      setGroup({ ...group, adults: Math.max(0, group.adults - 1) })
                    }
                    onInc={() => setGroup({ ...group, adults: group.adults + 1 })}
                  />
                  <CounterRow
                    label="Children"
                    hint="counts toward the band"
                    value={group.children}
                    canInc={groupHead < groupBand.maxPeople}
                    onDec={() =>
                      setGroup({
                        ...group,
                        children: Math.max(0, group.children - 1),
                      })
                    }
                    onInc={() =>
                      setGroup({ ...group, children: group.children + 1 })
                    }
                  />
                </div>

                <div
                  className={`mt-3 min-h-[18px] text-[12.5px] font-bold ${
                    groupValid ? 'text-ok' : 'text-danger'
                  }`}
                >
                  {groupHead === 0
                    ? ''
                    : groupHead < groupBand.minPeople
                      ? `Add ${groupBand.minPeople - groupHead} more — this band needs at least ${groupBand.minPeople}.`
                      : groupHead > groupBand.maxPeople
                        ? `Too many — this band allows up to ${groupBand.maxPeople}. Pick a bigger band.`
                        : `✓ ${groupHead} guests added to your summary → Reserve on the right.`}
                </div>

                <div className="mt-4 border-t border-hair pt-4">
                  <div className="mb-2.5 text-[13.5px] font-bold text-ink">
                    Are you willing to share the empty rooms with other guests?
                  </div>
                  <div className="inline-flex rounded-full border border-hair bg-raise-1 p-[3px]">
                    {([false, true] as const).map((yes) => (
                      <button
                        key={String(yes)}
                        type="button"
                        onClick={() => setGroup({ ...group, share: yes })}
                        className={`rounded-full border-none px-[22px] py-[7px] text-[13px] font-extrabold transition-all duration-150 ${
                          group.share === yes
                            ? yes
                              ? 'bg-blue text-white'
                              : 'bg-danger text-white'
                            : 'bg-transparent text-bodytext hover:text-blue'
                        }`}
                      >
                        {yes ? 'Yes' : 'No'}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-muted">
                    {group.share
                      ? 'Your unused rooms are offered as open seats — you may get a discount if others join.'
                      : 'Empty rooms stay yours — no strangers on board.'}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* ---------- REVIEWS ---------- */}
        {boat.reviews.length > 0 ? (
          <div className={CARD}>
            <h2 className={SECTION_H2}>
              Guest reviews
              {boat.ratingAvg != null
                ? ` · ${boat.ratingAvg.toFixed(1)} (${boat.reviewCount})`
                : ''}
            </h2>
            {boat.reviews.map((r, i) => {
              const who = r.customer?.name?.trim() || 'Guest';
              const initials = who
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase() ?? '')
                .join('');
              return (
                <div
                  key={r.id}
                  className={
                    i === 0 ? '' : 'mt-4 border-t border-hair pt-4'
                  }
                >
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-[38px] w-[38px] place-items-center rounded-full bg-[var(--blue-050)] text-[15px] font-extrabold text-blue">
                      {initials || 'G'}
                    </span>
                    <div className="font-bold text-ink">{who}</div>
                    <span className="ml-auto text-xs text-amber">
                      {'★'.repeat(r.rating)}
                      {'☆'.repeat(Math.max(0, 5 - r.rating))}
                    </span>
                  </div>
                  {r.text ? (
                    <p className="mt-2 text-sm text-bodytext">{r.text}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* ---------- RIGHT: sticky summary + deck map ---------- */}
      <aside className="sticky top-24 self-start max-[940px]:static">
        {countdown ? (
          <div
            role="status"
            className={`mb-3 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-[12.5px] font-bold ${
              remainingMs < 60_000
                ? 'border-[color-mix(in_srgb,var(--danger)_45%,transparent)] bg-[color-mix(in_srgb,var(--danger)_10%,var(--raise-1))] text-danger'
                : 'border-[color-mix(in_srgb,var(--ok)_35%,transparent)] bg-[color-mix(in_srgb,var(--ok)_10%,var(--raise-1))] text-ok'
            }`}
          >
            <span>🔒 Cabin reserved for you</span>
            <b className="font-display text-base tabular-nums">{countdown}</b>
          </div>
        ) : null}


        <div className="rounded-2xl border border-hair bg-raise-1 p-[22px] shadow-e2">
          <div className="text-[13px] font-semibold text-muted">
            {headlinePrice.lead}
          </div>
          <div className="font-display text-[26px] font-black tracking-[-.03em] text-ink">
            {headlinePrice.amount}{' '}
            <small className="font-sans text-[13px] font-semibold text-muted">
              {headlinePrice.unit}
            </small>
          </div>

          <div className="mt-3.5 rounded border border-hair bg-bg px-3.5 py-2.5">
            <label
              htmlFor="departure"
              className="text-[10.5px] font-bold uppercase tracking-[.05em] text-muted"
            >
              📅 Departure
            </label>
            {departures.length > 0 ? (
              <select
                id="departure"
                value={departureId}
                onChange={(e) => {
                  // Holds are per departure — keeping them would lock cabins on
                  // a date the guest just moved away from.
                  releaseAllHolds();
                  setDepartureId(e.target.value);
                  setPax({});
                  setGroup(null);
                }}
                className="mt-0.5 w-full rounded bg-raise-1 text-[15px] font-bold text-ink outline-none"
              >
                {departures.map((d) => (
                  <option key={d.id} value={d.id}>
                    {formatDeparture(d)}
                  </option>
                ))}
              </select>
            ) : (
              <div className="mt-0.5 text-[15px] font-bold text-ink">
                No upcoming departures
              </div>
            )}
          </div>

          <div className="mt-3.5 rounded border border-hair bg-bg px-3.5 py-2.5">
            <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-muted">
              👤 Guests
            </span>
            <div className="mt-0.5 text-[15px] font-bold text-ink">
              {guestsLabel}
            </div>
          </div>

          <div className="mt-4">
            {!departure ? (
              <div className="py-2 text-center text-[13.5px] text-muted">
                No upcoming departures for this boat.
              </div>
            ) : group && groupBand ? (
              <>
                <SummaryRow
                  label={`Full boat · ${groupBand.minPeople}–${groupBand.maxPeople} band`}
                  value={money(groupBand.totalPrice)}
                  bold
                />
                <SummaryRow
                  label="Guests"
                  value={`${group.adults} adult${group.adults === 1 ? '' : 's'}${
                    group.children ? ` · ${group.children} child` : ''
                  }`}
                  muted
                />
                <div className="mt-1.5 flex justify-between border-t border-hair pt-3 text-[17px] font-extrabold text-ink">
                  <span>Group total</span>
                  <span>{money(groupBand.totalPrice)}</span>
                </div>
              </>
            ) : selectedCabins.length === 0 ? (
              <div className="py-2 text-center text-[13.5px] text-muted">
                Add guests to a cabin — or pick a group band.
              </div>
            ) : quote ? (
              <>
                {quote.perCabin.map((pc) => {
                  const cabin = cabins.find((c) => c.id === pc.cabinId);
                  return (
                    <SummaryRow
                      key={pc.cabinId}
                      label={`${cabin?.name ?? 'Cabin'} (${pc.adults}A${
                        pc.children ? ` + ${pc.children}C` : ''
                      })`}
                      value={money(pc.roomPrice)}
                      bold
                    />
                  );
                })}
                {Number(quote.discountAmount) > 0 ? (
                  <SummaryRow
                    label="Discount"
                    value={`− ${money(quote.discountAmount)}`}
                    muted
                  />
                ) : null}
                <div className="mt-1.5 flex justify-between border-t border-hair pt-3 text-[17px] font-extrabold text-ink">
                  <span>Total</span>
                  <span>{money(quote.displayTotal)}</span>
                </div>
              </>
            ) : quoteError ? (
              // A rejected quote used to blank the total with no explanation.
              <div
                role="alert"
                className="rounded-md border border-[color-mix(in_srgb,var(--danger)_45%,transparent)] bg-[color-mix(in_srgb,var(--danger)_10%,var(--raise-1))] px-3 py-2.5 text-[12.5px] font-bold text-danger"
              >
                {quoteError}
              </div>
            ) : (
              <div className="py-2 text-center text-[13.5px] text-muted">
                {quoting
                  ? 'Pricing…'
                  : needsChildAges
                    ? 'Enter each child’s age to see the price.'
                    : 'Add guests to price.'}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={!ready}
            onClick={reserve}
            className={`${PRIMARY_BTN} mt-4 max-[940px]:hidden`}
          >
            {ready ? `Reserve · ${totalText}` : 'Select cabins'}
          </button>

          <p className="mt-3 text-center text-[12.5px] text-muted">
            No payment yet — picking a cabin holds it for 10 minutes.
          </p>

          {!isSignedIn ? (
            <p className="mt-2 text-center text-[12.5px] text-muted">
              You’ll sign in at checkout to confirm.
            </p>
          ) : null}
        </div>

        {mapCabins.length > 0 ? (
          <BoatMap cabins={mapCabins} onFocusCabin={focusCabin} />
        ) : null}
      </aside>

      {/* ---------- mobile sticky book bar ---------- */}
      <div className="fixed bottom-0 left-0 right-0 z-[70] hidden items-center justify-between gap-3.5 border-t border-hair bg-raise-1 px-5 py-3 shadow-[0_-8px_24px_rgba(15,36,64,.12)] max-[940px]:flex">
        <div className="font-display text-lg font-black text-ink">
          {totalText}
          <small className="block font-sans text-[11px] font-semibold text-muted">
            {guestsLabel}
          </small>
        </div>
        <button
          type="button"
          disabled={!ready}
          onClick={reserve}
          className={`${PRIMARY_BTN} w-auto px-7`}
        >
          Reserve
        </button>
      </div>

      {infoFor ? (
        <CabinInfoModal
          cabin={infoFor.cabin}
          boatName={boat.name}
          safetyFeatures={boat.safetyFeatures}
          foodMenu={boat.foodMenu}
          childPolicy={boat.childPolicy}
          departure={departure}
          initialTab={infoFor.tab}
          onClose={() => setInfoFor(null)}
        />
      ) : null}

      {photosFor ? (
        <PhotoLightboxHost
          photos={photosFor.photos}
          title={photosFor.title}
          onClose={() => setPhotosFor(null)}
        />
      ) : null}

      {/*
        Hold expired. Deliberately blocking and with no dismiss: every price and
        cabin state on the page is now stale, and the server has (or is about to)
        release these cabins. A reload is the only honest way forward, so the
        dialog offers exactly that rather than letting the guest carry on with a
        selection that will be refused at checkout.
      */}
      {expired ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-5">
          <div className="absolute inset-0 bg-[rgba(10,20,40,.6)] backdrop-blur-[2px]" />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="hold-expired-title"
            className="relative w-[min(420px,100%)] rounded-2xl bg-raise-1 p-6 text-center shadow-e3"
          >
            <div aria-hidden="true" className="mb-2 text-3xl">
              ⏳
            </div>
            <h3
              id="hold-expired-title"
              className="mb-2 font-display text-[19px] font-semibold text-ink"
            >
              Your session expired
            </h3>
            <p className="mb-5 text-[13.5px] leading-relaxed text-bodytext">
              Your 10-minute cabin hold has ended and the cabins have been
              released. Reload the page to see what is still available.
            </p>
            <button
              type="button"
              autoFocus
              onClick={() => window.location.reload()}
              className="w-full rounded-xl bg-blue px-4 py-3 text-[14px] font-bold text-white transition-colors hover:bg-blue-700"
            >
              Reload page
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Keeps the lightbox's index local so reopening always starts at the first shot. */
function PhotoLightboxHost({
  photos,
  title,
  onClose,
}: {
  photos: string[];
  title: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  return (
    <PhotoLightbox
      photos={photos}
      title={title}
      index={index}
      onIndexChange={setIndex}
      onClose={onClose}
    />
  );
}

function SummaryRow({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex justify-between py-[7px] ${
        muted ? 'text-[13px] text-muted' : 'text-sm text-bodytext'
      }`}
    >
      <span>{label}</span>
      {bold ? <b className="font-bold text-ink">{value}</b> : <span>{value}</span>}
    </div>
  );
}

function CounterRow({
  label,
  hint,
  value,
  canInc,
  onInc,
  onDec,
}: {
  label: string;
  hint: string;
  value: number;
  canInc: boolean;
  onInc: () => void;
  onDec: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2.5">
      <span className="text-[12.5px] font-bold text-ink">
        {label}
        <small className="block text-[10.5px] font-semibold text-muted">
          {hint}
        </small>
      </span>
      <div className="inline-flex flex-none items-center overflow-hidden rounded-full border border-hair">
        <button
          type="button"
          onClick={onDec}
          disabled={value <= 0}
          aria-label={`Remove ${label.toLowerCase()}`}
          className="grid h-[26px] w-[26px] place-items-center border-none bg-raise-1 text-[15px] font-extrabold text-blue hover:bg-[var(--blue-050)] disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-raise-1"
        >
          −
        </button>
        <span className="min-w-[24px] text-center text-sm font-extrabold text-ink">
          {value}
        </span>
        <button
          type="button"
          onClick={onInc}
          disabled={!canInc}
          aria-label={`Add ${label.toLowerCase()}`}
          className="grid h-[26px] w-[26px] place-items-center border-none bg-raise-1 text-[15px] font-extrabold text-blue hover:bg-[var(--blue-050)] disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-raise-1"
        >
          +
        </button>
      </div>
    </div>
  );
}

/** "Sat 24 Jul 2026" — the departure date only; duration lives elsewhere. */
function formatDeparture(d: Departure): string {
  return new Date(d.startDate).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
