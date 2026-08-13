import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CustomerNav } from '@/components/customer/CustomerNav';
import { CustomerFooter } from '@/components/customer/CustomerFooter';
import { getCustomerSession } from '@/lib/customer/session';
import { serverGet } from '@/lib/customer/server-fetch';
import type {
  BoatDetail,
  Departure,
  DepartureCabins,
  GroupBand,
} from '@/lib/customer/types';
import { BoatBooking } from './BoatBooking';

/**
 * Boat detail (design: haorboat-boat.html). Server-rendered header + overview
 * for SEO/first paint; the interactive cabin selection, group bands, live
 * availability and price summary are the BoatBooking client island.
 */
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
  const availability = firstDeparture
    ? await serverGet<DepartureCabins>(
        `/houseboats/${slug}/departures/${firstDeparture.id}/cabins`,
      )
    : null;

  const region = boat.routes[0]?.route;
  const loc = region
    ? `${region.name}${region.region ? ` · ${region.region}` : ''}`
    : 'Bangladesh';

  return (
    <>
      <CustomerNav user={user} />
      <section className="detail">
        <div className="wrap">
          <div className="crumbs">
            <Link href="/">Home</Link> ›{' '}
            <Link href="/search">Houseboats</Link> › <b>{boat.name}</b>
          </div>
          <div className="dhead">
            <h1>{boat.name}</h1>
            <span className="dloc">📍 {loc}</span>
            {boat.safetyFeatures.length > 0 ? (
              <span className="verified">🛟 Safety-verified</span>
            ) : null}
          </div>

          <div className="overview">
            <div className="gallery">
              <a>
                <img
                  alt={boat.name}
                  loading="lazy"
                  src="https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=900&q=70"
                />
              </a>
              <a>
                <img
                  alt="Sundeck"
                  loading="lazy"
                  src="https://images.unsplash.com/photo-1502933691298-84fc14542831?auto=format&fit=crop&w=500&q=70"
                />
              </a>
              <a>
                <img
                  alt="Water view"
                  loading="lazy"
                  src="https://images.unsplash.com/photo-1527004013197-933c4bb611b3?auto=format&fit=crop&w=500&q=70"
                />
              </a>
            </div>
            <div className="ov-info">
              <h2>About this boat</h2>
              <p>{boat.description ?? 'A houseboat cruising the haor wetlands.'}</p>
              {boat.safetyFeatures.length > 0 ? (
                <>
                  <h2>Facilities</h2>
                  <div className="facils">
                    {boat.safetyFeatures.map((f) => (
                      <div className="facil" key={f}>
                        <span className="fi">🛟</span> {f}
                      </div>
                    ))}
                  </div>
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
          />
        </div>
      </section>
      <CustomerFooter />
    </>
  );
}
