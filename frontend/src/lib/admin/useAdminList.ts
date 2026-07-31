'use client';

import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';

/** Mirrors the backend `Page<T>` envelope from common/paginate.ts. */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

type Params = Record<string, string | number | boolean | undefined | null>;

/**
 * Build a stable query string.
 *
 * Keys are sorted and empty values dropped so the same logical filter always
 * produces the same SWR cache key — otherwise `{a,b}` and `{b,a}` would fetch
 * twice and render from two separate caches.
 */
function buildKey(path: string, params: Params): string {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return path;
  const qs = entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return `${path}?${qs.join('&')}`;
}

/**
 * Read a paginated platform list endpoint.
 *
 * Standard shape for admin tables: pass a path and filters, get back the rows
 * plus the async state the AsyncTable primitive expects.
 *
 *   const { items, isLoading, error, mutate } =
 *     useAdminList<Batch>('/platform/finance/payout-batches', { houseboatId });
 *
 * Pagination is "load more" rather than numbered pages, because the backend
 * uses cursors (no total count) — see backend/src/common/paginate.ts.
 */
export function useAdminList<T>(path: string, params: Params = {}) {
  const [cursor, setCursor] = useState<string | null>(null);
  const [accumulated, setAccumulated] = useState<T[]>([]);

  // Callers pass an object literal, so `params` is a new reference every
  // render. Depend on the serialized key instead or this memo never hits.
  const filterKey = buildKey(path, params);

  // Changing a filter must restart paging — otherwise page 2 of the old
  // filter would be appended to page 1 of the new one.
  const [activeFilter, setActiveFilter] = useState(filterKey);
  if (activeFilter !== filterKey) {
    setActiveFilter(filterKey);
    setCursor(null);
    setAccumulated([]);
  }

  const key = cursor
    ? `${filterKey}${filterKey.includes('?') ? '&' : '?'}cursor=${cursor}`
    : filterKey;

  const { data, error, isLoading, mutate } = useSWR<Page<T>>(key, fetcher, {
    // Admin data changes on human timescales; refetching on every tab focus
    // is noise, and it would fight the accumulated-pages state below.
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  // Earlier pages plus the current one. Resetting `accumulated` when the
  // filter changes is handled by keying off filterKey below.
  const items = cursor ? [...accumulated, ...(data?.items ?? [])] : (data?.items ?? []);

  const loadMore = useCallback(() => {
    if (!data?.nextCursor) return;
    setAccumulated(items);
    setCursor(data.nextCursor);
  }, [data?.nextCursor, items]);

  const reset = useCallback(() => {
    setAccumulated([]);
    setCursor(null);
  }, []);

  return {
    items,
    error,
    isLoading,
    /** True while the first page is in flight (not subsequent "load more"). */
    isInitialLoading: isLoading && !cursor,
    hasMore: Boolean(data?.nextCursor),
    loadMore,
    reset,
    mutate,
  };
}
