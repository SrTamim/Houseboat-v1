'use client';

import {
  PageHead,
  Card,
  TableWrap,
  TableSkeleton,
  EmptyState,
  ErrorState,
} from '@/components/admin/ui';
import { useAdminList } from '@/lib/admin/useAdminList';

interface ReviewRow {
  id: string;
  rating: number;
  text: string | null;
  ownerReply: string | null;
  houseboat: { id: string; name: string };
  customer: { id: string; name: string | null };
  booking: { id: string; createdAt: string };
}

function Stars({ rating }: { rating: number }) {
  const full = Math.max(0, Math.min(5, rating));
  return (
    <span>
      <span style={{ color: 'var(--amber)' }}>{'★'.repeat(full)}</span>
      {'☆'.repeat(5 - full)}
    </span>
  );
}

export default function Reviews() {
  const { items, error, isInitialLoading, hasMore, loadMore, mutate } =
    useAdminList<ReviewRow>('/platform/ops/reviews', { limit: 25 });

  return (
    <>
      <PageHead
        title="Reviews"
        desc="Reviews come only from verified, completed bookings — the eligibility gate blocks fakes at the source."
      />
      <Card flush>
        {error ? (
          <ErrorState error={error} onRetry={() => mutate()} />
        ) : !isInitialLoading && items.length === 0 ? (
          <EmptyState
            title="No reviews yet"
            desc="Reviews appear here once customers complete trips and rate them."
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <th>Boat</th>
                  <th>Rating</th>
                  <th>Review</th>
                  <th>Owner reply</th>
                </tr>
              </thead>
              {isInitialLoading ? (
                <TableSkeleton rows={5} cols={4} />
              ) : (
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id}>
                      <td className="t1">{r.houseboat.name}</td>
                      <td><Stars rating={r.rating} /></td>
                      <td>
                        {r.text ?? <span className="t2">no text</span>}
                        <div className="t2">
                          {r.customer.name ?? 'Customer'} · verified booking
                        </div>
                      </td>
                      <td className="t2">{r.ownerReply ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              )}
            </TableWrap>
            {hasMore ? (
              <div style={{ padding: 12, textAlign: 'center' }}>
                <button className="btn btn-o btn-sm" onClick={loadMore}>
                  Load more
                </button>
              </div>
            ) : null}
          </>
        )}
      </Card>
    </>
  );
}
