import Link from 'next/link';

interface Offer {
  gradient: string;
  tag: string;
  title: string;
  body: React.ReactNode;
  link: string;
}

/** The three offer cards, gradients from the preview (`.offer.o1/o2/o3`, 257–259). */
const OFFERS: Offer[] = [
  {
    gradient: 'bg-[linear-gradient(135deg,#1560d6,#3b8bff)]',
    tag: 'Eid special',
    title: 'Up to 25% off Tanguar Haor cruises',
    body: 'Book a 2-night monsoon trip and save on every AC cabin.',
    link: 'Grab deal →',
  },
  {
    gradient: 'bg-[linear-gradient(135deg,#0f766e,#14b8a6)]',
    tag: 'Group saver',
    title: 'Charter a full boat, pay for 8',
    body: 'Groups of 10+ get two seats free on Nikli & Padma routes.',
    link: 'See group rates →',
  },
  {
    gradient: 'bg-[linear-gradient(135deg,#b45309,#f6a623)]',
    tag: 'First trip',
    title: '৳500 off your first booking',
    body: (
      <>
        New to HaorBoat? Use code{' '}
        <b className="rounded-[5px] bg-white/[.22] px-[7px] py-px font-display text-[13px] tabular-nums">
          HAOR500
        </b>{' '}
        at checkout.
      </>
    ),
    link: 'Start booking →',
  },
];

/**
 * Special offers strip, rebuilt in Tailwind from the design preview
 * (haorboat-home-v2.html lines 249–265, dark 356–359, markup 583–608). Static
 * content. Each card's soft radial sparkle overlay is the `.offer-fx::after`
 * hook in home-effects.css.
 */
export function HomeOffers() {
  return (
    <section
      id="offers"
      className="border-t border-hair bg-raise-1 dark:border-t-[color-mix(in_srgb,var(--blue)_12%,var(--hair))] dark:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--blue)_6%,transparent),transparent)]"
    >
      <div className="mx-auto max-w-wrap px-6 py-[60px]">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-[13px] font-bold uppercase tracking-[.09em] text-blue dark:[text-shadow:0_0_16px_rgba(90,160,255,.3)]">
              Limited time
            </span>
            <h2 className="mt-2 font-display text-3xl tracking-[-.03em]">Special offers</h2>
          </div>
          <Link
            className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-blue transition-[gap] duration-dur ease-ease hover:gap-2.5"
            href="/search"
          >
            All offers <span>→</span>
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-[22px] max-[640px]:grid-cols-1">
          {OFFERS.map((o) => (
            <Link
              key={o.tag}
              href="/search"
              className={`offer-fx group relative isolate flex min-h-[210px] flex-col overflow-hidden rounded-2xl px-[26px] pb-6 pt-7 text-white shadow-e2 transition-[transform,box-shadow] duration-[.18s] ease-ease hover:-translate-y-[5px] hover:shadow-e3 ${o.gradient}`}
            >
              <span className="self-start rounded-full border border-white/35 bg-white/[.22] px-[11px] py-[5px] text-[11.5px] font-bold uppercase tracking-[.05em] backdrop-blur-[4px]">
                {o.tag}
              </span>
              <h3 className="mb-2 mt-4 text-xl leading-[1.25] text-white">{o.title}</h3>
              <p className="text-sm leading-[1.55] text-white/[.92]">{o.body}</p>
              <span className="mt-auto inline-flex gap-1.5 pt-3.5 text-[14.5px] font-bold transition-[gap] duration-dur ease-ease group-hover:gap-[11px]">
                {o.link}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
