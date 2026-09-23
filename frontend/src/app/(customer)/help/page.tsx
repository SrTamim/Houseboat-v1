import type { Metadata } from 'next';
import Link from 'next/link';
import { CustomerNav } from '@/components/customer/CustomerNav';
import { CustomerFooter } from '@/components/customer/CustomerFooter';
import { getCustomerSession } from '@/lib/customer/session';

export const metadata: Metadata = {
  title: 'Help Center — HaorBoat',
  description:
    'Answers on booking cabins, payment, deposits, refunds and cancellation, waitlists and your account — plus how to reach the HaorBoat team.',
};

const EYEBROW =
  'text-[13px] font-bold uppercase tracking-[.09em] text-blue dark:[text-shadow:0_0_16px_rgba(90,160,255,.3)]';
const H2 = 'font-display text-2xl tracking-[-.03em] text-ink max-[640px]:text-xl';

interface Faq {
  q: string;
  a: React.ReactNode;
}
interface FaqGroup {
  title: string;
  items: Faq[];
}

const GROUPS: FaqGroup[] = [
  {
    title: 'Booking & cabins',
    items: [
      {
        q: 'How does cabin availability work?',
        a: 'Every cabin shows live availability for the dates you pick. Choose the exact cabins you want — they’re held for you while you complete checkout, so no one else can grab them mid-booking.',
      },
      {
        q: 'When is my booking confirmed?',
        a: 'Your booking is confirmed instantly once your deposit payment clears. You’ll see the confirmation on-screen and in your account under Trips.',
      },
      {
        q: 'Can I book the whole boat?',
        a: 'Yes — select all cabins on a boat for a private charter. Group rates apply on some routes; look for the group offers on the boat page.',
      },
    ],
  },
  {
    title: 'Payment & deposits',
    items: [
      {
        q: 'What payment methods can I use?',
        a: 'bKash, Nagad, Upay, Tap, and cards (VISA, Mastercard, American Express, DBBL). The available options appear at checkout.',
      },
      {
        q: 'Do I pay the full amount up front?',
        a: 'You pay a deposit to confirm — 50% of the trip total — at checkout. The balance is settled per the terms shown on your booking.',
      },
      {
        q: 'Is the price I see final?',
        a: 'Yes. Adult and child rates, fees and the deposit are all broken down before you pay — the total shown is what you’re charged.',
      },
    ],
  },
  {
    title: 'Refunds & cancellation',
    items: [
      {
        q: 'How do I cancel a booking?',
        a: (
          <>
            Cancellation terms depend on how close you are to the trip date. See
            our{' '}
            <Link href="/cancellation" className="font-semibold text-blue hover:underline">
              cancellation policy
            </Link>{' '}
            for the details that apply to your booking.
          </>
        ),
      },
      {
        q: 'How are refunds paid?',
        a: (
          <>
            Eligible refunds are returned to your original payment method. See the{' '}
            <Link href="/refund" className="font-semibold text-blue hover:underline">
              refund policy
            </Link>{' '}
            for timing and eligibility.
          </>
        ),
      },
    ],
  },
  {
    title: 'Waitlist',
    items: [
      {
        q: 'The dates I want are full — what now?',
        a: 'Join the waitlist for that boat and dates. If a cabin frees up, we’ll notify you so you can book it before it’s offered publicly again.',
      },
      {
        q: 'Where do I see my waitlist entries?',
        a: (
          <>
            In your account under{' '}
            <Link href="/account/waitlist" className="font-semibold text-blue hover:underline">
              Waitlist
            </Link>
            .
          </>
        ),
      },
    ],
  },
  {
    title: 'Your account',
    items: [
      {
        q: 'Where are my bookings?',
        a: (
          <>
            Sign in and open{' '}
            <Link href="/account/trips" className="font-semibold text-blue hover:underline">
              Trips
            </Link>{' '}
            to see upcoming and past bookings, tickets and receipts.
          </>
        ),
      },
      {
        q: 'How do I update my profile?',
        a: (
          <>
            Manage your details from{' '}
            <Link href="/account/profile" className="font-semibold text-blue hover:underline">
              Profile
            </Link>{' '}
            in your account.
          </>
        ),
      },
    ],
  },
];

