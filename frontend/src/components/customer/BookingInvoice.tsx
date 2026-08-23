import { PLATFORM } from '@/lib/customer/platform';
import type { BookingDetail, InvoiceView } from '@/lib/customer/types';
import { formatDate, initials, money } from '@/lib/owner/format';

/**
 * The customer's invoice — one A4 page, rendered on screen and printed.
 *
 * Purely presentational: every figure is passed in, already fetched. It follows
 * the owner console's printed invoice (owner/(console)/bookings/page.tsx) so the
 * two documents read as the same family, and adds the platform identity block a
 * customer-facing document needs.
 *
 * Print behaviour is Tailwind `print:` variants plus one scoped rule in
 * customer.css that hides the rest of the page (`.invoice-print-root` /
 * `.invoice-sheet`). Screen colours come from the theme tokens so dark mode
 * works; `print:` overrides force black-on-white because it always prints on
 * paper.
 */

/** Gateway method codes → what the customer actually used. */
const METHOD_LABEL: Record<string, string> = {
  bkash: 'bKash',
  cash: 'Cash',
  bank: 'Bank transfer',
  gateway: 'Card / mobile banking',
  online: 'Online payment',
};

const LABEL =
  'text-[10.5px] font-bold uppercase tracking-[.1em] text-muted print:text-[#667085]';
const VALUE = 'text-[13px] text-bodytext print:text-[#475467]';
const STRONG = 'font-bold text-ink print:text-black';
const TH =
  'border-y border-hair px-2 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-[.08em] text-muted print:border-[#e4e7ec] print:text-[#667085]';
const TD =
  'border-b border-hair px-2 py-3 align-top text-[13px] text-bodytext print:border-[#eef1f4] print:text-[#475467]';
const TOTAL_ROW =
  'flex justify-between gap-4 px-3.5 py-2 text-[13px] text-bodytext print:text-[#475467]';

/** "2 adults + 1 child" for a line-item row. */
function guestLabel(adults: number, children: number): string {
  const a = `${adults} adult${adults === 1 ? '' : 's'}`;
  if (!children) return a;
  return `${a} + ${children} child${children === 1 ? '' : 'ren'}`;
}

