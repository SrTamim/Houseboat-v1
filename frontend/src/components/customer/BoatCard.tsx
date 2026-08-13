import Link from 'next/link';
import type { SearchBoat } from '@/lib/customer/types';
import { money } from '@/lib/owner/format';

/**
 * Stock scenery photos (from the design preview). The backend has no per-boat
 * image yet, so each card gets a stable photo derived from its id — same boat
 * always shows the same photo, and the grid looks varied like the preview.
 */
const PHOTOS = [
  'photo-1520454974749-611b7248ffdb',
  'photo-1502680390469-be75c86b636f',
  'photo-1503437313881-503a91226402',
  'photo-1444201983204-c43cbd584d93',
  'photo-1470071459604-3b5ec3a7fe05',
  'photo-1439066615861-d1af74d74000',
  'photo-1516426122078-c23e76319801',
  'photo-1544551763-46a013bb70d5',
];

/** Small deterministic hash so a given boat always maps to the same photo. */
function photoFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  const id = PHOTOS[Math.abs(h) % PHOTOS.length];
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=640&q=65`;
}

/**
 * Overlay badge, derived from data we already have (first match wins). There is
 * no discount data yet, so the amber `-15%` variant is never produced.
 */
function badgeFor(boat: SearchBoat): string | null {
  if (boat.ratingAvg != null && boat.ratingAvg >= 4.8) return 'Top rated';
  if (boat.safetyFeatures.length > 0) return 'Safety-verified';
  if (boat.hasAc && !boat.hasNonAc) return 'All AC';
  return null;
}

/**
 * Boat result card, shared by the home "featured" grid and the search results.
 * Tailwind utilities keyed off the CSS-var design tokens (bg-raise-1, text-ink,
 * …) so it auto-switches with the [data-theme] dark toggle.
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
    <article className="group overflow-hidden rounded-2xl border border-hair bg-raise-1 shadow-[var(--e2),var(--top-hi)] transition-[transform,box-shadow] duration-200 ease-ease hover:-translate-y-1.5 hover:shadow-e3 dark:border-[color-mix(in_srgb,var(--blue)_12%,var(--hair))] dark:bg-[linear-gradient(160deg,color-mix(in_srgb,var(--blue)_8%,var(--raise-1)),var(--raise-1)_62%)] dark:hover:border-[color-mix(in_srgb,var(--blue)_34%,var(--hair))]">
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
      <div className="px-[18px] py-4">
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
        <div className="mt-3.5 flex items-end justify-between border-t border-hair-2 pt-3.5">
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
