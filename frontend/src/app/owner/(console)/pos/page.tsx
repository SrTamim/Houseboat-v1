'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import { useOwnerList } from '@/lib/owner/useOwnerList';
import { useDepartureAvailability } from '@/lib/owner/useDepartureAvailability';
import {
  PageHead,
  Card,
  Field,
  Note,
  FilterBar,
  AsyncBlock,
} from '@/components/owner/ui';
import { BoatCabinMap, type MapDeck } from '@/components/owner/BoatCabinMap';
import type { CabState } from '@/components/owner/CabGrid';
import { Bill } from '@/components/owner/Bill';
import { BTN_B, BTN_O, BTN_SM } from '@/components/owner/buttons';
import {
  apiErrorMessage,
  formatDate,
  money,
  nextDepartureDate,
  toE164,
  weekday,
} from '@/lib/owner/format';
import {
  chargeForAge,
  chargeLabel,
  maxChildAge,
  summarizeChildPolicy,
} from '@/lib/customer/child-policy';
import type { ChildPolicyBand } from '@/lib/customer/types';

interface Departure {
  id: string;
  startDate: string;
  availableCount: number;
  status: string;
  package: { durationLabel: string | null; route: { name: string } };
}

interface BoatDetail {
  decks: {
    id: string;
    name: string;
    cabins: { id: string; name: string; cabinCategoryId: string }[];
  }[];
  cabinCategories: {
    id: string;
    name: string;
    baseCapacity: number;
    extendedCapacity: number | null;
  }[];
  /** Age bands that discount children off the adult fare (same shape the customer flow reads). */
  childPolicy: ChildPolicyBand[] | null;
}

interface Booking {
  id: string;
  cabins: { cabin: { id: string } }[];
}

interface Selection {
  cabinId: string;
  name: string;
  adults: number;
  children: number;
  /**
   * One age per child, in order. The server prices each child from its age
   * against the boat's child_policy; kept trimmed to `children` (see setCount).
   * An entry may be undefined while the operator is still typing.
   */
  childAges: number[];
  /** Server hold id, obtained the moment the cabin was selected. */
  holdId: string;
  /** Owner-typed price for a cabin with no configured rate (undefined = use profile). */
  priceOverride?: number;
  /**
   * Latched once the server reports no configured rate for this cabin's current
   * headcount. Stays true (so the manual-price input keeps rendering and stays
   * editable) even after the override makes the quote come back priced. Reset
   * when adults/children change, which re-evaluates the rate.
   */
  manualPrice?: boolean;
}

/** Server price quote for the current selection. */
interface Quote {
  perCabin: { cabinId: string; roomPrice: string; priced: boolean }[];
  roomTotal: string;
  discountAmount: string;
  displayTotal: string;
}

/** One live hold on the departure, from the seed read. */
interface ActiveHold {
  cabinId: string;
  heldBy: string;
  expiresAt: string;
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bkash', label: 'bKash' },
  { value: 'bank', label: 'Bank' },
  { value: 'online', label: 'Online' },
] as const;

/** "YYYY-MM-DD" (local) of a date string, for day-level comparison. */
function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

/** Digits only (for counts / whole-taka prices). Non-digits are dropped. */
function digits(v: string): number {
  const s = v.replace(/\D/g, '');
  return s === '' ? 0 : Number(s);
}

/**
 * Keep a money string as the user types: digits with at most one decimal point.
 * Returns a string so the field can be empty (→ 0) without snapping to a number.
 */
function numStr(v: string): string {
  const cleaned = v.replace(/[^\d.]/g, '');
  const i = cleaned.indexOf('.');
  if (i === -1) return cleaned;
  // Drop any further dots after the first.
  return cleaned.slice(0, i + 1) + cleaned.slice(i + 1).replace(/\./g, '');
}

