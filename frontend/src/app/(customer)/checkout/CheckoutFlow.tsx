'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { money, apiErrorMessage } from '@/lib/owner/format';
import { customerLoginUrl } from '@/lib/customer/login-url';
import type { Hold } from '@/lib/customer/types';
import type { StoredSelection } from '../boat/[slug]/BoatBooking';

const SELECTION_KEY = 'hb-selection';

/** POST /booking/checkout + /group-checkout both return { booking, invoice }. */
interface CheckoutResult {
  booking: { id: string };
  invoice: { id: string };
}

type PayChoice = 'advance' | 'full';
type PayMethod = 'bkash' | 'nagad' | 'card';

/**
 * Drives the real checkout: restore selection → (require login) → take holds →
 * POST /booking/checkout → POST /gateway/sslcommerz/initiate → redirect to the
 * gateway. All prices come from the stored server total; the client never
 * recomputes. bKash/Nagad/Card are UI choices — all route through SSLCommerz.
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
  const [selection, setSelection] = useState<StoredSelection | null>(null);
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [email, setEmail] = useState(defaultEmail);
  const [nid, setNid] = useState('');
  const [coupon, setCoupon] = useState('');
  const [reference, setReference] = useState('');
  const [instructions, setInstructions] = useState('');
  const [payChoice, setPayChoice] = useState<PayChoice>('advance');
  const [method, setMethod] = useState<PayMethod>('bkash');
  const [agree, setAgree] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SELECTION_KEY);
      if (raw) setSelection(JSON.parse(raw) as StoredSelection);
    } catch {}
  }, []);

  if (!selection) {
    return (
      <section className="co">
        <div className="wrap">
          <div className="card">
            <h2>Your cart is empty</h2>
            <p className="ch">
              Pick cabins on a boat first, then come back to check out.
            </p>
            <a className="btn btn-b" href="/search">
              Find a houseboat
            </a>
          </div>
        </div>
      </section>
    );
  }

  const grand = Number(selection.displayTotal);
  const advance = Math.round(grand / 2);
  const payNow = payChoice === 'advance' ? advance : grand;
  const dueLater = grand - payNow;

  const pay = async () => {
    setError(null);
    // Login wall: send signed-out users to login, preserving the selection.
    if (!signedIn) {
      window.location.assign(
        customerLoginUrl({ next: '/checkout', reason: 'login_required' }),
      );
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
      let invoiceId: string;

      if (selection.kind === 'group') {
        const { data } = await api.post<CheckoutResult>('/booking/group-checkout', {
          departureId: selection.departureId,
          headcount: selection.groupHeadcount,
          leadGuestName: name,
          leadGuestPhone: phone,
          leadGuestNid: nid || undefined,
          specialInstructions: instructions || undefined,
          referenceName: reference || undefined,
        });
        invoiceId = data.invoice.id;
      } else {
        // Take a hold per cabin (locks availability under the caller's account),
        // then checkout with the holdIds. A hold can expire/collide → surfaced.
        const holds: { cabinId: string; holdId: string }[] = [];
        for (const c of selection.cabins) {
          const { data } = await api.post<Hold>('/booking/hold', {
            cabinId: c.cabinId,
            departureId: selection.departureId,
          });
          holds.push({ cabinId: c.cabinId, holdId: data.id });
        }
        const { data } = await api.post<CheckoutResult>('/booking/checkout', {
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
          leadGuestNid: nid || undefined,
          couponCode: coupon || undefined,
          referenceName: reference || undefined,
          specialInstructions: instructions || undefined,
          paymentChoice: payChoice,
        });
        invoiceId = data.invoice.id;
      }

      // Start payment. For a 50% advance, pass the computed amount; for full,
      // omit it (the gateway defaults to the full outstanding).
      const { data: initiated } = await api.post<{ gatewayPageUrl: string }>(
        '/gateway/sslcommerz/initiate',
        {
          invoiceId,
          ...(payChoice === 'advance' ? { amount: advance } : {}),
        },
      );

      try {
        sessionStorage.removeItem(SELECTION_KEY);
      } catch {}
      // Full-page navigation to the hosted gateway (bKash/Nagad/card selected
      // there). CSP allows top-level navigation to a third-party origin.
      window.location.assign(initiated.gatewayPageUrl);
    } catch (e) {
      setError(apiErrorMessage(e, 'Checkout failed. Please try again.'));
      setBusy(false);
    }
  };

  return (
    <section className="co">
      <div className="wrap">
        <h1>Checkout</h1>
        <div className="cogrid">
          <div>
            {/* Guest details */}
            <div className="card">
              <h2>Guest details</h2>
              <div className="ch">Who’s the lead guest for this booking?</div>
              <div className="fld">
                <label>Full name</label>
                <input
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid2">
                <div className="fld">
                  <label>Phone</label>
                  <input
                    type="tel"
                    placeholder="01XXXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="fld">
                  <label>Email</label>
                  <input
                    type="email"
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="fld">
                <label>NID / Passport</label>
                <input
                  type="text"
                  placeholder="10 or 17-digit NID / passport no."
                  value={nid}
                  onChange={(e) => setNid(e.target.value)}
                />
                <div className="hint">Stored securely, used only for boarding.</div>
              </div>
              <div className="grid2">
                <div className="fld">
                  <label>Coupon</label>
                  <div className="promo">
                    <input
                      type="text"
                      placeholder="HAOR500"
                      value={coupon}
                      onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="hint">
                    Applied to your total at confirmation.
                  </div>
                </div>
                <div className="fld">
                  <label>Referred by (optional)</label>
                  <input
                    type="text"
                    placeholder="Who referred you?"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Special requests */}
            <div className="card">
              <h2>Special requests</h2>
              <div className="ch">Anything we should prepare for?</div>
              <div className="fld">
                <textarea
                  rows={3}
                  placeholder="e.g. one vegetarian meal plan, ground-deck cabin for an elderly guest…"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Trip summary + payment */}
          <div className="card trip">
            <div className="thead">
              <div className="tl">{selection.boatName}</div>
            </div>
            <div className="lines">
              {selection.kind === 'group' ? (
                <div className="brow">
                  <span>Full boat · {selection.groupHeadcount} guests</span>
                  <b>৳ {money(selection.displayTotal)}</b>
                </div>
              ) : (
                selection.cabins.map((c) => (
                  <div className="brow" key={c.cabinId}>
                    <span>
                      {c.cabinName} ({c.adults}A
                      {c.children ? ` + ${c.children}C` : ''})
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="total">
              <span className="tl2">Grand total</span>
              <span className="tv">৳ {money(selection.displayTotal)}</span>
            </div>

            {/* 50% advance vs full */}
            <div className="paychoice">
              <button
                className={`pc${payChoice === 'advance' ? ' on' : ''}`}
                onClick={() => setPayChoice('advance')}
              >
                <div className="pc-t">Pay 50% advance</div>
                <div className="pc-a">৳ {money(advance)}</div>
                <div className="pc-s">Rest at boarding</div>
              </button>
              <button
                className={`pc${payChoice === 'full' ? ' on' : ''}`}
                onClick={() => setPayChoice('full')}
              >
                <div className="pc-t">Pay full</div>
                <div className="pc-a">৳ {money(grand)}</div>
                <div className="pc-s">Nothing due later</div>
              </button>
            </div>
            <div className="dueline">
              Pay now <b>৳ {money(payNow)}</b>
              {dueLater > 0 ? <> · Due at boarding ৳ {money(dueLater)}</> : null}
            </div>

            <div className="paylbl">Payment method</div>
            <div className="pays">
              <button
                className={`pay${method === 'bkash' ? ' on' : ''}`}
                onClick={() => setMethod('bkash')}
              >
                📱 bKash
              </button>
              <button
                className={`pay${method === 'nagad' ? ' on' : ''}`}
                onClick={() => setMethod('nagad')}
              >
                📱 Nagad
              </button>
              <button
                className={`pay${method === 'card' ? ' on' : ''}`}
                onClick={() => setMethod('card')}
              >
                💳 Card
              </button>
            </div>

            <label className="chk" style={{ marginTop: 14 }}>
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
              />
              <span className="box" /> I agree to the cancellation &amp; refund
              policy.
            </label>

            {error ? (
              <div className="hint" style={{ color: 'var(--danger)', fontWeight: 700, marginTop: 10 }}>
                {error}
              </div>
            ) : null}

            <button
              className="btn btn-b btn-block btn-lg"
              style={{ marginTop: 14 }}
              disabled={busy}
              onClick={pay}
            >
              {busy
                ? 'Processing…'
                : signedIn
                  ? `Pay ৳ ${money(payNow)} →`
                  : 'Log in to continue'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
