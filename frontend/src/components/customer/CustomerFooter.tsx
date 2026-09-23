import Link from 'next/link';

/**
 * Payment marks, served from /public/payments. Every file is a uniform
 * 48×28 SVG that already draws its own white rounded card, so the <img>
 * needs no border/background of its own — the panel wraps the whole set.
 */
const PAYMENTS = [
  { name: 'bKash', src: '/payments/bkash.svg' },
  { name: 'Nagad', src: '/payments/nagad.svg' },
  { name: 'Upay', src: '/payments/upay.svg' },
  { name: 'Tap', src: '/payments/tap.svg' },
  { name: 'VISA', src: '/payments/visa.svg' },
  { name: 'Mastercard', src: '/payments/mastercard.svg' },
  { name: 'American Express', src: '/payments/amex.svg' },
  { name: 'DBBL', src: '/payments/dbbl.svg' },
];

/**
 * Accreditations. Rendered as text chips because /public/accreditation holds no
 * logo files yet — swap these for <img> slots once trade-license.svg / ecab.svg
 * / basis.svg land there (see that folder's README for the expected names).
 */
const ACCREDITATIONS = ['Trade License', 'e-CAB', 'BASIS'];

const H4 =
  'mb-[17px] text-[13px] font-bold uppercase tracking-[.08em] text-footer-h';
const LINK =
  'inline-block text-[14.5px] text-footer-mut transition-[color,padding] duration-dur ease-ease hover:pl-1 hover:text-footer-h';
const PANEL = 'rounded-xl border border-white/[.12] bg-white/[.04] p-3';

/**
 * Layered brand footer shared by the public customer pages (home, search, boat
 * detail). The ambient glow + dotted-grid depth is the `.foot-fx` hook
 * (::before/::after in home-effects.css). Four columns — brand (blurb +
 * contact), Company, Support, and a payments/accreditation panel stack.
 */
export function CustomerFooter() {
  return (
    <footer className="foot-fx relative isolate overflow-hidden bg-footer text-footer-txt">
      <div className="mx-auto max-w-wrap px-6">
        <div className="pb-[30px] pt-[34px]">
          <div className="grid gap-10 [grid-template-columns:1.6fr_.9fr_.9fr_1.5fr] max-[940px]:[grid-template-columns:1fr_1fr] max-[640px]:[grid-template-columns:1fr]">
            <div>
              <Link
                href="/"
                className="mb-4 flex items-center gap-[11px] font-display text-[22px] font-bold tracking-[-.03em] text-footer-h"
              >
                <span className="grid h-[38px] w-[38px] place-items-center rounded-xl bg-[linear-gradient(145deg,var(--blue),var(--blue-700))] text-[17px] text-white shadow-[0_6px_14px_-6px_var(--blue),var(--top-hi)]">
                  🛥
                </span>
                Haor<span className="text-[#7fb2ff]">Boat</span>
              </Link>
              <p className="max-w-[38ch] text-[14.5px] leading-[1.65] text-footer-mut">
                Bangladesh&apos;s houseboat booking platform. Real-time cabin
                availability, honest ৳ pricing, and boats we safety-check
                ourselves.
              </p>
              <div className="mt-4 grid gap-[9px] text-sm">
                <a
                  href="tel:+8809600000000"
                  className="flex items-center gap-[9px] text-footer-mut transition-colors duration-dur ease-ease hover:text-footer-h"
                >
                  📞 +880 9600 000 000
                </a>
                <a
                  href="mailto:hello@haorboat.com"
                  className="flex items-center gap-[9px] text-footer-mut transition-colors duration-dur ease-ease hover:text-footer-h"
                >
                  ✉️ hello@haorboat.com
                </a>
                <a
                  href="https://maps.google.com/?q=Banani+Dhaka+1213+Bangladesh"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-[9px] text-footer-mut transition-colors duration-dur ease-ease hover:text-footer-h"
                >
                  📍 Banani, Dhaka 1213, Bangladesh
                </a>
              </div>
            </div>

            {/* Company + Support: side by side in one row on small screens so the
                footer isn't so tall. `min-[641px]:contents` dissolves this
                wrapper above 640 so both columns rejoin the parent grid and the
                desktop/tablet layouts stay exactly as before. */}
            <div className="grid grid-cols-2 gap-10 min-[641px]:contents">
              <div>
                <h4 className={H4}>Company</h4>
                <ul className="grid list-none gap-3 p-0">
                  <li><Link href="/about" className={LINK}>About us</Link></li>
                  <li><Link href="/owner/signup" className={LINK}>Become a host</Link></li>
                  <li><Link href="/privacy" className={LINK}>Privacy</Link></li>
                  <li><Link href="/terms" className={LINK}>Terms &amp; Conditions</Link></li>
                </ul>
              </div>

              <div>
                <h4 className={H4}>Support</h4>
                <ul className="grid list-none gap-3 p-0">
                  <li><Link href="/help" className={LINK}>Help Center</Link></li>
                  <li><Link href="/cancellation" className={LINK}>Cancellation</Link></li>
                  <li><Link href="/refund" className={LINK}>Refund policy</Link></li>
                </ul>
              </div>
            </div>

            <div className="grid content-start gap-6">
              <div>
                <h4 className={H4}>We Accept</h4>
                <div className={PANEL}>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENTS.map((p) => (
                      <img
                        key={p.name}
                        src={p.src}
                        alt={p.name}
                        title={p.name}
                        className="h-7 w-auto"
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <h4 className={H4}>Accredited Member</h4>
                <div className={PANEL}>
                  <div className="flex items-center gap-2">
                    {ACCREDITATIONS.map((a) => (
                      <span
                        key={a}
                        className="whitespace-nowrap rounded-sm border border-white/[.12] bg-white/[.08] px-[10px] py-[5px] text-[12.5px] font-semibold text-footer-mut"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-[14px] border-t border-white/[.12] pb-[30px] pt-[22px] text-[13.5px] text-footer-mut max-[640px]:flex-col max-[640px]:text-center">
          <span>© 2026 HaorBoat. All rights reserved. · Made in Bangladesh 🇧🇩</span>
          <div className="flex gap-[10px]">
            {[
              { label: 'Facebook', icon: 'f' },
              { label: 'Instagram', icon: '◎' },
              { label: 'YouTube', icon: '▶' },
              { label: 'WhatsApp', icon: '✆' },
            ].map((s) => (
              <a
                key={s.label}
                href="#"
                aria-label={s.label}
                className="grid h-[38px] w-[38px] place-items-center rounded-full border border-white/[.12] bg-white/[.07] text-[15px] text-[#dbe4f0] transition-[transform,background,border-color] duration-dur ease-ease hover:-translate-y-[3px] hover:border-blue hover:bg-blue hover:text-white"
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