export default async function HelpPage() {
  const session = await getCustomerSession();
  const user = session.status === 'authenticated' ? session.user : null;

  return (
    <>
      <CustomerNav user={user} />

      <main>
        {/* Hero */}
        <section className="bg-[linear-gradient(135deg,#1560d6,#3b8bff)] text-white">
          <div className="mx-auto max-w-wrap px-6 py-[64px] max-[640px]:py-11">
            <span className="inline-block rounded-full border border-white/35 bg-white/[.18] px-[13px] py-[6px] text-[11.5px] font-bold uppercase tracking-[.06em] backdrop-blur-[4px]">
              Help Center
            </span>
            <h1 className="mt-4 font-display text-[38px] leading-[1.1] tracking-[-.03em] max-[640px]:text-[28px]">
              How can we help?
            </h1>
            <p className="mt-4 max-w-[52ch] text-[17px] leading-[1.6] text-white/[.92] max-[640px]:text-[15.5px]">
              Answers to the questions we hear most — booking, payment, refunds,
              waitlists and your account. Still stuck? Reach us below.
            </p>
          </div>
        </section>

        {/* FAQ groups */}
        <section className="border-t border-hair">
          <div className="mx-auto max-w-wrap px-6 py-[60px] max-[640px]:py-9">
            <div className="grid gap-10">
              {GROUPS.map((group) => (
                <div key={group.title}>
                  <span className={EYEBROW}>FAQ</span>
                  <h2 className={`mt-2 mb-5 ${H2}`}>{group.title}</h2>
                  <div className="grid gap-3">
                    {group.items.map((item) => (
                      <details
                        key={item.q}
                        className="group rounded-2xl border border-hair bg-raise-1 shadow-e1 [&[open]]:shadow-e2"
                      >
                        <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-[15.5px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                          {item.q}
                          <span className="shrink-0 text-blue transition-transform duration-dur ease-ease group-open:rotate-45">
                            +
                          </span>
                        </summary>
                        <div className="px-5 pb-5 text-[14.5px] leading-[1.65] text-bodytext">
                          {item.a}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact strip */}
        <section className="border-t border-hair bg-raise-1 dark:border-t-[color-mix(in_srgb,var(--blue)_12%,var(--hair))] dark:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--blue)_6%,transparent),transparent)]">
          <div className="mx-auto max-w-wrap px-6 py-[56px] max-[640px]:py-9">
            <span className={EYEBROW}>Still need help?</span>
            <h2 className={`mt-2 mb-6 ${H2}`}>Talk to a human</h2>
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
              <a
                href="tel:+8809600000000"
                className="flex items-center gap-3 rounded-2xl border border-hair bg-bg p-5 shadow-e1 transition-transform duration-dur ease-ease hover:-translate-y-[2px]"
              >
                <span className="text-[22px]">📞</span>
                <span>
                  <span className="block text-[13px] font-semibold uppercase tracking-[.06em] text-bodytext">
                    Call us
                  </span>
                  <span className="block text-[15px] font-semibold text-ink">
                    +880 9600 000 000
                  </span>
                </span>
              </a>
              <a
                href="mailto:hello@haorboat.com"
                className="flex items-center gap-3 rounded-2xl border border-hair bg-bg p-5 shadow-e1 transition-transform duration-dur ease-ease hover:-translate-y-[2px]"
              >
                <span className="text-[22px]">✉️</span>
                <span>
                  <span className="block text-[13px] font-semibold uppercase tracking-[.06em] text-bodytext">
                    Email us
                  </span>
                  <span className="block text-[15px] font-semibold text-ink">
                    hello@haorboat.com
                  </span>
                </span>
              </a>
              <a
                href="https://wa.me/8809600000000"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-hair bg-bg p-5 shadow-e1 transition-transform duration-dur ease-ease hover:-translate-y-[2px]"
              >
                <span className="text-[22px]">✆</span>
                <span>
                  <span className="block text-[13px] font-semibold uppercase tracking-[.06em] text-bodytext">
                    WhatsApp
                  </span>
                  <span className="block text-[15px] font-semibold text-ink">
                    Chat with us
                  </span>
                </span>
              </a>
            </div>
          </div>
        </section>
      </main>

      <CustomerFooter />
    </>
  );
}
