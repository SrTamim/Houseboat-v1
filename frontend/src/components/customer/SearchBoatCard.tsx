import Link from 'next/link';
import type { SearchBoat } from '@/lib/customer/types';
import { DARK_CARD_SURFACE, badgeFor, photoFor } from '@/lib/customer/boat-card';
import { money } from '@/lib/owner/format';

/**
 * Search-results boat card (design: haorboat-search.html CSS lines 123–145).
 *
 * Deliberately denser than the home featured card (components/customer/
 * BoatCard.tsx, from haorboat-home-v2.html): 16/10 photo, 15px title, 17px/900
 * price, tighter chips and padding, and a filled "Book now" pill instead of a
 * text link. The search grid sits beside a 270px filter rail, so the preview
 * trades per-card breathing room for more results per screen.
 *
 * `flex flex-col` + `mt-auto` on the footer equalises card heights across each
 * fixed 3-up row.
 *
 * Photo and badge come from lib/customer/boat-card.ts, shared with BoatCard so a
 * given boat renders the same photo on both pages.
 */
export function SearchBoatCard({ boat }: { boat: SearchBoat }) {
  const region = boat.routes[0]?.route;
  const routeLabel = region
    ? `${region.name}${region.region ? ` · ${region.region}` : ''}`
    : 'Bangladesh';
  const acLabel = boat.hasAc && boat.hasNonAc ? 'AC & non-AC' : boat.hasAc ? 'All AC' : 'Non-AC';
  const badge = badgeFor(boat);
  const cabinLabel = `${boat.cabinCount} ${boat.cabinCount === 1 ? 'cabin' : 'cabins'}`;

  return (
    <article
      className={`group flex flex-col overflow-hidden rounded-2xl border border-hair bg-raise-1 shadow-[var(--e1),var(--top-hi)] transition-[transform,box-shadow] duration-200 ease-ease hover:-translate-y-[5px] hover:shadow-e3 dark:hover:border-[color-mix(in_srgb,var(--blue)_34%,var(--hair))] ${DARK_CARD_SURFACE}`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-chip max-[560px]:aspect-[16/7]">
        {badge ? (
          <span className="absolute left-[10px] top-[10px] z-[2] rounded-[6px] bg-blue px-[9px] py-1 text-[10.5px] font-extrabold tracking-[.02em] text-white shadow-[0_4px_10px_-3px_rgba(15,36,64,.4)]">
            {badge}
          </span>
        ) : null}
        <button
          type="button"
          aria-label="Save"
          className="absolute right-[9px] top-[9px] z-[2] grid h-8 w-8 place-items-center rounded-full border border-hair bg-raise-1 text-sm text-blue shadow-e1 transition-transform hover:scale-110"
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

      <div className="flex flex-1 flex-col px-[14px] pb-[14px] pt-3">
        <div className="flex items-start justify-between gap-2">
          <h3
            title={boat.name}
            className="line-clamp-1 min-w-0 font-display text-[15px] leading-[1.3] tracking-[-.02em]"
          >
            {boat.name}
          </h3>
          {boat.ratingAvg != null ? (
            <span className="flex items-center gap-[3px] whitespace-nowrap text-xs font-extrabold tabular-nums text-ink">
              <i className="not-italic text-amber">★</i> {boat.ratingAvg.toFixed(1)}{' '}
              <span className="font-medium text-muted">({boat.reviewCount})</span>
            </span>
          ) : (
            <span className="whitespace-nowrap text-xs font-semibold text-muted">New</span>
          )}
        </div>

        <div
          title={routeLabel}
          className="mt-1 truncate text-[12.5px] font-medium text-muted"
        >
          📍 {routeLabel}
        </div>

        {/* Single line, always: a wrapping chip row was what made cards
            different heights. Overflow clips rather than reflowing. */}
        <div className="mt-[9px] flex flex-nowrap gap-1.5 overflow-hidden">
          <span className="shrink-0 whitespace-nowrap rounded-[6px] border border-hair bg-chip px-2 py-[3px] text-[11px] font-semibold text-bodytext">
            🛏️ {cabinLabel} · {boat.maxCapacity} guests
          </span>
          <span className="shrink-0 whitespace-nowrap rounded-[6px] border border-hair bg-chip px-2 py-[3px] text-[11px] font-semibold text-bodytext">
            ❄️ {acLabel}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2.5 border-t border-hair pt-[11px]">
          {/* Always two lines — a one-line "See pricing" variant would make
              un-priced cards shorter than the rest. */}
          <div className="min-w-0 font-display text-[17px] font-black tabular-nums tracking-[-.03em] text-ink">
            <span className="block truncate">
              {boat.priceFrom != null ? money(boat.priceFrom) : '—'}
            </span>
            <small className="block truncate font-sans text-[10.5px] font-semibold tracking-normal text-muted">
              {boat.priceFrom != null ? 'per person / cabin' : 'See pricing'}
            </small>
          </div>
          <Link
            href={`/boat/${boat.slug}`}
            className="whitespace-nowrap rounded-full border-none bg-blue px-4 py-[9px] text-[13px] font-extrabold text-white shadow-[0_4px_12px_-5px_var(--blue)] transition-[background,transform] duration-dur ease-ease hover:-translate-y-px hover:bg-blue-600"
          >
            Book now
          </Link>
        </div>
      </div>
    </article>
  );
}
