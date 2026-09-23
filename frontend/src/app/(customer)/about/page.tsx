import type { Metadata } from 'next';
import Link from 'next/link';
import { CustomerNav } from '@/components/customer/CustomerNav';
import { CustomerFooter } from '@/components/customer/CustomerFooter';
import { getCustomerSession } from '@/lib/customer/session';

export const metadata: Metadata = {
  title: 'About HaorBoat — Bangladesh’s houseboat booking platform',
  description:
    'Who we are and why we built HaorBoat: real-time cabin availability, honest ৳ pricing, and boats we safety-check ourselves on Tanguar, Nikli and the Padma.',
};

// Shared token strings (mirror the home/footer design system).
const EYEBROW =
  'text-[13px] font-bold uppercase tracking-[.09em] text-blue dark:[text-shadow:0_0_16px_rgba(90,160,255,.3)]';
const H2 = 'mt-2 font-display text-3xl tracking-[-.03em] text-ink max-[640px]:text-2xl';
const CARD =
  'rounded-2xl border border-hair bg-raise-1 p-6 shadow-e2';

const PROMISES = [
  {
    icon: '📡',
    title: 'Real-time cabin availability',
    body: 'Every cabin shows live status — no double-bookings, no “call to confirm”. Pick the exact cabins you want and hold them while you check out.',
  },
  {
    icon: '৳',
    title: 'Honest ৳ pricing',
    body: 'The price you see is the price you pay. Adult and child rates, fees and deposits are broken down before you commit — no surprises at the dock.',
  },
  {
    icon: '🛟',
    title: 'Boats we safety-check',
    body: 'We vet the boats and hosts on the platform ourselves, so the houseboat in the photos is the one that meets you on the water.',
  },
];

const HAORS = [
  {
    name: 'Tanguar Haor',
    body: 'Sunamganj’s wetland of open water and swamp forest — our most-booked monsoon cruise.',
  },
  {
    name: 'Nikli Haor',
    body: 'Kishoreganj’s wide, calm haor — short getaways and easy group charters.',
  },
  {
    name: 'Padma River',
    body: 'Classic river cruising with sandbars and sunsets, close to Dhaka.',
  },
];

export default async function AboutPage() {
  const session = await getCustomerSession();
  const user = session.status === 'authenticated' ? session.user : null;

  return (
    <>
      <CustomerNav user={user} />

      <main>
        {/* Hero band */}
        <section className="bg-[linear-gradient(135deg,#1560d6,#3b8bff)] text-white">
          <div className="mx-auto max-w-wrap px-6 py-[72px] max-[640px]:py-12">
            <span className="inline-block rounded-full border border-white/35 bg-white/[.18] px-[13px] py-[6px] text-[11.5px] font-bold uppercase tracking-[.06em] backdrop-blur-[4px]">
              About us
            </span>
            <h1 className="mt-4 max-w-[22ch] font-display text-[40px] leading-[1.1] tracking-[-.03em] max-[640px]:text-[30px]">
              Houseboats on Bangladesh’s haors, booked the honest way.
            </h1>
            <p className="mt-4 max-w-[52ch] text-[17px] leading-[1.6] text-white/[.92] max-[640px]:text-[15.5px]">
              HaorBoat is Bangladesh&apos;s houseboat booking platform — real-time
              cabin availability, honest ৳ pricing, and boats we safety-check
              ourselves.
            </p>
          </div>
        </section>

        {/* Our story */}
        <section className="border-t border-hair">
          <div className="mx-auto max-w-wrap px-6 py-[60px] max-[640px]:py-9">
            <span className={EYEBROW}>Our story</span>
            <h2 className={H2}>Built by people who love the haors</h2>
            <div className="mt-5 grid max-w-[68ch] gap-4 text-[15.5px] leading-[1.65] text-bodytext">
              <p>
                Booking a houseboat used to mean phone calls, screenshots and
                crossed fingers — no way to know which cabins were free, what a
                trip really cost, or whether the boat matched the photos.
              </p>
              <p>
                We built HaorBoat to fix that. One place to see every available
                cabin in real time, a clear ৳ breakdown before you pay, and
                instant confirmation the moment your deposit clears.
              </p>
              <p>
                Behind every listing is a boat and a host we&apos;ve checked
                ourselves — because a trip on the water should be the easy part.
              </p>
            </div>
          </div>
        </section>

        {/* What we do — 3 promises */}
        <section className="border-t border-hair bg-raise-1 dark:border-t-[color-mix(in_srgb,var(--blue)_12%,var(--hair))] dark:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--blue)_6%,transparent),transparent)]">
          <div className="mx-auto max-w-wrap px-6 py-[60px] max-[640px]:py-9">
            <span className={EYEBROW}>What we do</span>
            <h2 className={H2}>Three things we promise</h2>
            <div className="mt-7 grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
              {PROMISES.map((p) => (
                <div key={p.title} className={CARD}>
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-[linear-gradient(145deg,var(--blue),var(--blue-700))] text-[19px] text-white shadow-[0_6px_14px_-6px_var(--blue),var(--top-hi)]">
                    {p.icon}
                  </span>
                  <h3 className="mb-2 mt-4 font-display text-xl tracking-[-.02em] text-ink">
                    {p.title}
                  </h3>
                  <p className="text-[14.5px] leading-[1.6] text-bodytext">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Haors we cover */}
        <section className="border-t border-hair">
          <div className="mx-auto max-w-wrap px-6 py-[60px] max-[640px]:py-9">
            <span className={EYEBROW}>Where we sail</span>
            <h2 className={H2}>The haors we cover</h2>
            <div className="mt-7 grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
              {HAORS.map((h) => (
                <div key={h.name} className={CARD}>
                  <h3 className="font-display text-lg tracking-[-.02em] text-ink">
                    {h.name}
                  </h3>
                  <p className="mt-2 text-[14.5px] leading-[1.6] text-bodytext">
                    {h.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA strip */}
        <section className="border-t border-hair bg-raise-1">
          <div className="mx-auto flex max-w-wrap flex-wrap items-center justify-between gap-6 px-6 py-[52px] max-[640px]:py-9">
            <div>
              <h2 className="font-display text-2xl tracking-[-.03em] text-ink">
                Ready to get on the water?
              </h2>
              <p className="mt-2 text-[15px] leading-[1.6] text-bodytext">
                Browse live availability, or list your own boat with us.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/search"
                className="btn-sheen inline-flex items-center gap-1.5 rounded-xl bg-[linear-gradient(145deg,var(--blue),var(--blue-700))] px-5 py-3 text-[15px] font-semibold text-white shadow-e2 transition-transform duration-dur ease-ease hover:-translate-y-[2px]"
              >
                Browse boats →
              </Link>
              <Link
                href="/owner/signup"
                className="inline-flex items-center gap-1.5 rounded-xl border border-hair bg-bg px-5 py-3 text-[15px] font-semibold text-ink transition-colors duration-dur ease-ease hover:text-blue"
              >
                Become a host
              </Link>
            </div>
          </div>
        </section>
      </main>

      <CustomerFooter />
    </>
  );
}
