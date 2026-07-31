import {
  cursorArgs,
  toPage,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type Page,
} from './paginate';

/**
 * Pagination bugs are quiet: an off-by-one drops or repeats a row rather than
 * throwing, and on a finance table that means a payout silently missing from
 * a reviewer's screen.
 */
describe('cursor pagination', () => {
  interface Row {
    id: string;
  }
  const rows = (n: number, start = 0): Row[] =>
    Array.from({ length: n }, (_, i) => ({ id: `id-${start + i}` }));

  describe('cursorArgs', () => {
    it('fetches one extra row to detect a further page', () => {
      expect(cursorArgs({ limit: 10 }).take).toBe(11);
    });

    it('defaults the limit when absent', () => {
      expect(cursorArgs({}).take).toBe(DEFAULT_PAGE_SIZE + 1);
    });

    it('clamps above the maximum', () => {
      expect(cursorArgs({ limit: 10_000 }).take).toBe(MAX_PAGE_SIZE + 1);
    });

    it('omits cursor args on the first page', () => {
      const args = cursorArgs({ limit: 5 });
      expect(args).not.toHaveProperty('cursor');
      expect(args).not.toHaveProperty('skip');
    });

    it('skips the cursor row itself on later pages', () => {
      const args = cursorArgs({ limit: 5, cursor: 'id-4' });
      expect(args).toMatchObject({ cursor: { id: 'id-4' }, skip: 1 });
    });

    it('orders newest first (UUIDv7 is time-ordered)', () => {
      expect(cursorArgs({}).orderBy).toEqual({ id: 'desc' });
    });
  });

  describe('toPage', () => {
    it('trims the lookahead row and reports the next cursor', () => {
      const page = toPage(rows(11), { limit: 10 });
      expect(page.items).toHaveLength(10);
      expect(page.nextCursor).toBe('id-9');
    });

    it('returns a null cursor on the last page', () => {
      const page = toPage(rows(7), { limit: 10 });
      expect(page.items).toHaveLength(7);
      expect(page.nextCursor).toBeNull();
    });

    it('handles an exactly-full final page', () => {
      // Exactly `limit` rows means there was no lookahead → no further page.
      const page = toPage(rows(10), { limit: 10 });
      expect(page.items).toHaveLength(10);
      expect(page.nextCursor).toBeNull();
    });

    it('handles an empty result', () => {
      const page = toPage<Row>([], { limit: 10 });
      expect(page.items).toEqual([]);
      expect(page.nextCursor).toBeNull();
    });

    it('never drops or repeats a row across pages', () => {
      const all = rows(25);
      const seen: string[] = [];
      let cursor: string | null = null;

      for (let guard = 0; guard < 10; guard++) {
        const start: number = cursor
          ? all.findIndex((r) => r.id === cursor) + 1
          : 0;
        const slice: Row[] = all.slice(start, start + 11); // as cursorArgs fetches
        const page: Page<Row> = toPage<Row>(slice, {
          limit: 10,
          cursor: cursor ?? undefined,
        });
        seen.push(...page.items.map((r: Row) => r.id));
        cursor = page.nextCursor;
        if (!cursor) break;
      }

      expect(seen).toEqual(all.map((r) => r.id));
      expect(new Set(seen).size).toBe(all.length);
    });
  });
});
