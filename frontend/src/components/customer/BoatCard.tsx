import Link from 'next/link';
import type { SearchBoat } from '@/lib/customer/types';
import { badgeFor, photoFor } from '@/lib/customer/boat-card';
import { money } from '@/lib/owner/format';

/**
 * Home "featured" boat card (design: haorboat-home-v2.html lines 225–246).
 * Tailwind utilities keyed off the CSS-var design tokens (bg-raise-1, text-ink,
 * …) so it auto-switches with the [data-theme] dark toggle.
 *
 * The search results use the denser SearchBoatCard instead — see that file for
 * the spec diff. Photo/badge helpers are shared via lib/customer/boat-card.ts so
 * the two cards cannot drift.
 */
export function BoatCard({ boat }: { boat: SearchBoat }) {
  const region = boat.routes[0]?.route;
  const routeLabel = region
    ? `${region.name}${region.region ? ` · ${region.region}` : ''}`
    : 'Bangladesh';
  const acLabel = boat.hasAc && boat.hasNonAc ? 'AC & non-AC' : boat.hasAc ? 'All AC' : 'Non-AC';
  const badge = badgeFor(boat);
  const cabinLabel = `${boat.cabinCount} ${boat.cabinCount === 1 ? 'cabin' : 'cabins'}`;

  return (
    <article className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-hair bg-raise-1 shadow-[var(--e2),var(--top-hi)] transition-[transform,box-shadow] duration-200 ease-ease hover:-translate-y-1.5 hover:shadow-e3 dark:border-[color-mix(in_srgb,var(--blue)_12%,var(--hair))] dark:bg-[linear-gradient(160deg,color-mix(in_srgb,var(--blue)_8%,var(--raise-1)),var(--raise-1)_62%)] dark:hover:border-[color-mix(in_srgb,var(--blue)_34%,var(--hair))]">
      <div className="relative aspect-[16/11] overflow-hidden bg-chip">
        {badge ? (
          <span className="absolute left-3 top-3 z-[2] rounded-sm bg-blue px-[11px] py-[5px] text-[11px] font-bold tracking-[.02em] text-white shadow-[0_4px_10px_-3px_rgba(15,36,64,.4)]">
            {badge}
          </span>
        ) : null}
        <button
          type="button"
          aria-label="Save"
          className="absolute right-[11px] top-[11px] z-[2] grid h-9 w-9 place-items-center rounded-full border border-hair bg-raise-1 text-base text-blue shadow-e1 transition-transform hover:scale-110"
        >
          ♡
        </button>
        <img
          alt={boat.name}
          loading="lazy"
          src={photoFor(boat.id)}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.07]"
        />
      </div>
      <div className="flex grow flex-col px-[18px] py-4">
        <div className="flex items-start justify-between gap-2.5">
          <h3 className="font-display text-[17px] tracking-[-.02em]">{boat.name}</h3>
          {boat.ratingAvg != null ? (
            <span className="flex items-center gap-1 whitespace-nowrap text-[13px] font-bold tabular-nums text-ink">
              <i className="not-italic text-amber">★</i> {boat.ratingAvg.toFixed(1)}{' '}
              <span className="font-medium text-muted">({boat.reviewCount})</span>
            </span>
          ) : (
            <span className="whitespace-nowrap text-[13px] font-semibold text-muted">New</span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[13.5px] font-medium text-muted">
          📍 {routeLabel}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-sm border border-hair bg-chip px-2.5 py-[5px] text-xs font-medium text-bodytext">
            🛏️ {cabinLabel} · {boat.maxCapacity} guests
          </span>
          <span className="rounded-sm border border-hair bg-chip px-2.5 py-[5px] text-xs font-medium text-bodytext">
            ❄️ {acLabel}
          </span>
        </div>
        <div className="mt-auto flex items-end justify-between border-t border-hair-2 pt-3.5">
          <div className="font-display text-[21px] font-bold tabular-nums tracking-[-.03em] text-ink">
            {boat.priceFrom != null ? (
              <>
                {money(boat.priceFrom)}
                <small className="block font-sans text-xs font-medium tracking-normal text-muted">
                  per person / cabin
                </small>
              </>
            ) : (
              <small className="block font-sans text-xs font-medium tracking-normal text-muted">
                See pricing
              </small>
            )}
          </div>
          <Link
            className="text-[13.5px] font-bold text-blue"
            href={`/boat/${boat.slug}`}
          >
            View →
          </Link>
        </div>
      </div>
    </article>
  );
}
