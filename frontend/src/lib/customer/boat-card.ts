import type { SearchBoat } from './types';

/**
 * Shared presentation helpers for the boat result cards. Both the home featured
 * card (components/customer/BoatCard.tsx) and the denser search card
 * (components/customer/SearchBoatCard.tsx) import these so the two can never
 * drift — a given boat must show the same photo and the same badge on both
 * pages.
 */

/**
 * Stock scenery photos (from the design preview). The backend has no per-boat
 * image yet, so each card gets a stable photo derived from its id — same boat
 * always shows the same photo, and the grid looks varied like the preview.
 */
export const PHOTOS = [
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
function hash(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Unsplash URL for one pool entry at the given render width. */
function url(id: string, width: number): string {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=65`;
}

export function photoFor(key: string): string {
  return url(PHOTOS[hash(key) % PHOTOS.length], 640);
}

/**
 * `n` *distinct* stock photos for a key, starting at the same entry `photoFor`
 * picks and walking the pool from there — so a boat's first fallback photo is
 * identical in the cards and in the gallery, and the rest are simply the next
 * ones round.
 *
 * Exists because a gallery needs a set: with one image the lightbox has nothing
 * to page through and correctly hides its controls. Owners have uploaded almost
 * no photos yet, so without this the carousel is dead on most boats.
 *
 * `n` is capped at the pool size; asking for more just returns the whole pool.
 */
export function photosFor(key: string, n: number): string[] {
  const start = hash(key) % PHOTOS.length;
  const count = Math.min(n, PHOTOS.length);
  return Array.from({ length: count }, (_, i) =>
    url(PHOTOS[(start + i) % PHOTOS.length], 900),
  );
}

/**
 * Overlay badge, derived from data we already have (first match wins). There is
 * no discount data yet, so the amber `-15%` variant is never produced.
 */
export function badgeFor(boat: SearchBoat): string | null {
  if (boat.ratingAvg != null && boat.ratingAvg >= 4.8) return 'Top rated';
  if (boat.safetyFeatures?.trim()) return 'Safety-verified';
  if (boat.hasAc && !boat.hasNonAc) return 'All AC';
  return null;
}

/**
 * Blue-tinted surface gradient + hairline used on card-like surfaces in dark
 * mode. Not expressible through the CSS-var colour tokens (they carry a single
 * colour, not a gradient), so it stays a `dark:` utility string.
 */
export const DARK_CARD_SURFACE =
  'dark:border-[color-mix(in_srgb,var(--blue)_12%,var(--hair))] dark:bg-[linear-gradient(160deg,color-mix(in_srgb,var(--blue)_8%,var(--raise-1)),var(--raise-1)_62%)]';

/**
 * The funnel's primary call to action — Reserve on the boat page, Pay on
 * checkout. Shared so the two ends of one flow cannot drift apart; both render
 * a full-width button, so width overrides (`w-auto px-7`) are appended at the
 * call site rather than baked in here.
 */
export const PRIMARY_BTN =
  'inline-flex w-full items-center justify-center gap-2 rounded border border-transparent bg-blue px-7 py-3.5 text-base font-semibold text-white shadow-[var(--e1),inset_0_1px_0_rgba(255,255,255,.18)] transition-[background,transform] duration-dur ease-ease hover:bg-blue-600 active:translate-y-[.5px] disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none';

/**
 * Nav-scale buttons (`.btn.btn-o` / `.btn.btn-b`, home preview 106–113). Shared
 * with the confirmation page's action row so the two cannot drift; they size
 * themselves, unlike PRIMARY_BTN which is full-width by default.
 */
export const NAV_BTN_O =
  'inline-flex items-center gap-2 whitespace-nowrap rounded border border-hair bg-raise-1 px-[22px] py-[11px] text-[14.5px] font-semibold leading-none text-ink shadow-e1 transition-[background,border-color,box-shadow,transform] duration-dur ease-ease hover:border-[color-mix(in_srgb,var(--blue)_45%,var(--hair))] hover:bg-[color-mix(in_srgb,var(--blue)_6%,var(--raise-1))] hover:text-blue active:translate-y-[.5px]';

export const NAV_BTN_B =
  'inline-flex items-center gap-2 whitespace-nowrap rounded border border-transparent bg-blue px-[22px] py-[11px] text-[14.5px] font-semibold leading-none text-white shadow-[var(--e1),inset_0_1px_0_rgba(255,255,255,.18)] transition-[background,border-color,box-shadow,transform] duration-dur ease-ease hover:bg-blue-600 active:translate-y-[.5px]';
