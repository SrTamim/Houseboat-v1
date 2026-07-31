/**
 * Cursor pagination primitives.
 *
 * Deliberately decorator-free: pagination.dto.ts imports the bounds from here
 * rather than the reverse, so this module (and its tests) can be used without
 * reflect-metadata being loaded first.
 */

/** Envelope for a cursor-paginated list. */
export interface Page<T> {
  items: T[];
  /** Pass back as `cursor` for the next page; null when the list is exhausted. */
  nextCursor: string | null;
}

export const MAX_PAGE_SIZE = 200;
export const DEFAULT_PAGE_SIZE = 50;

/** Just the fields paging needs; the DTO satisfies this structurally. */
export interface PageQuery {
  limit?: number;
  cursor?: string;
}

/**
 * Prisma arguments for a cursor page.
 *
 * Fetches limit+1 rows so the caller can tell whether another page exists
 * without a second COUNT query. Pair with `toPage`.
 *
 *   const rows = await prisma.invoice.findMany({
 *     ...cursorArgs(query),
 *     where: { status },
 *   });
 *   return toPage(rows, query);
 */
export function cursorArgs(query: PageQuery) {
  const limit = clampLimit(query.limit);
  return {
    take: limit + 1,
    orderBy: { id: 'desc' } as const,
    ...(query.cursor
      ? // skip:1 steps past the cursor row itself, which the client already has.
        { cursor: { id: query.cursor }, skip: 1 }
      : {}),
  };
}

/**
 * Trim the extra lookahead row and derive the next cursor.
 * `rows` must be the result of a query built with `cursorArgs`.
 */
export function toPage<T extends { id: string }>(
  rows: T[],
  query: PageQuery,
): Page<T> {
  const limit = clampLimit(query.limit);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return {
    items,
    nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
  };
}

/**
 * The ValidationPipe already enforces these bounds, but services are also
 * called directly (jobs, tests), so clamp rather than trust.
 */
function clampLimit(limit?: number): number {
  if (!limit || !Number.isFinite(limit)) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_PAGE_SIZE);
}
