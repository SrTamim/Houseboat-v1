'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import {
  PageHead,
  Card,
  Note,
  TableWrap,
  TableSkeleton,
  EmptyState,
  ErrorState,
  Search,
  Select,
} from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';
import { useAdminList } from '@/lib/admin/useAdminList';
import { apiErrorMessage } from '@/lib/admin/api-error';
import { BTN_DANGER, BTN_O, BTN_OK, BTN_SM, FILTERBAR, ROWACT, TD_T1, TD_T2 } from '@/components/admin/styles';

interface ReviewRow {
  id: string;
  rating: number;
  text: string | null;
  ownerReply: string | null;
  hidden: boolean;
  houseboat: { id: string; name: string };
  customer: { id: string; name: string | null };
  booking: { id: string; createdAt: string };
}

const VISIBILITY_OPTIONS = [
  { value: '', label: 'All reviews' },
  { value: 'false', label: 'Visible only' },
  { value: 'true', label: 'Hidden only' },
];

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
  const [query, setQuery] = useState('');
  const [hidden, setHidden] = useState('');
  const { items, error, isInitialLoading, hasMore, loadMore, mutate } =
    useAdminList<ReviewRow>('/platform/ops/reviews', {
      q: query || undefined,
      hidden: hidden || undefined,
      limit: 25,
    });

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function setReviewHidden(review: ReviewRow, next: boolean) {
    if (busyId) return;
    setBusyId(review.id);
    setActionError(null);
    try {
      await api.patch(`/platform/ops/reviews/${review.id}/hidden`, {
        hidden: next,
      });
      await mutate();
    } catch (e) {
      setActionError(apiErrorMessage(e, 'Could not update this review.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHead
        title="Reviews"
        desc="Reviews come only from verified, completed bookings — the eligibility gate blocks fakes at the source. Hide a review to withhold it from the public boat page and its rating average."
      />
      <div className={FILTERBAR}>
        <Search
          placeholder="Search review, customer or boat…"
          value={query}
          onChange={setQuery}
        />
        <Select options={VISIBILITY_OPTIONS} value={hidden} onChange={setHidden} />
      </div>
      {actionError ? (
        <div className="mb-3" role="alert"><Note kind="danger" icon="⚠">{actionError}</Note></div>
      ) : null}
      <Card flush>
        {error ? (
          <ErrorState error={error} onRetry={() => mutate()} />
        ) : !isInitialLoading && items.length === 0 ? (
          <EmptyState
            title={query || hidden ? 'No reviews match' : 'No reviews yet'}
            desc={
              query || hidden
                ? 'Try a different search or visibility filter.'
                : 'Reviews appear here once customers complete trips and rate them.'
            }
          />
        ) : (
          <>
            <TableWrap minWidth={820}>
              <thead>
                <tr>
                  <th>Boat</th>
                  <th>Rating</th>
                  <th>Review</th>
                  <th>Owner reply</th>
                  <th>Visibility</th>
                  <th />
                </tr>
              </thead>
              {isInitialLoading ? (
                <TableSkeleton rows={5} cols={6} />
              ) : (
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id} className={`group${r.hidden ? ' opacity-60' : ''}`}>
                      <td className={TD_T1}>{r.houseboat.name}</td>
                      <td><Stars rating={r.rating} /></td>
                      <td>
                        {r.text ?? <span className={TD_T2}>no text</span>}
                        <div className={TD_T2}>
                          {r.customer.name ?? 'Customer'} · verified booking
                        </div>
                      </td>
                      <td className={TD_T2}>{r.ownerReply ?? '—'}</td>
                      <td>
                        <Pill tone={r.hidden ? 'warn' : 'ok'}>
                          {r.hidden ? 'hidden' : 'visible'}
                        </Pill>
                      </td>
                      <td className={ROWACT}>
                        {r.hidden ? (
                          <button
                            className={`${BTN_OK} ${BTN_SM}`}
                            disabled={busyId === r.id}
                            onClick={() => setReviewHidden(r, false)}
                          >
                            {busyId === r.id ? '…' : 'Unhide'}
                          </button>
                        ) : (
                          <button
                            className={`${BTN_DANGER} ${BTN_SM}`}
                            disabled={busyId === r.id}
                            onClick={() => setReviewHidden(r, true)}
                          >
                            {busyId === r.id ? '…' : 'Hide'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </TableWrap>
            {hasMore ? (
              <div style={{ padding: 12, textAlign: 'center' }}>
                <button className={`${BTN_O} ${BTN_SM}`} onClick={loadMore}>
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
