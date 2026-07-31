/**
 * Shared upper bounds for string DTO fields.
 *
 * The global ValidationPipe rejects unknown properties but says nothing about
 * length, so without an explicit @MaxLength every string field accepts input
 * up to the request body limit. Bounding them keeps oversized values out of
 * the database and off the CPU (hashing, image paths, JSON payloads).
 *
 * These are deliberately generous — the goal is a sane ceiling, not input
 * design. Prefer one of these over an ad-hoc number so limits stay consistent.
 */

/** Slugs, codes, enum-ish values, currency codes, units. */
export const LEN_CODE = 64;

/** Names, titles, labels, single-line identifiers. */
export const LEN_NAME = 120;

/** Single-line free text: descriptions, reasons, notes, addresses. */
export const LEN_TEXT = 500;

/** Multi-line free text: reviews, safety notes, menus, long descriptions. */
export const LEN_LONG_TEXT = 5_000;

/** URLs (browsers cap around 2k; be a little stricter). */
export const LEN_URL = 2_048;