export function BookingInvoice({
  booking,
  invoice,
  partial,
}: {
  booking: BookingDetail;
  invoice: InvoiceView;
  /** Advance payment rather than paid in full — changes the status wording. */
  partial: boolean;
}) {
  const pkg = booking.departure?.package ?? null;
  const boat = pkg?.houseboat ?? null;
  const route = pkg?.route ?? null;
  const lead = booking.guests[0] ?? null;
  const cabins = booking.cabins ?? [];

  const heads = cabins.reduce((n, c) => n + c.adults + c.children, 0);
  const nights = pkg?.durationDays ? Math.max(pkg.durationDays - 1, 0) : null;
  const payment = booking.invoice?.payments?.[0] ?? null;

  const total = Number(invoice.displayTotal);
  const paid = Number(invoice.amountPaid);
  const discount = Number(invoice.discountAmount);
  const due = Math.max(total - paid, 0);
  const subtotal = booking.invoice?.roomTotal ?? null;

  // No human-readable reference column exists; both documents derive it from
  // the id, the same convention the account booking page uses.
  const ref = invoice.bookingId.slice(0, 8).toUpperCase();
  const invNo = invoice.id.slice(-6).toUpperCase();

  return (
    <div
      className={
        // `invoice-sheet` is the print hook (see customer.css) — it carries no
        // styling of its own.
        'invoice-sheet rounded-xl border border-hair bg-raise-1 p-7 shadow-e1 ' +
        'max-[600px]:p-4 ' +
        'print:absolute print:left-0 print:top-0 print:w-full print:rounded-none ' +
        'print:border-0 print:bg-white print:p-0 print:text-[12.5px] print:text-black ' +
        'print:shadow-none print:[print-color-adjust:exact]'
      }
    >
      {/* ── header: platform identity + invoice meta ── */}
      <div className="flex flex-wrap items-start justify-between gap-5 border-b-2 border-blue pb-4 print:border-[#1a73e8]">
        <div>
          <div className="font-display text-xl font-extrabold tracking-[-.01em] text-ink print:text-black">
            {PLATFORM.mark} {PLATFORM.name}
          </div>
          <div className={`mt-1 ${VALUE}`}>{PLATFORM.address}</div>
          <div className={VALUE}>
            {PLATFORM.email} · {PLATFORM.site}
          </div>
        </div>
        <div className="text-right text-[12px] leading-relaxed text-bodytext print:text-[#475467] max-[600px]:text-left">
          <div className="font-display text-sm font-extrabold tracking-[.04em] text-ink print:text-black">
            INV-{invNo}
          </div>
          <div>
            Booking <span className={STRONG}>HB-{ref}</span>
          </div>
          <div>Issued {formatDate(booking.createdAt ?? new Date())}</div>
          <div className="mt-1.5 inline-block rounded-full border border-ok px-2.5 py-0.5 text-[11px] font-bold text-ok print:border-[#12925a] print:text-[#12925a]">
            {partial ? 'Advance received' : 'Paid · Confirmed'}
          </div>
        </div>
      </div>

      {/* ── supplier: the boat ── */}
      {boat ? (
        <div className="flex items-center gap-3.5 border-b border-hair py-4 print:border-[#eef1f4]">
          {boat.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="h-11 w-11 flex-none rounded-full border border-hair object-cover print:border-[#e4e7ec]"
              src={boat.logoUrl}
              alt=""
            />
          ) : (
            <span className="grid h-11 w-11 flex-none place-items-center rounded-full border border-hair bg-field text-base font-bold text-bodytext print:border-[#e4e7ec] print:bg-[#f8fafc] print:text-[#475467]">
              {initials(boat.name)}
            </span>
          )}
          <div className="min-w-0">
            <div className="font-display text-[15px] font-bold text-ink print:text-black">
              {boat.name}
            </div>
            <div className="text-[12px] text-muted print:text-[#667085]">
              {[route?.name, route?.region].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── billed to / trip ── */}
      <div className="grid grid-cols-2 gap-6 py-4 max-[600px]:grid-cols-1">
        <div>
          <h4 className={`mb-1.5 ${LABEL}`}>Billed to</h4>
          <div className={`text-sm ${STRONG}`}>
            {lead?.name ?? booking.customer?.name ?? '—'}
          </div>
          {lead?.phone ?? booking.customer?.phone ? (
            <div className={VALUE}>{lead?.phone ?? booking.customer?.phone}</div>
          ) : null}
          {booking.customer?.email ? (
            <div className={VALUE}>{booking.customer.email}</div>
          ) : null}
        </div>
        <div className="text-right max-[600px]:text-left">
          <h4 className={`mb-1.5 ${LABEL}`}>Trip</h4>
          <div className={`text-sm ${STRONG}`}>
            {formatDate(booking.departure?.startDate)}
            {booking.departure?.endDate
              ? ` – ${formatDate(booking.departure.endDate)}`
              : ''}
          </div>
          <div className={VALUE}>
            {nights ? `${nights} night${nights === 1 ? '' : 's'} · ` : ''}
            {heads} guest{heads === 1 ? '' : 's'} · {cabins.length} cabin
            {cabins.length === 1 ? '' : 's'}
          </div>
          {pkg?.departureGhat ? (
            <div className={VALUE}>Boards {pkg.departureGhat}</div>
          ) : null}
        </div>
      </div>

      {/* ── line items ── */}
      {cabins.length ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>Description</th>
                <th className={`${TH} text-center`}>Guests</th>
                <th className={`${TH} text-right`}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {cabins.map((c) => (
                <tr key={c.id}>
                  <td className={TD}>
                    <span className={STRONG}>
                      Cabin {c.cabin?.name ?? '—'}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted print:text-[#667085]">
                      {[c.cabin?.deck?.name, c.cabin?.category?.name]
                        .filter(Boolean)
                        .join(' · ')}
                      {c.isOpenSeat ? ' · shared' : ''}
                    </span>
                  </td>
                  <td className={`${TD} text-center`}>
                    {guestLabel(c.adults, c.children)}
                  </td>
                  <td
                    className={`${TD} text-right font-display font-bold tabular-nums text-ink print:text-black`}
                  >
                    {money(c.roomPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* ── totals ── */}
      <div className="ml-auto mt-4 max-w-[300px] overflow-hidden rounded-lg border border-hair print:border-[#e4e7ec]">
        {subtotal ? (
          <div className={TOTAL_ROW}>
            <span>Subtotal</span>
            <span className="tabular-nums">{money(subtotal)}</span>
          </div>
        ) : null}
        {discount > 0 ? (
          <div className={TOTAL_ROW}>
            <span>
              Coupon{booking.coupon?.code ? ` · ${booking.coupon.code}` : ''}
            </span>
            <span className="tabular-nums text-danger print:text-[#d64242]">
              −{money(discount)}
            </span>
          </div>
        ) : null}
        <div
          className={`${TOTAL_ROW} border-t border-hair text-[15px] font-extrabold text-ink print:border-[#e4e7ec] print:text-black`}
        >
          <span>Total</span>
          <span className="font-display tabular-nums">{money(total)}</span>
        </div>
        <div className={TOTAL_ROW}>
          <span>Paid{partial ? ' (advance)' : ''}</span>
          <span className="tabular-nums">{money(paid)}</span>
        </div>
        <div
          className={`${TOTAL_ROW} border-t border-hair font-extrabold text-blue print:border-[#e4e7ec] print:text-[#1a73e8]`}
        >
          <span>Balance due</span>
          <span className="font-display tabular-nums">
            {due > 0 ? money(due) : money(0)}
          </span>
        </div>
      </div>

      {payment ? (
        <div className="mt-3 text-right text-[11.5px] text-muted print:text-[#667085]">
          Paid via {METHOD_LABEL[payment.method] ?? payment.method}
          {payment.paidAt ? ` on ${formatDate(payment.paidAt)}` : ''}
          {due > 0 ? ' · balance payable at boarding' : ''}
        </div>
      ) : null}

      {/* ── footer ── */}
      <div className="mt-6 border-t border-hair pt-3.5 text-[11px] leading-relaxed text-muted print:border-[#eef1f4] print:text-[#667085]">
        <p>
          <span className={STRONG}>Cancellation:</span> free up to 7 days before
          departure · 50% refund up to 72 hrs · no refund within 72 hrs.
        </p>
        <p className="mt-1">
          Computer-generated invoice from {PLATFORM.legalName},{' '}
          {PLATFORM.address} · {PLATFORM.email}. Every adult guest must carry a
          valid NID or passport at the ghat.
        </p>
      </div>
    </div>
  );
}
