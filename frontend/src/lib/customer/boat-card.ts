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
export function photoFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  const id = PHOTOS[Math.abs(h) % PHOTOS.length];
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=640&q=65`;
}

/**
 * Overlay badge, derived from data we already have (first match wins). There is
 * no discount data yet, so the amber `-15%` variant is never produced.
 */
export function badgeFor(boat: SearchBoat): string | null {
  if (boat.ratingAvg != null && boat.ratingAvg >= 4.8) return 'Top rated';
  if (boat.safetyFeatures.length > 0) return 'Safety-verified';
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
