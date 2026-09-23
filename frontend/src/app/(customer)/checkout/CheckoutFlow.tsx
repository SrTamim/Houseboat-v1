'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import {
  money,
  apiErrorMessage,
  formatDate,
  formatTime,
} from '@/lib/owner/format';
import { useAuthModal } from '@/components/customer/AuthModalProvider';
import { useHoldHeartbeat } from '@/lib/customer/useHoldHeartbeat';
import {
  DARK_CARD_SURFACE,
  PRIMARY_BTN,
  photoFor,
} from '@/lib/customer/boat-card';
import type { Hold, Quote } from '@/lib/customer/types';
import type { StoredSelection } from '../boat/[slug]/BoatBooking';

const SELECTION_KEY = 'hb-selection';

/** POST /booking/checkout + /group-checkout both return { booking, invoice }. */
interface CheckoutResult {
  booking: { id: string };
  invoice: { id: string };
}

/** Cabin checkout now returns a priced intent, not a booking (audit M-H2). */
interface CheckoutIntent {
  intentId: string;
  displayTotal: string;
  minDeposit: string;
  fullAmount: string;
}

type PayChoice = 'advance' | 'full';

// ---- design tokens (haorboat-checkout.html, v2 craft pass) ----------------
// Colours/radii/shadows resolve through the CSS vars in customer.css, so these
// switch with [data-theme] without a `dark:` variant each.
const CARD = `mb-5 rounded-2xl border border-hair bg-raise-1 px-[26px] py-6 shadow-e1 ${DARK_CARD_SURFACE}`;
const CARD_H2 =
  'flex items-center gap-[9px] font-display text-lg font-semibold text-ink';
const CARD_SUB =
  'mb-[18px] mt-1 text-[13px] text-muted max-[940px]:mb-3 max-[940px]:text-[12px]';

/**
 * Left-column density. Identity, coupon and requests are supporting fields
 * rather than the main event, so they run tighter than the booking summary —
 * which keeps the full-size CARD above.
 *
 * LABEL and INPUT are not duplicated because every one of their call sites is
 * in this column; they are simply sized for it.
 */
const CARD_SM = `mb-4 rounded-2xl border border-hair bg-raise-1 px-5 py-[18px] shadow-e1 max-[940px]:mb-3 max-[940px]:px-3.5 max-[940px]:py-3 ${DARK_CARD_SURFACE}`;
const CARD_H2_SM =
  'flex items-center gap-2 font-display text-[15px] font-semibold text-ink max-[940px]:text-[13.5px]';
const LABEL = 'mb-1 block text-xs font-bold text-ink';
const INPUT =
  'w-full rounded border border-hair bg-bg px-3 py-2 text-sm text-ink transition-[border-color,box-shadow] duration-150 placeholder:text-muted focus:border-blue focus:bg-raise-1 focus:shadow-[0_0_0_3px_var(--blue-050)] focus:outline-none';

/**
 * Sign-in actions at the left column's scale. A separate constant rather than
 * `${PRIMARY_BTN} py-2.5`: there is no tailwind-merge here, so appending a
 * conflicting utility leaves the winner down to stylesheet order, not the
 * className. PRIMARY_BTN itself is shared with the boat page and auth modal.
 */
const AUTH_BTN_B =
  'inline-flex w-full items-center justify-center gap-2 rounded border border-transparent bg-blue px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--e1),inset_0_1px_0_rgba(255,255,255,.18)] transition-[background,transform] duration-dur ease-ease hover:bg-blue-600 active:translate-y-[.5px] disabled:cursor-not-allowed disabled:opacity-55 max-[940px]:py-2';
const AUTH_BTN_O =
  'mt-2 inline-flex w-full items-center justify-center rounded border border-hair bg-raise-1 px-5 py-2.5 text-sm font-semibold text-ink transition-colors duration-150 hover:border-blue hover:text-blue max-[940px]:py-2';
const GRID2 = 'grid grid-cols-2 gap-4 max-[560px]:grid-cols-1';
const SUMMARY_ROW = 'flex justify-between py-[5px] text-sm text-bodytext';

