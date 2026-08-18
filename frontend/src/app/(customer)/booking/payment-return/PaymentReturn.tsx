'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { BookingInvoice } from '@/components/customer/BookingInvoice';
import {
  DARK_CARD_SURFACE,
  NAV_BTN_B,
  NAV_BTN_O,
} from '@/lib/customer/boat-card';
import type { BookingDetail, InvoiceView } from '@/lib/customer/types';
import { money } from '@/lib/owner/format';

// ---- design tokens (haorboat-confirmation.html) ---------------------------
// Colours/radii/shadows resolve through the CSS vars in customer.css, so these
// switch with [data-theme] without a `dark:` variant each. The invoice itself
// lives in BookingInvoice — it is shared between screen and print.
const SECTION = 'mx-auto max-w-[820px] px-6';
const CARD = `rounded-xl border border-hair bg-raise-1 shadow-e1 ${DARK_CARD_SURFACE}`;

type Phase = 'polling' | 'paid' | 'partial' | 'pending' | 'error';

/**
 * Payment return / booking confirmation.
 *
 * Polls GET /me/invoices/:id until the IPN records the payment. We poll (not
 * trust the redirect) because only the server-to-server IPN is authoritative —
 * a forged browser return can't confirm anything. Once the poll settles, a
 * second fetch of GET /booking/:id fills the invoice card.
 *
 * Every figure shown here comes from the server. The design preview computes
 * totals in JS; that is throwaway — the client never does price math.
 *
 * Markup is a Tailwind rebuild of design-previews/customer/haorboat-confirmation.html
 * — no legacy `customer.css` class names.
 */
