import Link from 'next/link';
import type { SearchBoat } from '@/lib/customer/types';
import { money } from '@/lib/owner/format';

/**
 * Boat result card, shared by the home "featured" grid and the search results
 * (design: `.card` in haorboat-home-v2 / haorboat-search). All fields are
 * escaped JSX bindings from the server rollup — no innerHTML, no client math.
 */
export function BoatCard({ boat }: { boat: SearchBoat }) {
  const region = boat.routes[0]?.route;
  const routeLabel = region
    ? `${region.name}${region.region ? ` · ${region.region}` : ''}`
    : 'Bangladesh';
  const acLabel = boat.hasAc && boat.hasNonAc ? 'AC & non-AC' : boat.hasAc ? 'All AC' : 'Non-AC';

  return (
    <article className="card">
      <div className="ph">
        {boat.hasAc && !boat.hasNonAc ? (
          <span className="badge">All AC</span>
        ) : null}
        <img
          alt={boat.name}
          loading="lazy"
          src="https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=640&q=65"
        />
      </div>
      <div className="body">
        <div className="rowt">
          <h3>{boat.name}</h3>
          {boat.ratingAvg != null ? (
            <span className="rate">
              <i>★</i> {boat.ratingAvg.toFixed(1)}{' '}
              <span>({boat.reviewCount})</span>
            </span>
          ) : (
            <span className="rate">
              <span>New</span>
            </span>
          )}
        </div>
        <div className="route">📍 {routeLabel}</div>
        <div className="cfeat">
          <span>🛏️ up to {boat.maxCapacity} guests</span>
          <span>❄️ {acLabel}</span>
        </div>
        <div className="cfoot">
          <div className="price">
            {boat.priceFrom != null ? (
              <>
                ৳ {money(boat.priceFrom)}
                <small>per person / cabin</small>
              </>
            ) : (
              <>
                <small>See pricing</small>
              </>
            )}
          </div>
          <Link className="cbtn" href={`/boat/${boat.slug}`}>
            View →
          </Link>
        </div>
      </div>
    </article>
  );
}