/**
 * Drives the real checkout: restore selection → extend the cabin holds →
 * (require login) → POST /booking/checkout → settle the invoice → confirmation.
 *
 * The payment gateway is not configured yet, so settlement goes through
 * /gateway/sslcommerz/dev/settle (server-gated on PAYMENTS_BYPASS) instead of
 * the hosted page. The SSLCommerz path is still in place for the switch back.
 *
 * All prices come from the server: the stored quote, or a re-quote when a
 * coupon is applied. The client never recomputes a fare — the only arithmetic
 * here is splitting the total in half for the advance option.
 *
 * Markup is a Tailwind rebuild of design-previews/customer/haorboat-checkout.html
 * — no legacy `customer.css` class names.
 */
export function CheckoutFlow({
  signedIn,
  defaultName,
  defaultPhone,
  defaultEmail,
}: {
  signedIn: boolean;
  defaultName: string;
  defaultPhone: string;
  defaultEmail: string;
}) {
  const { openAuth } = useAuthModal();
  const [selection, setSelection] = useState<StoredSelection | null>(null);
  // null = untouched, so a value arriving LATER still lands. Signing in uses the
  // auth modal, whose onSuccess calls router.refresh(): that re-runs the server
  // component and delivers fresh defaults, but does NOT remount this component.
  // A useState initialiser would have already run against the signed-out empty
  // strings and would never see them. Same idiom as account/profile/page.tsx.
  const [nameEdit, setNameEdit] = useState<string | null>(null);
  const [phoneEdit, setPhoneEdit] = useState<string | null>(null);
  const [emailEdit, setEmailEdit] = useState<string | null>(null);
  /**
   * Whether the account holder is the person travelling. Unchecking blanks the
   * identity fields so a third-party booking starts empty rather than
   * submitting the payer's details onto someone else's boarding record.
   */
  const [bookingForSelf, setBookingForSelf] = useState(true);
  const [coupon, setCoupon] = useState('');
  const [reference, setReference] = useState('');
  const [instructions, setInstructions] = useState('');
  const [payChoice, setPayChoice] = useState<PayChoice>('advance');
  const [agree, setAgree] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Server expiry for the held cabins, after the checkout extension. */
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null);
  const [holdLapsed, setHoldLapsed] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);
  /** Re-quote from an applied coupon; replaces the stored totals when present. */
  const [couponQuote, setCouponQuote] = useState<Quote | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  // A local edit wins; anything untouched follows the account. When the booking
  // is for someone else the account values are not a sensible default, so the
  // fields fall back to empty instead.
  const identityFallback = bookingForSelf
    ? { name: defaultName, phone: defaultPhone, email: defaultEmail }
    : { name: '', phone: '', email: '' };
  const name = nameEdit ?? identityFallback.name;
  const phone = phoneEdit ?? identityFallback.phone;
  const email = emailEdit ?? identityFallback.email;

  /**
   * Identity is read off the session, not typed: a signed-in guest booking for
   * themselves sees a read-only strip. Only the "someone else" path opens
   * inputs. `defaultName` can be empty on a legacy row (Account.name is still
   * nullable), so the phone carries the strip on its own in that case.
   */
  const showIdentitySummary = signedIn && bookingForSelf && !!defaultPhone;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SELECTION_KEY);
      if (raw) setSelection(JSON.parse(raw) as StoredSelection);
    } catch {}
  }, []);

  // Buy the guest time to fill this form. The cabins were held for 10 minutes
  // on the boat page and some of that is already spent, so reaching checkout
  // grants ONE +10 min extension on the time remaining. The server stamps
  // extended_at, so reloading this page re-requests it and simply gets the
  // unchanged expiry back — the hold cannot be renewed indefinitely.
  //
  // Group buyouts are not built from per-cabin holds, so there is nothing to
  // extend for them.
  const departureId = selection?.kind === 'group' ? null : selection?.departureId;

  // Keep this page's holds alive while the guest fills in the form. Without it
  // the server's grace window would reclaim them out from under a backgrounded
  // tab and Pay would fail with "a held cabin expired or was taken".
  useHoldHeartbeat(departureId ?? null, !!departureId && !holdLapsed);

  // Leaving checkout without paying frees the cabins immediately, rather than
  // waiting for the heartbeat to lapse. Covers Back and any in-app navigation,
  // which is the common case and — unlike an unload event — always runs.
  //
  // The ref is the important part: once a booking attempt starts, these holds are
  // being converted into a real booking, and releasing them would destroy the
  // guest's own paid reservation. Tab-close needs nothing here; the heartbeat
  // simply stops and the sweeper reclaims.
  const convertingRef = useRef(false);
  const releaseTargetsRef = useRef<string[]>([]);
  releaseTargetsRef.current =
    selection?.kind === 'cabin'
      ? selection.cabins.map((c) => c.holdId).filter((id): id is string => !!id)
      : [];

  useEffect(() => {
    return () => {
      if (convertingRef.current) return; // paying — hands off
      const ids = releaseTargetsRef.current;
      if (ids.length === 0) return;
      ids.forEach((holdId) => {
        void api.post(`/booking/hold/${holdId}/release`).catch(() => {});
      });
      // The stored cart now points at released holds; drop it so a return trip
      // starts from a fresh selection instead of dead holdIds.
      try {
        sessionStorage.removeItem(SELECTION_KEY);
      } catch {}
    };
  }, []);
  useEffect(() => {
    if (!departureId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.post<{ expiresAt: string }>(
          `/booking/departures/${departureId}/extend-holds`,
        );
        if (!cancelled) setHoldExpiresAt(data.expiresAt);
      } catch {
        // 409 = nothing live left to extend. Say so up front instead of
        // letting Pay fail later with a confusing server error.
        if (!cancelled) setHoldLapsed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [departureId]);

  // Count down to the SERVER's expiry — an absolute timestamp, so a throttled
  // background tab is still correct when it wakes. Same pattern as the boat page.
  useEffect(() => {
    if (!holdExpiresAt) return;
    const tick = () => {
      const ms = new Date(holdExpiresAt).getTime() - Date.now();
      setRemainingMs(Math.max(0, ms));
      if (ms <= 0) setHoldLapsed(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [holdExpiresAt]);

  // Split rather than formatted: the banner renders minutes and seconds as two
  // separate tiles. Derived from the same `remainingMs` the interval above
  // maintains — no second timer.
  const countdown = holdExpiresAt && !holdLapsed;
  const countdownMm = String(Math.floor(remainingMs / 60000)).padStart(2, '0');
  const countdownSs = String(Math.floor((remainingMs % 60000) / 1000)).padStart(
    2,
    '0',
  );

  if (!selection) {
    return (
      <section className="mx-auto max-w-wrap px-6 pb-[60px] pt-3.5">
        <div className={`${CARD} max-w-[520px]`}>
          <h2 className={CARD_H2}>🧺 Your cart is empty</h2>
          <p className={CARD_SUB}>
            Pick cabins on a boat first, then come back to check out.
          </p>
          <a className={`${PRIMARY_BTN} w-auto`} href="/search">
            Find a houseboat
          </a>
        </div>
      </section>
    );
  }

  // Totals: the coupon re-quote wins when one has been applied, otherwise the
  // figures the boat page stored. Never recomputed from cabin prices here.
  const grand = Number(couponQuote?.displayTotal ?? selection.displayTotal);
  const roomTotal = couponQuote?.roomTotal ?? selection.roomTotal;
  const discount = Number(couponQuote?.discountAmount ?? selection.discountAmount ?? 0);
  const advance = Math.round(grand / 2);
  const payNow = payChoice === 'advance' ? advance : grand;
  const dueLater = grand - payNow;

  const guests = selection.cabins.reduce((n, c) => n + c.adults + c.children, 0);
  const adults = selection.cabins.reduce((n, c) => n + c.adults, 0);
  const children = selection.cabins.reduce((n, c) => n + c.children, 0);
  const nights = selection.trip
    ? Math.max(1, selection.trip.durationDays - 1)
    : null;

  /**
   * Validate a coupon by re-quoting. There is no standalone coupon endpoint —
   * POST /booking/quote is the validator, and an unknown code is not an error:
   * it comes back couponApplied:false, which drives the ✗ hint.
   */
  const applyCoupon = async () => {
    const code = coupon.trim();
    if (!code || selection.kind === 'group') return;
    setCouponBusy(true);
    setCouponMsg(null);
    try {
      const { data } = await api.post<Quote>('/booking/quote', {
        departureId: selection.departureId,
        cabins: selection.cabins.map((c) => ({
          cabinId: c.cabinId,
          adults: c.adults,
          children: c.children,
          childAges: c.childAges.slice(0, c.children),
        })),
        couponCode: code,
      });
      if (data.couponApplied) {
        setCouponQuote(data);
        setCouponMsg({
          ok: true,
          text: `✓ ${code} applied — ${money(data.discountAmount)} off`,
        });
      } else {
        setCouponQuote(null);
        setCouponMsg({ ok: false, text: `✗ ${code} is not valid for this trip.` });
      }
    } catch (e) {
      setCouponQuote(null);
      setCouponMsg({
        ok: false,
        text: apiErrorMessage(e, 'Could not check that coupon.'),
      });
    } finally {
      setCouponBusy(false);
    }
  };

  const pay = async () => {
    setError(null);
    // The cabins are gone — checkout would fail server-side anyway (the
    // conversion filters on expires_at). Send them back to pick again rather
    // than through the form.
    if (holdLapsed) {
      setError('Your cabin hold expired. Please pick your cabins again.');
      return;
    }
    // Login wall. Opens the modal in place rather than navigating: the form
    // state and the live cabin holds both survive, and router.refresh() flips
    // `signedIn` once they're in, so they can hit Pay again right away.
    if (!signedIn) {
      openAuth('login', { reason: 'login_required' });
      return;
    }
    if (!agree) {
      setError('Please accept the terms to continue.');
      return;
    }
    if (!name.trim() || !phone.trim()) {
      setError('Name and phone are required.');
      return;
    }

    setBusy(true);
    try {
      // From here on the holds belong to a booking attempt, so the unmount
      // cleanup must never release them. Set BEFORE the conversion request, not
      // after the redirect: once /booking/checkout succeeds the holds are already
      // 'converted', and releasing them (or navigating away mid-flight) would
      // break the customer's own paid booking.
      convertingRef.current = true;

      // The payment target: a group booking is created immediately (invoice), a
      // cabin booking is deferred behind its deposit (intent). Exactly one is set.
      let settleBody: { invoiceId: string } | { intentId: string };

      if (selection.kind === 'group') {
        const { data } = await api.post<CheckoutResult>('/booking/group-checkout', {
          departureId: selection.departureId,
          headcount: selection.groupHeadcount,
          leadGuestName: name,
          leadGuestPhone: phone,
          leadGuestEmail: email.trim() || undefined,
          specialInstructions: instructions || undefined,
          referenceName: reference || undefined,
        });
        settleBody = { invoiceId: data.invoice.id };
      } else {
        // The boat page normally already holds each cabin and passes the holdId
        // through the stored selection — reuse it. Re-holding a cabin we already
        // hold would trip the partial unique index and surface as "that cabin
        // was just taken" about our own hold. Only cabins without one (an older
        // selection, or a hold that lapsed) are held here.
        const holds: { cabinId: string; holdId: string }[] = [];
        for (const c of selection.cabins) {
          if (c.holdId) {
            holds.push({ cabinId: c.cabinId, holdId: c.holdId });
            continue;
          }
          const { data } = await api.post<Hold>('/booking/hold', {
            cabinId: c.cabinId,
            departureId: selection.departureId,
          });
          holds.push({ cabinId: c.cabinId, holdId: data.id });
        }
        // Checkout no longer creates the booking — it prices the selection into a
        // BookingIntent (audit M-H2). The booking is created only when the deposit
        // settles below. Cabins stay reserved by their live holds until then.
        const { data } = await api.post<CheckoutIntent>('/booking/checkout', {
          departureId: selection.departureId,
          cabins: selection.cabins.map((c) => ({
            cabinId: c.cabinId,
            holdId: holds.find((h) => h.cabinId === c.cabinId)!.holdId,
            adults: c.adults,
            children: c.children,
            childAges: c.childAges.slice(0, c.children),
          })),
          leadGuestName: name,
          leadGuestPhone: phone,
          leadGuestEmail: email.trim() || undefined,
          couponCode: coupon || undefined,
          referenceName: reference || undefined,
          specialInstructions: instructions || undefined,
          paymentChoice: payChoice,
        });
        settleBody = { intentId: data.intentId };
      }

      // Settle the deposit. The gateway is not configured yet, so this records
      // the payment server-side; for an intent it also CREATES the booking, for a
      // group invoice it records against the existing one. Swapping back to the
      // hosted gateway reverts this to POST /gateway/sslcommerz/initiate +
      // assign(gatewayPageUrl) — that whole path (and its IPN) is untouched.
      //
      // For a 50% advance the amount is passed (server enforces the 50% floor for
      // intents); for full it is omitted and the server settles the whole total.
      const { data: settled } = await api.post<{ invoiceId: string }>(
        '/gateway/sslcommerz/dev/settle',
        {
          ...settleBody,
          ...(payChoice === 'advance' ? { amount: advance } : {}),
        },
      );
      const invoiceId = settled.invoiceId;

      try {
        sessionStorage.removeItem(SELECTION_KEY);
      } catch {}
      // Full-page navigation so the confirmation page mounts fresh rather than
      // inheriting this component's state. It polls the invoice from the server.
      window.location.assign(`/booking/payment-return?invoice=${invoiceId}`);
    } catch (e) {
      // The attempt failed and the guest stays on this page with their holds
      // intact, so hand them back to the cleanup — otherwise abandoning after a
      // failed payment would leak the cabins again.
      convertingRef.current = false;
      setError(apiErrorMessage(e, 'Checkout failed. Please try again.'));
      setBusy(false);
    }
  };

  const payLabel = busy
    ? 'Processing…'
    : holdLapsed
      ? 'Hold expired'
      : signedIn
        ? `Pay & confirm · ৳ ${money(payNow)}`
        : 'Log in to continue';

  return (
    <section>
      {/* Reservation banner — full width above both columns, so the urgency
          reads at a glance instead of hiding in a paragraph. */}
      {holdLapsed || countdown ? (
        <div className="mx-auto max-w-wrap px-6 pt-3.5">
          {holdLapsed ? (
            <div
              role="status"
              className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-danger px-5 py-3.5 max-[940px]:mb-3 max-[940px]:gap-2 max-[940px]:px-3.5 max-[940px]:py-2.5"
            >
              <span className="text-[15px] font-bold text-white max-[940px]:text-[13px]">
                Cabin hold expired — your seats were released.
              </span>
              <a
                className="rounded-lg bg-white/15 px-3.5 py-1.5 text-sm font-bold text-white underline-offset-2 hover:underline"
                href={`/boat/${selection.slug}`}
              >
                Pick again →
              </a>
            </div>
          ) : (
            /* The bar is amber in BOTH themes, so its contents use fixed
               colours rather than the ink token: `--ink` flips to near-white
               in dark mode, which left white-on-amber text and washed-out
               tiles. */
            <div
              role="status"
              className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-amber px-5 py-3.5 max-[940px]:mb-3 max-[940px]:gap-2 max-[940px]:px-3.5 max-[940px]:py-2.5"
            >
              <span className="text-[15px] font-bold text-[#111725] max-[940px]:text-[13px]">
                Seat reserved, Complete your payment in
              </span>
              <span className="flex items-center gap-1.5">
                <b className="rounded-lg bg-[#111725] px-2.5 py-1.5 font-display text-lg font-black tabular-nums text-white max-[940px]:px-2 max-[940px]:py-1 max-[940px]:text-base">
                  {countdownMm}
                </b>
                <span className="font-display text-lg font-black text-[#111725] max-[940px]:text-base">
                  :
                </span>
                <b className="rounded-lg bg-[#111725] px-2.5 py-1.5 font-display text-lg font-black tabular-nums text-white max-[940px]:px-2 max-[940px]:py-1 max-[940px]:text-base">
                  {countdownSs}
                </b>
              </span>
            </div>
          )}
        </div>
      ) : null}

      {/* 40 / 60: identity + extras are read-only or optional, so the booking
          and payment detail gets the room. minmax(0,…) on both tracks stops a
          long boat name or price row widening past its share. */}
      <div className="mx-auto grid max-w-wrap grid-cols-[minmax(0,40fr)_minmax(0,60fr)] items-start gap-[30px] px-6 pb-[60px] pt-3.5 max-[940px]:grid-cols-1">
        {/* ---------- LEFT: guest details ---------- */}
        <div>

          {/* Signed out: identity comes from the account, so there is nothing
              to type — offer the way in instead. The modal opens in place, so
              the cabin holds, the countdown and anything already typed below
              all survive; router.refresh() then flips `signedIn` without a
              remount. */}
          {!signedIn ? (
            <div className={CARD_SM}>
              <h2 className={CARD_H2_SM}>🔐 Sign in to continue</h2>
              <div className={CARD_SUB}>
                Your cabins stay held while you sign in — we’ll take your details
                from your account.
              </div>
              <button
                type="button"
                className={AUTH_BTN_B}
                onClick={() => openAuth('login', { reason: 'login_required' })}
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => openAuth('register')}
                className={AUTH_BTN_O}
              >
                Create an account
              </button>
            </div>
          ) : (
            <div className={CARD_SM}>
              <h2 className={`${CARD_H2_SM} mb-3`}>👤 Your details</h2>

              {/* Booking for yourself: the account already holds this, so it
                  is confirmed rather than asked for. Only the "someone else"
                  path below opens inputs. */}
              {showIdentitySummary ? (
                <div className="mb-3 rounded border border-hair bg-bg px-3 py-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-[.05em] text-muted">
                    Booking as
                  </div>
                  {defaultName.trim() ? (
                    <div className="truncate text-[15px] font-bold text-ink">
                      {defaultName}
                    </div>
                  ) : null}
                  <div className="truncate text-[13px] text-bodytext">
                    {defaultPhone}
                  </div>
                  {defaultEmail ? (
                    <div className="truncate text-[13px] text-bodytext">
                      {defaultEmail}
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    <label className={LABEL} htmlFor="co-name">
                      Name <span className="text-danger">*</span>
                    </label>
                    <input
                      id="co-name"
                      className={INPUT}
                      type="text"
                      placeholder="Full name"
                      value={name}
                      onChange={(e) => setNameEdit(e.target.value)}
                    />
                  </div>

                  <div className={GRID2}>
                    <div className="mb-3">
                      <label className={LABEL} htmlFor="co-phone">
                        Phone number <span className="text-danger">*</span>
                      </label>
                      <input
                        id="co-phone"
                        className={INPUT}
                        type="tel"
                        placeholder="01XXXXXXXXX"
                        value={phone}
                        onChange={(e) => setPhoneEdit(e.target.value)}
                      />
                    </div>
                    <div className="mb-3">
                      <label className={LABEL} htmlFor="co-email">
                        Email
                      </label>
                      <input
                        id="co-email"
                        className={INPUT}
                        type="email"
                        placeholder="you@email.com"
                        value={email}
                        onChange={(e) => setEmailEdit(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* The booker is often not the traveller — the boarding list
                  needs whoever actually sails. This whole card is signed-in
                  only, so no further guard is needed. */}
              <label className="inline-flex cursor-pointer items-start gap-[9px] text-[13px] text-bodytext">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={bookingForSelf}
                  onChange={(e) => {
                    setBookingForSelf(e.target.checked);
                    // Clear the edits either way: going to "someone else" must
                    // not inherit the payer's identity, and coming back must
                    // restore the account's rather than keep the stranger's.
                    setNameEdit(null);
                    setPhoneEdit(null);
                    setEmailEdit(null);
                  }}
                />
                <span className="mt-px grid h-[19px] w-[19px] flex-none place-items-center rounded-[5px] border-[1.5px] border-muted text-xs text-white transition-all duration-150 peer-checked:border-blue peer-checked:bg-blue peer-checked:after:content-['✓']" />
                <span>I’m the lead guest travelling</span>
              </label>
            </div>
          )}

          {/* Coupon + reference. Stacked, not GRID2: side by side in this
              column they would be too narrow to read. */}
          <div className={CARD_SM}>
            {/* A coupon is priced by re-quoting, and buyouts have no quote
                path, so the field only appears for cabin bookings. */}
            {selection.kind === 'cabin' ? (
              <div className="mb-3">
                <label className={LABEL} htmlFor="co-coupon">
                  Coupon code
                </label>
                <div className="flex gap-2">
                  <input
                    id="co-coupon"
                    className={`${INPUT} flex-1`}
                    type="text"
                    placeholder="HAOR500"
                    value={coupon}
                    onChange={(e) => {
                      setCoupon(e.target.value.toUpperCase());
                      setCouponMsg(null);
                      // Drop the applied discount the moment the code is
                      // edited: the summary must never show a total priced
                      // from a different code than the one Pay will post.
                      setCouponQuote(null);
                    }}
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={couponBusy || !coupon.trim()}
                    className="flex-none rounded border border-hair bg-raise-1 px-4 text-[13.5px] font-bold text-blue transition-colors duration-150 hover:border-blue disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {couponBusy ? '…' : 'Apply'}
                  </button>
                </div>
                {couponMsg ? (
                  <div
                    className={`mt-[5px] text-xs font-bold ${
                      couponMsg.ok ? 'text-ok' : 'text-danger'
                    }`}
                  >
                    {couponMsg.text}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div>
              <label className={LABEL} htmlFor="co-ref">
                Reference (optional)
              </label>
              <input
                id="co-ref"
                className={INPUT}
                type="text"
                placeholder="Who referred you?"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>

          <div className={CARD_SM}>
            <h2 className={`${CARD_H2_SM} mb-3`}>💬 Special requests</h2>
            <textarea
              className={`${INPUT} min-h-[60px] resize-y max-[940px]:min-h-[52px]`}
              placeholder="e.g. one vegetarian meal plan, birthday cake on Day 2, ground-deck cabin for elderly guest…"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>
        </div>

        {/* ---------- RIGHT: trip summary + payment ---------- */}
        {/* Deliberately not sticky: pinning this column made it scroll at a
            different rate from the left one, so the two read as separate
            surfaces. The whole page moves together instead. */}
        <aside>
          <div className={`${CARD} mb-0`}>
            {/* boat header */}
            <div className="mb-4 flex items-center gap-3.5 border-b border-hair pb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selection.boatPhoto ?? photoFor(selection.slug)}
                alt={selection.boatName}
                className="h-14 w-[74px] flex-none rounded bg-bg object-cover"
              />
              <div className="min-w-0">
                <h3 className="truncate font-display text-base font-semibold text-ink">
                  {selection.boatName}
                </h3>
                {selection.trip?.routeName ? (
                  <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted">
                    📍 {selection.trip.routeName}
                    {selection.trip.routeRegion
                      ? ` · ${selection.trip.routeRegion}`
                      : ''}
                  </div>
                ) : null}
                {selection.ratingAvg != null ? (
                  <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted">
                    ⭐ {selection.ratingAvg.toFixed(1)} · Safety-verified
                  </div>
                ) : null}
              </div>
            </div>

            {/* trip meta */}
            {selection.trip ? (
              <div className="mb-4 grid gap-2 text-[13.5px]">
                <div className="flex items-center gap-[9px] text-bodytext">
                  📅{' '}
                  <span>
                    <b className="font-bold text-ink">
                      {formatDate(selection.trip.startDate)}
                      {selection.trip.endDate
                        ? ` – ${formatDate(selection.trip.endDate)}`
                        : ''}
                    </b>
                    {selection.trip.durationLabel
                      ? ` · ${selection.trip.durationLabel}`
                      : nights
                        ? ` · ${nights} night${nights > 1 ? 's' : ''}`
                        : ''}
                  </span>
                </div>
                {selection.trip.departureGhat ? (
                  <div className="flex items-center gap-[9px] text-bodytext">
                    ⚓{' '}
                    <span>
                      Boards <b className="font-bold text-ink">
                        {selection.trip.departureGhat}
                      </b>
                      {formatTime(selection.trip.departureTime)
                        ? ` · ${formatTime(selection.trip.departureTime)}`
                        : ''}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center gap-[9px] text-bodytext">
                  👥{' '}
                  <span>
                    <b className="font-bold text-ink">
                      {selection.kind === 'group'
                        ? `${selection.groupHeadcount} guests`
                        : `${guests} guest${guests === 1 ? '' : 's'}`}
                    </b>
                    {selection.kind === 'group'
                      ? ' · full boat'
                      : ` · ${selection.cabins.length} cabin${
                          selection.cabins.length === 1 ? '' : 's'
                        }`}
                    {children > 0 ? ` (${adults}A + ${children}C)` : ''}
                  </span>
                </div>
              </div>
            ) : null}

            {/* cabin lines */}
            {selection.kind === 'group' ? (
              <div className="flex justify-between border-t border-hair py-2 text-[13.5px]">
                <span className="text-bodytext">
                  <b className="text-ink">Full boat buyout</b>{' '}
                  <span className="text-xs text-muted">
                    {selection.groupHeadcount} guests
                  </span>
                </span>
                <em className="font-display font-bold not-italic text-ink">
                  ৳ {money(selection.displayTotal)}
                </em>
              </div>
            ) : (
              selection.cabins.map((c) => (
                <div
                  key={c.cabinId}
                  className="flex justify-between gap-3 border-t border-hair py-2 text-[13.5px]"
                >
                  <span className="min-w-0 text-bodytext">
                    <b className="text-ink">{c.cabinName}</b>{' '}
                    <span className="text-xs text-muted">
                      {[
                        c.deck,
                        `${c.adults}A${c.children ? ` + ${c.children}C` : ''}`,
                        nights ? `${nights}n` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  {c.roomPrice ? (
                    <em className="flex-none font-display font-bold not-italic text-ink">
                      ৳ {money(c.roomPrice)}
                    </em>
                  ) : null}
                </div>
              ))
            )}

            {/* price lines */}
            <div className="mt-1.5 border-t border-hair pt-3">
              {roomTotal ? (
                <div className={SUMMARY_ROW}>
                  <span>
                    Subtotal
                    {selection.kind === 'cabin'
                      ? ` (${selection.cabins.length} cabin${
                          selection.cabins.length === 1 ? '' : 's'
                        }${nights ? ` · ${nights} night${nights > 1 ? 's' : ''}` : ''})`
                      : ''}
                  </span>
                  <span>৳ {money(roomTotal)}</span>
                </div>
              ) : null}
              {discount > 0 ? (
                <div className={SUMMARY_ROW}>
                  <span>Coupon{coupon ? ` · ${coupon}` : ''}</span>
                  <em className="font-display font-bold not-italic text-ok">
                    − ৳ {money(discount)}
                  </em>
                </div>
              ) : null}
            </div>

            {/* grand total */}
            <div className="mt-2 flex items-baseline justify-between border-t border-hair pt-3.5">
              <span className="text-[15px] font-extrabold text-ink">
                Grand total
              </span>
              <span className="font-display text-2xl font-black tabular-nums tracking-[-.03em] text-ink">
                ৳ {money(grand)}
              </span>
            </div>

            {/* 50% advance vs full */}
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {(
                [
                  ['advance', 'Pay 50% advance', advance, 'Rest due at boarding'],
                  ['full', 'Pay full', grand, 'Nothing due later'],
                ] as const
              ).map(([value, title, amount, sub]) => {
                const on = payChoice === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPayChoice(value)}
                    className={`relative rounded border-[1.5px] p-3 text-left transition-all duration-150 ${
                      on
                        ? "border-blue bg-[var(--blue-050)] after:absolute after:-right-2 after:-top-2 after:grid after:h-[19px] after:w-[19px] after:place-items-center after:rounded-full after:bg-blue after:text-[11px] after:font-black after:text-white after:shadow-e1 after:content-['✓']"
                        : 'border-hair bg-bg hover:border-[var(--blue-100)]'
                    }`}
                  >
                    <div className="text-[12.5px] font-extrabold text-ink">
                      {title}
                    </div>
                    <div
                      className={`mb-px mt-[3px] font-display text-lg font-black tabular-nums tracking-[-.03em] ${
                        on ? 'text-blue' : 'text-ink'
                      }`}
                    >
                      ৳ {money(amount)}
                    </div>
                    <div className="text-[11px] font-semibold text-muted">{sub}</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-2.5 text-center text-[12.5px] text-muted">
              Pay <b className="font-bold text-ink">৳ {money(payNow)}</b> now ·{' '}
              {dueLater > 0 ? (
                <>
                  <b className="font-bold text-ink">৳ {money(dueLater)}</b> due at
                  boarding
                </>
              ) : (
                'nothing due later'
              )}
            </div>

            {/* terms */}
            <label className="mt-4 inline-flex cursor-pointer items-start gap-[9px] text-[12.5px] text-muted">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
              />
              <span className="mt-px grid h-[19px] w-[19px] flex-none place-items-center rounded-[5px] border-[1.5px] border-muted text-xs text-white transition-all duration-150 peer-checked:border-blue peer-checked:bg-blue peer-checked:after:content-['✓']" />
              <span>
                I agree to the{' '}
                <a className="font-bold text-blue hover:underline" href="/terms">
                  booking terms
                </a>{' '}
                &amp;{' '}
                <a
                  className="font-bold text-blue hover:underline"
                  href="/cancellation"
                >
                  cancellation policy
                </a>
                .
              </span>
            </label>

            {error ? (
              <div
                role="alert"
                className="mt-2.5 text-xs font-bold text-danger"
              >
                {error}
              </div>
            ) : null}

            <button
              type="button"
              disabled={busy || holdLapsed}
              onClick={pay}
              className={`${PRIMARY_BTN} mt-3.5`}
            >
              {payLabel}
            </button>

          </div>
        </aside>
      </div>
    </section>
  );
}