export function PaymentReturn() {
  const params = useSearchParams();
  const invoiceId = params.get('invoice');
  const [invoice, setInvoice] = useState<InvoiceView | null>(null);
  const [phase, setPhase] = useState<Phase>('polling');
  const tries = useRef(0);

  useEffect(() => {
    if (!invoiceId) {
      setPhase('error');
      return;
    }
    let stop = false;
    const poll = async () => {
      try {
        const { data } = await api.get<InvoiceView>(`/me/invoices/${invoiceId}`);
        if (stop) return;
        setInvoice(data);
        const paid = Number(data.amountPaid);
        const total = Number(data.displayTotal);
        if (data.status === 'paid' || (paid > 0 && paid >= total)) {
          setPhase('paid');
          return;
        }
        if (paid > 0) {
          setPhase('partial');
          return;
        }
        tries.current += 1;
        if (tries.current >= 12) {
          setPhase('pending');
          return;
        }
        setTimeout(poll, 2500);
      } catch {
        if (!stop) setPhase('error');
      }
    };
    poll();
    return () => {
      stop = true;
    };
  }, [invoiceId]);

  const settled = phase === 'paid' || phase === 'partial';

  // Only fetched once the payment is settled — a null SWR key makes no request.
  const { data: booking } = useSWR<BookingDetail>(
    settled && invoice?.bookingId ? `/booking/${invoice.bookingId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const paidNow = invoice ? Number(invoice.amountPaid) : 0;
  const total = invoice ? Number(invoice.displayTotal) : 0;
  const due = Math.max(total - paidNow, 0);

  // There is no human-readable reference column — the UI derives it from the id
  // prefix, the same convention the account booking page uses.
  const ref = invoice?.bookingId.slice(0, 8).toUpperCase() ?? null;

  const pkg = booking?.departure?.package ?? null;
  const boat = pkg?.houseboat ?? null;

  return (
    // `invoice-print-root` scopes the print blackout (customer.css) to this
    // section — an unscoped rule would break printing on every customer page.
    <section className={`invoice-print-root ${SECTION} pb-14 pt-[22px]`}>
      {/* ---------------- success ---------------- */}
      <div className="px-6 pb-2.5 pt-11 text-center max-[600px]:px-0 print:hidden">
        <div
          className="mx-auto mb-[18px] grid h-[76px] w-[76px] place-items-center rounded-full border-2 border-[color-mix(in_srgb,var(--ok)_30%,transparent)] bg-[color-mix(in_srgb,var(--ok)_12%,var(--raise-1))] text-[38px] text-ok animate-pop print:animate-none"
          aria-hidden="true"
        >
          {phase === 'polling' ? '⏳' : phase === 'pending' ? '🕑' : phase === 'error' ? '🧭' : '✓'}
        </div>

        {phase === 'error' ? (
          <>
            <h1 className="font-display text-[28px] font-semibold tracking-[-.02em] text-ink">
              We couldn’t find that payment
            </h1>
            <p className="mt-2 text-[15px] text-bodytext">
              Check your trips — if you were charged, the booking is there.
            </p>
          </>
        ) : phase === 'polling' ? (
          <>
            <h1 className="font-display text-[28px] font-semibold tracking-[-.02em] text-ink">
              Confirming your payment…
            </h1>
            <p className="mt-2 text-[15px] text-bodytext">
              Hang tight — we’re verifying with the payment gateway.
            </p>
          </>
        ) : phase === 'pending' ? (
          <>
            <h1 className="font-display text-[28px] font-semibold tracking-[-.02em] text-ink">
              Payment is being confirmed
            </h1>
            <p className="mt-2 text-[15px] text-bodytext">
              This can take a moment. Your booking will appear in My trips once the
              gateway confirms.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-[28px] font-semibold tracking-[-.02em] text-ink">
              {phase === 'partial' ? 'Advance received!' : 'Booking confirmed!'}
            </h1>
            <p className="mt-2 text-[15px] text-bodytext">
              Your cabins{boat ? ' on ' : ' '}
              {boat ? <b className="text-ink">{boat.name}</b> : null} are locked in. A
              voucher has been sent to your phone &amp; email.
            </p>
          </>
        )}

        {settled && ref ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-dashed border-[var(--blue-100)] bg-raise-1 px-[18px] py-[9px] font-display font-extrabold text-ink">
            Booking ref · <b className="text-blue">HB-{ref}</b>
          </div>
        ) : null}
      </div>

      {/* ---------------- actions ---------------- */}
      <div className="mt-5 flex flex-wrap justify-center gap-2.5 print:hidden">
        {settled ? (
          <>
            <button type="button" className={NAV_BTN_B} onClick={() => window.print()}>
              🖨️ Print invoice
            </button>
            <button type="button" className={NAV_BTN_O} onClick={() => window.print()}>
              ⬇️ Download PDF
            </button>
          </>
        ) : null}
        <Link className={settled ? NAV_BTN_O : NAV_BTN_B} href="/account/trips">
          View my trips
        </Link>
        <Link className={NAV_BTN_O} href="/search">
          Browse more boats
        </Link>
      </div>

      {/* ---------------- invoice ---------------- */}
      {settled && booking && invoice ? (
        <div className="my-5">
          <BookingInvoice
            booking={booking}
            invoice={invoice}
            partial={phase === 'partial'}
          />
        </div>
      ) : null}

      {/* ---------------- what happens next ---------------- */}
      {settled ? (
        <div className={`${CARD} mb-10 px-6 py-[22px] print:hidden`}>
          <h3 className="mb-3.5 font-display text-base font-semibold text-ink">
            What happens next
          </h3>
          <div className="grid gap-3">
            <NextStep icon="📱" title="Voucher sent.">
              Check your SMS &amp; email for the e-voucher and QR code.
            </NextStep>
            {due > 0 ? (
              <NextStep icon="💳" title="Due at boarding.">
                Pay the remaining balance in cash or bKash when you board
                {pkg?.departureGhat ? ` at ${pkg.departureGhat}` : ''}.
              </NextStep>
            ) : null}
            <NextStep icon="🛟" title="Bring your NID.">
              Every adult guest needs a valid NID/passport at the ghat.
            </NextStep>
            <NextStep icon="📞" title="Questions?">
              Call the host or our support line — details are in your voucher.
            </NextStep>
          </div>
        </div>
      ) : null}

      <p className="pb-2 text-center text-[12.5px] text-muted print:hidden">
        Need help with this booking?{' '}
        <Link className="text-blue hover:underline" href="/account/trips">
          Contact support
        </Link>{' '}
        · © {new Date().getFullYear()} HaorBoat · Made in Bangladesh 🇧🇩
      </p>
    </section>
  );
}

/** One row of the "what happens next" list (preview `.nstep`). */
function NextStep({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 text-sm text-bodytext">
      <span
        className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-[var(--blue-050)] text-base text-blue"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div>
        <b className="text-ink">{title}</b> {children}
      </div>
    </div>
  );
}
