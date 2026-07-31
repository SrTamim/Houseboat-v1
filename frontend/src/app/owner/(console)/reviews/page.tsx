'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import { PageHead, Card, Note, AsyncBlock, Field } from '@/components/owner/ui';
import { Pill } from '@/components/owner/Pill';
import { apiErrorMessage, formatDate, initials } from '@/lib/owner/format';

interface Review {
  id: string;
  rating: number;
  text: string | null;
  ownerReply: string | null;
  customer: { id: string; name: string | null } | null;
  booking?: { departure?: { startDate: string } } | null;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ color: 'var(--amber)', letterSpacing: 1 }}>
      {'★'.repeat(Math.max(0, Math.min(5, rating)))}
      <span style={{ color: 'var(--hair)' }}>{'★'.repeat(5 - Math.max(0, Math.min(5, rating)))}</span>
    </span>
  );
}

export default function OwnerReviewsPage() {
  const { boatId } = useActiveBoat();
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, error: loadError, isLoading, mutate } = useSWR<Review[]>(
    `/houseboats/${boatId}/reviews`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const reviews = data ?? [];
  const avg =
    reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : null;

  async function postReply(reviewId: string) {
    if (busy || !reply.trim()) return;
    setBusy(true);
    setError(null);
    try {
      // The boat id travels in the body: this route resolves permissions from
      // there rather than the path.
      await api.post(`/reviews/${reviewId}/reply`, { reply, houseboatId: boatId });
      setReplyFor(null);
      setReply('');
      await mutate();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not post your reply.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="Reviews"
        desc="Only guests who actually completed a trip can review it. Your reply is public — answer the ones that need context."
        actions={
          avg ? (
            <Pill tone="ok">
              {avg} ★ average · {reviews.length} reviews
            </Pill>
          ) : undefined
        }
      />

      {error ? (
        <Note kind="danger" style={{ marginBottom: 18 }}>
          {error}
        </Note>
      ) : null}

      <div className="stack" style={{ maxWidth: 800 }}>
        <AsyncBlock
          isLoading={isLoading}
          error={loadError}
          isEmpty={reviews.length === 0}
          onRetry={() => mutate()}
          empty={
            <Card>
              <div className="state">
                <div className="ic">★</div>
                <h4>No reviews yet</h4>
                <p>
                  A guest can review once their trip is completed. Nothing else opens the
                  form.
                </p>
              </div>
            </Card>
          }
        >
          {reviews.map((r) => (
            <Card key={r.id}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span
                  className="av"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'linear-gradient(145deg,var(--blue),var(--blue-700))',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    flex: 'none',
                  }}
                >
                  {initials(r.customer?.name)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <b style={{ color: 'var(--ink)' }}>{r.customer?.name ?? 'Guest'}</b>
                    {r.booking?.departure?.startDate ? (
                      <span className="t2">{formatDate(r.booking.departure.startDate)}</span>
                    ) : null}
                    <Pill tone="ok">verified trip</Pill>
                    <span style={{ marginLeft: 'auto' }}>
                      <Stars rating={r.rating} />
                    </span>
                  </div>

                  {r.text ? (
                    <p style={{ margin: '8px 0 0', lineHeight: 1.55 }}>{r.text}</p>
                  ) : null}

                  {r.ownerReply ? (
                    <div
                      style={{
                        marginTop: 12,
                        borderLeft: '3px solid var(--blue)',
                        background: 'var(--field)',
                        padding: '10px 14px',
                        borderRadius: 'var(--r-sm)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '.06em',
                          color: 'var(--muted)',
                          marginBottom: 4,
                        }}
                      >
                        Your reply
                      </div>
                      {r.ownerReply}
                    </div>
                  ) : replyFor === r.id ? (
                    <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                      <Field label="Your reply">
                        <textarea
                          rows={3}
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                          placeholder="Thank you for travelling with us…"
                        />
                      </Field>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-b btn-sm"
                          onClick={() => postReply(r.id)}
                          disabled={busy || !reply.trim()}
                        >
                          {busy ? 'Posting…' : 'Post reply'}
                        </button>
                        <button
                          className="btn btn-o btn-sm"
                          onClick={() => {
                            setReplyFor(null);
                            setReply('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="btn btn-o btn-sm"
                      style={{ marginTop: 12 }}
                      onClick={() => {
                        setReplyFor(r.id);
                        setReply('');
                      }}
                    >
                      Reply
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </AsyncBlock>
      </div>
    </>
  );
}