/**
 * Counter sale.
 *
 * The submit rides the ordinary hold → checkout path on the backend, which is
 * what makes double-booking impossible: the partial unique index on active
 * holds rejects a second sale of the same cabin. Nothing here writes bookings
 * directly.
 */
export default function OwnerPosPage() {
  const { boatId } = useActiveBoat();
  // The date filter defaults to the next upcoming scheduled departure once the
  // list loads (see the seed effect below), not today — today often has no trip.
  const [day, setDay] = useState('');
  const [departureId, setDepartureId] = useState('');
  // One-shot: true once the default has been seeded OR the user has manually
  // changed a filter. Prevents re-seeding mid-session (which would silently move
  // the SWR key while holds are live) and prevents overriding a manual pick.
  const daySeeded = useRef(false);
  const [picked, setPicked] = useState<Selection[]>([]);
  // Shared cart countdown: every hold this operator takes on a departure shares
  // one server-issued expiry (the backend sweeps them onto the newest). Held as
  // an ISO string from the hold response — the server clock is authoritative.
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [referenceName, setReferenceName] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  // Owner-granted flat discount and what the customer actually paid. Kept as
  // raw strings so the inputs can be cleared; parsed to numbers where needed.
  const [discount, setDiscount] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [holding, setHolding] = useState<string | null>(null); // cabinId mid-hold
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  // Set when the backend refuses (409) because the typed phone belongs to an
  // existing customer under a different name. Shows a confirm prompt that resubmits
  // with attachToExisting.
  const [attachConflict, setAttachConflict] = useState(false);

  const departures = useSWR<Departure[]>(`/houseboats/${boatId}/departures-list`, fetcher, {
    revalidateOnFocus: false,
  });
  const boat = useSWR<BoatDetail>(`/houseboats/${boatId}/manage`, fetcher, {
    revalidateOnFocus: false,
  });

  // Seed the date filter to the next upcoming departure the first time the list
  // loads. Runs once (daySeeded ref) and only while the operator hasn't picked a
  // date, so it never overrides a manual choice or moves the SWR key mid-sale.
  useEffect(() => {
    if (daySeeded.current || !departures.data) return;
    daySeeded.current = true;
    const next = nextDepartureDate(departures.data);
    if (next) setDay(next);
  }, [departures.data]);

  // Bookable departures from the schedule, sorted by date and optionally
  // narrowed to a single day picked from the calendar.
  const bookable = useMemo(() => {
    const all = (departures.data ?? [])
      .filter((d) => d.status === 'scheduled')
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    return day ? all.filter((d) => dayOf(d.startDate) === day) : all;
  }, [departures.data, day]);

  const activeId = departureId && bookable.some((d) => d.id === departureId)
    ? departureId
    : bookable[0]?.id || '';
  const active = bookable.find((d) => d.id === activeId);

  const taken = useOwnerList<Booking>(
    activeId ? `/houseboats/${boatId}/bookings` : null,
    { departureId: activeId, status: 'confirmed' },
  );

  // Seed of who is holding what on this departure (any operator), so the grid
  // locks a rival's cabin on load. Kept fresh after that by the socket below.
  const seededHolds = useSWR<ActiveHold[]>(
    activeId ? `/houseboats/${boatId}/departures/${activeId}/holds` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  // Live held-cabin set for this departure (backend /rt gateway). On a conversion
  // (someone else completed a sale) refresh the bookings + holds reads so the
  // cabin flips to 'booked' instead of lingering as 'free'.
  const live = useDepartureAvailability(activeId || null, () => {
    void taken.mutate();
    void seededHolds.mutate();
  });

  // Cabins others are holding = seed ∪ live socket set, minus my own picks
  // (mine render as 'selected', not 'held').
  const mine = useMemo(() => new Set(picked.map((p) => p.cabinId)), [picked]);
  const othersHeld = useMemo(() => {
    const s = new Set<string>();
    for (const h of seededHolds.data ?? []) s.add(h.cabinId);
    for (const id of live.held) s.add(id);
    for (const id of mine) s.delete(id);
    return s;
  }, [seededHolds.data, live.held, mine]);

  // Cabins grouped by deck for the boat-shaped map.
  const decks: MapDeck[] = useMemo(() => {
    const categories = new Map((boat.data?.cabinCategories ?? []).map((c) => [c.id, c]));
    const sold = new Set(taken.items.flatMap((b) => b.cabins.map((c) => c.cabin.id)));

    return (boat.data?.decks ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      cabins: d.cabins.map((c) => {
        const category = categories.get(c.cabinCategoryId);
        const state: CabState = sold.has(c.id)
          ? 'booked'
          : mine.has(c.id)
            ? 'selected'
            : othersHeld.has(c.id)
              ? 'held'
              : 'free';
        return {
          id: c.id,
          name: c.name,
          caption: category ? `${category.name} · ${category.baseCapacity}p` : null,
          state,
        };
      }),
    }));
  }, [boat.data, taken.items, mine, othersHeld]);

  const hasCabins = decks.some((d) => d.cabins.length > 0);

  // The boat's child bands, read once. Same source the customer flow prices from,
  // so a child costs the same at the counter as it does online.
  const childPolicy = boat.data?.childPolicy ?? null;
  const childPolicyText = useMemo(
    () => summarizeChildPolicy(childPolicy),
    [childPolicy],
  );
  const childAgeMax = useMemo(() => maxChildAge(childPolicy), [childPolicy]);

  // Tick the shared countdown down to zero from the server expiry. On expiry the
  // hold is gone server-side (the sweeper releases it within a minute and emits
  // 'released'); clear the cart so the operator re-picks.
  useEffect(() => {
    if (!holdExpiresAt) {
      setRemainingMs(0);
      return;
    }
    const tick = () => {
      const ms = new Date(holdExpiresAt).getTime() - Date.now();
      setRemainingMs(Math.max(0, ms));
      if (ms <= 0) {
        setHoldExpiresAt(null);
        setPicked([]);
        setError('The 10-minute hold expired and the cabins were released. Please re-select.');
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [holdExpiresAt]);

  // Live price quote for the current selection. Recomputed (debounced) whenever
  // the cabins, their headcounts/overrides, the coupon or the owner discount
  // change. Uses the SAME backend pricing path the sale is billed at, so the
  // number shown here is exactly what the customer will be charged. A request id
  // guards against out-of-order responses clobbering a newer quote.
  const quoteReqId = useRef(0);
  // Signature of everything that affects price — keeps the effect from re-firing
  // on unrelated re-renders.
  const quoteKey = JSON.stringify({
    activeId,
    couponCode,
    discount,
    cabins: picked.map((p) => ({
      c: p.cabinId,
      a: p.adults,
      k: p.children,
      // Ages affect price, so a change must re-quote. Trimmed to the child count
      // to match what's sent, and so a trailing stale age can't re-fire it.
      g: p.childAges.slice(0, p.children),
      o: p.priceOverride,
    })),
  });
  useEffect(() => {
    if (!activeId || picked.length === 0) {
      setQuote(null);
      return;
    }
    // Every child needs an age before the server can price the party. Firing
    // with a partial childAges array would show a total that silently changes
    // once the operator finishes typing — hold the quote until ages are in.
    const missingAges = picked.some((p) => {
      for (let i = 0; i < p.children; i++) {
        const age = p.childAges[i];
        if (age === undefined || age === null || Number.isNaN(age)) return true;
      }
      return false;
    });
    if (missingAges) {
      setQuote(null);
      return;
    }
    const id = ++quoteReqId.current;
    const body = {
      departureId: activeId,
      couponCode: couponCode || undefined,
      discount: discount ? Number(discount) : undefined,
      cabins: picked.map((p) => ({
        cabinId: p.cabinId,
        adults: p.adults,
        children: p.children || undefined,
        childAges: p.children > 0 ? p.childAges.slice(0, p.children) : undefined,
        priceOverride: p.priceOverride,
      })),
    };
    const t = setTimeout(() => {
      api
        .post<Quote>(`/houseboats/${boatId}/pos/quote`, body)
        .then((res) => {
          if (id !== quoteReqId.current) return;
          setQuote(res.data);
          // Latch manual-pricing for any cabin the server couldn't price. Once a
          // cabin needs a manual price, keep it latched — the override then makes
          // the quote come back priced, and without this the input would unmount
          // mid-typing. Cleared on a headcount change (see setCount).
          const unpriced = new Set(
            res.data.perCabin.filter((c) => !c.priced).map((c) => c.cabinId),
          );
          setPicked((prev) =>
            prev.some((p) => unpriced.has(p.cabinId) && !p.manualPrice)
              ? prev.map((p) =>
                  unpriced.has(p.cabinId) ? { ...p, manualPrice: true } : p,
                )
              : prev,
          );
        })
        .catch(() => {
          if (id === quoteReqId.current) setQuote(null);
        });
    }, 250);
    return () => clearTimeout(t);
    // quoteKey encodes every price-affecting input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey, boatId]);

  /** Release every held cabin (best-effort) and clear the cart + countdown. */
  const releaseAll = async (selections: Selection[]) => {
    await Promise.all(
      selections.map((p) =>
        api.post(`/booking/hold/${p.holdId}/release`).catch(() => undefined),
      ),
    );
  };

  async function toggle(cabin: { id: string; name: string }) {
    if (busy || holding || !activeId) return;
    const existing = picked.find((p) => p.cabinId === cabin.id);

    // Deselect → release the hold immediately so the cabin frees for everyone.
    if (existing) {
      setError(null);
      await api.post(`/booking/hold/${existing.holdId}/release`).catch(() => undefined);
      setPicked((prev) => {
        const next = prev.filter((p) => p.cabinId !== cabin.id);
        if (next.length === 0) setHoldExpiresAt(null);
        return next;
      });
      seededHolds.mutate();
      return;
    }

    // Select → take a real hold now; the returned expires_at drives the timer.
    setHolding(cabin.id);
    setError(null);
    setDone(null);
    try {
      const res = await api.post<{ id: string; expiresAt: string }>('/booking/hold', {
        cabinId: cabin.id,
        departureId: activeId,
      });
      setPicked((prev) => [
        ...prev,
        {
          cabinId: cabin.id,
          name: cabin.name,
          adults: 2,
          children: 0,
          childAges: [],
          holdId: res.data.id,
        },
      ]);
      // Holds share one cart expiry — the newest wins for the whole cart.
      setHoldExpiresAt(res.data.expiresAt);
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          'That cabin was just taken by someone else. Pick another.',
        ),
      );
      seededHolds.mutate();
    } finally {
      setHolding(null);
    }
  }

  function setCount(cabinId: string, key: 'adults' | 'children', value: number) {
    const next = Math.max(0, value);
    // Headcount change re-evaluates the rate: drop the latched manual flag and
    // any stale override so the new tier is priced fresh (the quote re-latches
    // manual pricing if the new headcount is also unpriced).
    setPicked((prev) =>
      prev.map((p) => {
        if (p.cabinId !== cabinId) return p;
        const patched: Selection = {
          ...p,
          [key]: next,
          manualPrice: false,
          priceOverride: undefined,
        };
        // Lowering the child count drops the trailing age inputs so a stale age
        // can't keep pricing a child who's no longer in the party.
        if (key === 'children') patched.childAges = p.childAges.slice(0, next);
        return patched;
      }),
    );
  }

  /** Set one child's age (undefined while the field is empty). */
  function setChildAge(cabinId: string, index: number, value: number | undefined) {
    setPicked((prev) =>
      prev.map((p) => {
        if (p.cabinId !== cabinId) return p;
        const ages = [...p.childAges];
        ages[index] = value as number;
        return { ...p, childAges: ages };
      }),
    );
  }

  function setOverride(cabinId: string, value: string) {
    const clean = numStr(value);
    const n = clean === '' ? undefined : Math.max(0, Number(clean));
    setPicked((prev) =>
      prev.map((p) => (p.cabinId === cabinId ? { ...p, priceOverride: n } : p)),
    );
  }

  // Per-cabin price + priced flag from the latest quote, keyed for the cart.
  const priceByCabin = useMemo(() => {
    const m = new Map<string, { roomPrice: string; priced: boolean }>();
    for (const c of quote?.perCabin ?? []) {
      m.set(c.cabinId, { roomPrice: c.roomPrice, priced: c.priced });
    }
    return m;
  }, [quote]);

  // A cabin that needs a manual price but doesn't have one yet — the sale can't
  // be confirmed until every such cabin has a price typed in.
  const unpricedCabin = picked.find(
    (p) => p.manualPrice && (p.priceOverride === undefined || p.priceOverride <= 0),
  );

  // A cabin with children whose ages aren't all filled in. The server prices
  // each child from its age, so quoting now would show a total that changes as
  // soon as the operator finishes typing — hold the quote (and the sale) until
  // every age is entered.
  const needsChildAges = picked.some((p) => {
    for (let i = 0; i < p.children; i++) {
      const age = p.childAges[i];
      if (age === undefined || age === null || Number.isNaN(age)) return true;
    }
    return false;
  });

  const total = quote ? Number(quote.displayTotal) : 0;
  // Paid starts empty (0) — the owner types what the customer actually handed
  // over, which may legitimately be 0. Due is the remainder.
  const paidStr = amountPaid;
  const paidNum = paidStr === '' ? 0 : Math.max(0, Number(paidStr));
  const dueNum = Math.max(0, total - paidNum);
  // Guard against overpayment: the backend rejects amountPaid > displayTotal, so
  // block the sale here (rather than silently clamping, which would leave the
  // typed value disagreeing with what's charged) and tell the operator why.
  // `total > 0` avoids a false block before the quote has priced the cart.
  const overpaid = total > 0 && paidNum > total;

  // Changing the date/departure while cabins are held would strand those holds
  // (they'd tick down invisibly on the old departure). Release them first.
  const clearHeldForFilterChange = () => {
    if (picked.length > 0) void releaseAll(picked);
    setPicked([]);
    setHoldExpiresAt(null);
    setQuote(null);
    setDiscount('');
    setAmountPaid('');
    setError(null);
  };

  async function submit(e: React.FormEvent, attachToExisting = false) {
    e.preventDefault();
    if (busy || picked.length === 0 || !activeId) return;
    if (unpricedCabin) {
      setError(`Set a price for cabin ${unpricedCabin.name} before confirming.`);
      return;
    }
    if (needsChildAges) {
      setError('Enter every child’s age before confirming — each is priced from it.');
      return;
    }
    if (overpaid) {
      setError(`Paid can't exceed the total (${money(total.toFixed(2))}).`);
      return;
    }
    setBusy(true);
    setError(null);
    setDone(null);
    if (!attachToExisting) setAttachConflict(false);
    try {
      const res = await api.post<{
        booking: { id: string };
        invoice?: { id: string } | null;
        paymentFailed?: boolean;
      }>(
        `/houseboats/${boatId}/pos/bookings`,
        {
          departureId: activeId,
          customerName,
          customerPhone: toE164(customerPhone),
          // Convert the holds already taken on select — do NOT re-hold.
          holds: picked.map((p) => ({
            cabinId: p.cabinId,
            holdId: p.holdId,
            adults: p.adults,
            children: p.children || undefined,
            childAges: p.children > 0 ? p.childAges.slice(0, p.children) : undefined,
            priceOverride: p.priceOverride,
          })),
          couponCode: couponCode || undefined,
          referenceName: referenceName || undefined,
          specialInstructions: note || undefined,
          paymentMethod,
          discount: discount ? Number(discount) : undefined,
          // What the customer actually handed over. Send the resolved paid value
          // (defaults to the full total unless the operator edited it).
          amountPaid: paidNum,
          // Confirm attaching to a pre-existing account under a different name.
          attachToExisting: attachToExisting || undefined,
        },
      );
      // The sale committed; warn if the payment line failed to record so it isn't
      // silently lost (the booking still exists and the invoice stays due).
      if (res.data.paymentFailed) {
        setError(
          'Sale created, but the payment did NOT record. Re-record it on the Departure page.',
        );
      }
      setDone(res.data.booking.id);
      setAttachConflict(false);
      setPicked([]);
      setHoldExpiresAt(null);
      setCustomerName('');
      setCustomerPhone('');
      setCouponCode('');
      setReferenceName('');
      setNote('');
      setPaymentMethod('cash');
      setDiscount('');
      setAmountPaid('');
      setQuote(null);
      await Promise.all([taken.mutate(), departures.mutate(), seededHolds.mutate()]);
    } catch (err) {
      // 409 = the phone already belongs to a customer under a different name.
      // Offer to attach rather than silently booking onto a stranger.
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409 && !attachToExisting) {
        setAttachConflict(true);
        setError(
          apiErrorMessage(
            err,
            'This phone already belongs to a customer under a different name.',
          ),
        );
      } else {
        setError(
          apiErrorMessage(
            err,
            'Could not complete the sale. A cabin may have just been taken — re-check the layout.',
          ),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  const countdown = holdExpiresAt
    ? `${String(Math.floor(remainingMs / 60000)).padStart(2, '0')}:${String(
        Math.floor((remainingMs % 60000) / 1000),
      ).padStart(2, '0')}`
    : null;

  return (
    <>
      <PageHead
        title="Counter sale"
        desc="Sell a cabin to someone standing at the ghat. The guest gets an account on their phone number, and the booking is identical to an online one."
      />

      {done ? (
        <Note kind="ok" style={{ marginBottom: 18 }}>
          Sale complete. Any payment you entered is recorded now; collect and record any
          remaining due on the Departure page.
        </Note>
      ) : null}
      {error ? (
        <Note kind="danger" style={{ marginBottom: 18 }}>
          {error}
          {attachConflict ? (
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                className={`${BTN_B} ${BTN_SM}`}
                disabled={busy}
                onClick={(ev) => submit(ev, true)}
              >
                Attach to existing customer &amp; confirm sale
              </button>
            </div>
          ) : null}
        </Note>
      ) : null}

      <FilterBar>
        <input
          type="date"
          aria-label="Filter departures by date"
          value={day}
          onChange={(e) => {
            daySeeded.current = true;
            clearHeldForFilterChange();
            setDay(e.target.value);
            setDepartureId('');
          }}
        />
        <select
          aria-label="Departure date"
          value={activeId}
          onChange={(e) => {
            daySeeded.current = true;
            clearHeldForFilterChange();
            setDepartureId(e.target.value);
          }}
          disabled={bookable.length === 0}
        >
          {bookable.length === 0 ? <option value="">No departures</option> : null}
          {bookable.map((d) => (
            <option key={d.id} value={d.id}>
              {weekday(d.startDate)} {formatDate(d.startDate)} · {d.availableCount} free
            </option>
          ))}
        </select>
        {day ? (
          <button
            type="button"
            className={`${BTN_O} ${BTN_SM}`}
            onClick={() => {
              daySeeded.current = true;
              clearHeldForFilterChange();
              setDay('');
              setDepartureId('');
            }}
          >
            All dates
          </button>
        ) : null}
      </FilterBar>

      <AsyncBlock
        isLoading={departures.isLoading}
        error={departures.error}
        isEmpty={bookable.length === 0}
        onRetry={() => departures.mutate()}
        empty={
          <Note kind="warn">
            No bookable departures{day ? ' on this date' : ''}. Set a weekly schedule to
            generate them.
          </Note>
        }
      >
        <div className="grid grid-cols-[2fr_1fr] items-start gap-5 max-[1024px]:grid-cols-1">
          <Card
            title="Cabin layout"
            sub={
              active
                ? `${active.package.durationLabel ?? 'Trip'} · ${formatDate(active.startDate)}`
                : undefined
            }
          >
            <AsyncBlock
              isLoading={boat.isLoading}
              error={boat.error}
              isEmpty={!hasCabins}
              onRetry={() => boat.mutate()}
              empty={
                <Note kind="warn">
                  This boat has no cabins yet. Add decks and cabins from Boat setup.
                </Note>
              }
            >
              <BoatCabinMap decks={decks} onSelect={toggle} />
              <Note kind="info" style={{ marginTop: 14 }}>
                Tapping a free cabin holds it for 10 minutes — it shows as held to every
                other operator at once, so no one can sell it twice. Tap it again to release
                it. Complete the sale before the timer runs out, or the hold is released.
              </Note>
            </AsyncBlock>
          </Card>

          <Card title={`Cart${picked.length ? ` · ${picked.length} cabin(s)` : ''}`}>
            <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
              {countdown ? (
                <Note kind={remainingMs < 60000 ? 'danger' : 'warn'}>
                  Hold expires in{' '}
                  <b style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--danger)' }}>{countdown}</b>. Complete
                  the sale before it runs out, or the cabins are released.
                </Note>
              ) : null}
              {picked.length === 0 ? (
                <Note kind="info">Tap a free cabin on the layout to hold it (10 min).</Note>
              ) : (
                picked.map((p) => (
                  <div
                    key={p.cabinId}
                    style={{
                      border: '1px solid var(--hair)',
                      borderRadius: 'var(--r)',
                      padding: 12,
                      display: 'grid',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <b>Cabin {p.name}</b>
                      <button
                        type="button"
                        className={`${BTN_O} ${BTN_SM}`}
                        onClick={() => toggle({ id: p.cabinId, name: p.name })}
                      >
                        Remove
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <Field label="Adults">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={p.adults}
                          onChange={(e) =>
                            setCount(p.cabinId, 'adults', digits(e.target.value))
                          }
                        />
                      </Field>
                      <Field label="Children">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={p.children}
                          onChange={(e) =>
                            setCount(p.cabinId, 'children', digits(e.target.value))
                          }
                        />
                      </Field>
                    </div>
                    {p.children > 0 ? (
                      // One age per child, priced against the boat's child_policy —
                      // the same rule the customer flow uses, so a child costs the
                      // same at the counter as online.
                      <div style={{ display: 'grid', gap: 8 }}>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>
                          Child fares: {childPolicyText}
                        </div>
                        {Array.from({ length: p.children }).map((_, i) => {
                          const raw = p.childAges[i];
                          const typed =
                            raw !== undefined && raw !== null && !Number.isNaN(raw);
                          const charge = typed
                            ? chargeForAge(childPolicy, raw)
                            : null;
                          return (
                            <div
                              key={i}
                              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                            >
                              <input
                                type="number"
                                min={0}
                                max={childAgeMax}
                                placeholder={`Child ${i + 1} age`}
                                value={raw ?? ''}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  // Empty clears the entry rather than becoming 0,
                                  // which is a real age here.
                                  setChildAge(
                                    p.cabinId,
                                    i,
                                    v === '' ? undefined : Number(v),
                                  );
                                }}
                                aria-label={`Cabin ${p.name} child ${i + 1} age`}
                                style={{ width: 96 }}
                              />
                              {charge ? (
                                charge.matched ? (
                                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ok)' }}>
                                    {chargeLabel(charge.pct)}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--amber-700, var(--amber))' }}>
                                    No child rate for age {raw} — charged full fare.
                                  </span>
                                )
                              ) : (
                                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)' }}>
                                  Enter age to price
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    {p.manualPrice ? (
                      // No rate configured for this headcount → let the owner type
                      // one. Kept mounted (keyed on cabinId only) so it stays
                      // editable while the quote refreshes.
                      <Field label="Price (no rate set for this headcount — enter manually)">
                        <div className="with-pre">
                          <span className="pre">৳</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={p.priceOverride ?? ''}
                            onChange={(e) => setOverride(p.cabinId, e.target.value)}
                            placeholder="Set price"
                          />
                        </div>
                      </Field>
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          color: 'var(--muted)',
                        }}
                      >
                        <span>Room price</span>
                        <b>
                          {priceByCabin.get(p.cabinId)
                            ? money(priceByCabin.get(p.cabinId)!.roomPrice)
                            : '…'}
                        </b>
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* Guest identity */}
              <Field label="Lead guest name">
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Farhana Akter"
                  required
                />
              </Field>

              <Field label="Phone">
                <input
                  type="tel"
                  inputMode="numeric"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="01711222290"
                  required
                />
              </Field>

              {/* Money: coupon/reference → discount → total → paid → due */}
              {picked.length > 0 ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Field label="Coupon code">
                      <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} />
                    </Field>
                    <Field label="Reference">
                      <input
                        value={referenceName}
                        onChange={(e) => setReferenceName(e.target.value)}
                        placeholder="Who sent them"
                        maxLength={20}
                      />
                    </Field>
                  </div>

                  <Field label="Discount">
                    <div className="with-pre">
                      <span className="pre">৳</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={discount}
                        onChange={(e) => setDiscount(numStr(e.target.value))}
                        placeholder="0"
                      />
                    </div>
                  </Field>

                  {needsChildAges ? (
                    <Note kind="info">
                      Enter each child’s age to see the price — every child is
                      priced from its age.
                    </Note>
                  ) : null}

                  <Bill
                    rows={[
                      ...(quote && Number(quote.discountAmount) > 0
                        ? [
                            {
                              label: 'Discount',
                              value: quote.discountAmount,
                              negative: true,
                            },
                          ]
                        : []),
                      { label: 'Total (customer pays)', value: total, total: true },
                    ]}
                  />

                  <Field label="Paid now">
                    <div className="with-pre">
                      <span className="pre">৳</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={paidStr}
                        onChange={(e) => setAmountPaid(numStr(e.target.value))}
                        placeholder="0"
                      />
                    </div>
                  </Field>

                  <Bill rows={[{ label: 'Due', value: dueNum, total: true }]} />

                  {overpaid ? (
                    <Note kind="danger">
                      Paid can’t exceed the total ({money(total.toFixed(2))}). Lower it to
                      continue.
                    </Note>
                  ) : null}
                </>
              ) : null}

              {/* How the guest pays */}
              <Field label="Payment method">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      type="button"
                      key={m.value}
                      className={`${paymentMethod === m.value ? BTN_B : BTN_O} ${BTN_SM}`}
                      onClick={() => setPaymentMethod(m.value)}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </Field>

              {/* Requirements note last */}
              <Field label="Note (customer requirement)">
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Early check-in, halal-only meals, ground-floor cabin…"
                />
              </Field>

              <button
                className={BTN_B}
                type="submit"
                disabled={
                  busy ||
                  picked.length === 0 ||
                  Boolean(unpricedCabin) ||
                  needsChildAges ||
                  overpaid
                }
                style={{ justifyContent: 'center' }}
              >
                {busy ? 'Completing…' : 'Confirm sale →'}
              </button>

              <Note kind="warn">
                Payment taken here is your own money, not part of the platform payout. What
                you enter in “Paid now” is recorded against the invoice on confirm; collect
                any remaining due later on the Departure page.
              </Note>
            </form>
          </Card>
        </div>
      </AsyncBlock>
    </>
  );
}
