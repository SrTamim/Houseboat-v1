import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CustomerNav } from '@/components/customer/CustomerNav';
import { CustomerFooter } from '@/components/customer/CustomerFooter';
import { BoatGallery } from '@/components/customer/BoatGallery';
import { getCustomerSession } from '@/lib/customer/session';
import { serverGet } from '@/lib/customer/server-fetch';
import { photosFor } from '@/lib/customer/boat-card';
import type {
  BoatDetail,
  Departure,
  DepartureCabins,
  GroupBand,
} from '@/lib/customer/types';
import { BoatBooking } from './BoatBooking';

/**
 * Boat detail (design: haorboat-boat.html, markup 535–576).
 *
 * Server-rendered head + overview for SEO and first paint; everything
 * interactive — cabin selection, group bands, availability, the live price
 * summary, the deck map and both dialogs — is the BoatBooking client island.
 *
 * Rebuilt in Tailwind against the v2 tokens (`bg-raise-1`, `border-hair`,
 * `text-ink`…), the same migration the nav, footer and boat cards already
 * went through. It deliberately emits no legacy `customer.css` class names.
 */

/** Chip in the quick-facts row (preview `.ov-quick span`, CSS 95–96). */
const CHIP =
  'rounded-lg border border-hair bg-chip px-[11px] py-1.5 text-[12.5px] font-bold text-bodytext';

export default async function BoatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [session, boat, departures, bands] = await Promise.all([
    getCustomerSession(),
    serverGet<BoatDetail>(`/houseboats/${slug}`),
    serverGet<Departure[]>(`/houseboats/${slug}/departures`),
    serverGet<GroupBand[]>(`/houseboats/${slug}/group-bands`),
  ]);

  if (!boat) notFound();
  const user = session.status === 'authenticated' ? session.user : null;

  const firstDeparture = departures?.[0] ?? null;
  // withCookies: availability is viewer-specific — the caller's own holds come
  // back as `held_by_me` rather than `booked`, which is what stops a reload from
  // rendering the guest's own cabin as fully booked. Needs the session or hb_gid
  // cookie, so this one read forwards them.
  const availability = firstDeparture
    ? await serverGet<DepartureCabins>(
        `/houseboats/${slug}/departures/${firstDeparture.id}/cabins`,
        { withCookies: true },
      )
    : null;

  const region = boat.routes[0]?.route;
  const loc = region
    ? `${region.name}${region.region ? ` · ${region.region}` : ''}`
    : 'Bangladesh';

  // Real uploads when the owner has enough for a gallery; otherwise the
  // deterministic stock set the search and home cards draw from, so the mosaic
  // renders three distinct tiles and the lightbox has something to page
  // through. A single real photo is padded for the same reason — one image
  // leaves the carousel with nothing to scroll.
  // Any real photo always leads; the stock set only pads out the tail so a
  // genuine upload is never hidden behind a placeholder.
  const photos =
    boat.photos.length > 1
      ? boat.photos
      : [...boat.photos, ...photosFor(boat.id, 5)];

  const cabinCount = boat.decks.reduce((n, d) => n + d.cabins.length, 0);
  const maxGuests = boat.decks.reduce(
    (n, d) =>
      n +
      d.cabins.reduce(
        (m, c) => m + (c.category.extendedCapacity ?? c.category.baseCapacity),
        0,
      ),
    0,
  );
  const duration = firstDeparture?.package.durationLabel;
  const ghat = firstDeparture?.package.departureGhat;

  return (
    <>
      {/* ambient layers — hooks live in _home/home-effects.css */}
      <div className="aurora-move" aria-hidden="true" />
      <div className="orbfield" aria-hidden="true">
        <span className="orb o-a" />
        <span className="orb o-b" />
        <span className="orb o-c" />
      </div>

      <CustomerNav user={user} />

      <section>
        <div className="mx-auto max-w-wrap px-6 pb-[60px] pt-[22px] max-[940px]:pb-[90px]">
          <nav
            aria-label="Breadcrumb"
            className="mb-3.5 text-[13px] text-muted"
          >
            <Link href="/" className="hover:text-blue">
              Home
            </Link>{' '}
            ›{' '}
            <Link href="/search" className="hover:text-blue">
              Houseboats
            </Link>{' '}
            › <b className="text-ink">{boat.name}</b>
          </nav>

          <div className="flex flex-wrap items-center gap-3.5">
            <h1 className="font-display text-[30px] font-semibold tracking-[-.02em] text-ink max-[640px]:text-2xl">
              {boat.name}
            </h1>
            {boat.ratingAvg != null ? (
              <span className="flex items-center gap-[5px] text-sm font-extrabold text-ink">
                <i className="not-italic text-amber">★</i>{' '}
                {boat.ratingAvg.toFixed(1)}{' '}
                <span className="font-semibold text-muted">
                  ({boat.reviewCount} review{boat.reviewCount === 1 ? '' : 's'})
                </span>
              </span>
            ) : (
              <span className="text-sm font-semibold text-muted">New</span>
            )}
            <span className="flex items-center gap-[5px] text-sm font-semibold text-muted">
              📍 {loc}
            </span>
            {boat.safetyFeatures?.trim() ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--ok)_30%,transparent)] bg-[color-mix(in_srgb,var(--ok)_12%,var(--raise-1))] px-3 py-[5px] text-[12.5px] font-extrabold text-ok">
                🛟 Safety-verified
              </span>
            ) : null}
          </div>

          {/* overview: gallery (half) + about / facilities (half) */}
          <div className="my-[18px] mb-[30px] grid grid-cols-2 items-start gap-[26px] max-[940px]:grid-cols-1">
            <BoatGallery photos={photos} boatName={boat.name} />

            <div>
              <h2 className="mb-2.5 font-display text-[19px] font-semibold text-ink">
                About this boat
              </h2>
              <p className="text-[14.5px] text-bodytext">
                {boat.description ??
                  'A houseboat cruising the wetlands of Bangladesh’s haors.'}
              </p>

              <div className="mt-3.5 flex flex-wrap gap-2">
                {cabinCount > 0 ? (
                  <span className={CHIP}>🛏️ {cabinCount} cabins</span>
                ) : null}
                {maxGuests > 0 ? (
                  <span className={CHIP}>👥 up to {maxGuests} guests</span>
                ) : null}
                {duration ? <span className={CHIP}>🕑 {duration}</span> : null}
                {ghat ? <span className={CHIP}>⚓ Boards at {ghat}</span> : null}
              </div>

              {boat.safetyFeatures?.trim() ? (
                <>
                  <h2 className="mb-2.5 mt-[22px] font-display text-[19px] font-semibold text-ink">
                    Safety &amp; facilities
                  </h2>
                  <p className="text-[14.5px] text-bodytext">
                    {boat.safetyFeatures}
                  </p>
                </>
              ) : null}
            </div>
          </div>

          <BoatBooking
            slug={slug}
            boat={boat}
            departures={departures ?? []}
            bands={bands ?? []}
            initialAvailability={availability}
            isSignedIn={!!user}
            boatPhotos={photos}
          />
        </div>
      </section>

      <CustomerFooter />
    </>
  );
}
