'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { money, formatDate, timeLeft, humanize, apiErrorMessage } from '@/lib/owner/format';
import type { CustomQuote } from '@/lib/customer/types';

const CARD =
  'overflow-hidden rounded-2xl border border-hair bg-raise-1 shadow-e1';
const INPUT =
  'w-full rounded border border-hair bg-field px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-blue focus:shadow-ring';

const STATUS_TONE: Record<string, string> = {
  requested: 'bg-[color-mix(in_srgb,var(--amber)_14%,transparent)] text-[#8a5a00]',
  sent: 'bg-[color-mix(in_srgb,var(--blue)_12%,transparent)] text-blue',
  accepted: 'bg-[color-mix(in_srgb,var(--ok)_12%,transparent)] text-ok',
  expired: 'bg-[color-mix(in_srgb,var(--muted)_12%,transparent)] text-muted',
};

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'requested', label: 'Requested' },
  { value: 'sent', label: 'Priced' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'expired', label: 'Expired' },
];

/** Custom (whole-boat) quotes the customer has requested. Reads /me/quotes. */
export default function QuotesPage() {
  const { data, error, isLoading, mutate } = useSWR<CustomQuote[]>(
    '/me/quotes',
    fetcher,
    { revalidateOnFocus: false },
  );
  const [filter, setFilter] = useState('');

  const all = data ?? [];
  const rows = all.filter((q) => !filter || q.status === filter);
  const counts = all.reduce<Record<string, number>>((acc, q) => {
    acc[q.status] = (acc[q.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <div>
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.02em] text-ink">
          Custom quotes
        </h1>
        <p className="mt-1 text-[14px] text-bodytext">
          Whole-boat prices you asked owners for. When an owner sends a price you
          have 24 hours to accept it.
        </p>
      </div>

      {/* filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          const n = f.value ? counts[f.value] ?? 0 : all.length;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13.5px] font-semibold transition-colors ${
                active
                  ? 'border-blue bg-[color-mix(in_srgb,var(--blue)_10%,transparent)] text-blue'
                  : 'border-hair bg-raise-1 text-bodytext hover:text-ink'
              }`}
            >
              {f.label}
              <span className="text-[12px] opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className={`${CARD} px-5 py-8 text-muted`}>Loading…</div>
      ) : error ? (
        <div className={`${CARD} px-5 py-8`}>
          <p className="text-muted">Couldn&rsquo;t load your quotes.</p>
          <button
            type="button"
            onClick={() => mutate()}
            className="mt-3 inline-flex items-center rounded border border-hair bg-raise-1 px-4 py-2 text-sm font-bold text-ink hover:border-blue hover:text-blue"
          >
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className={`${CARD} px-6 py-12 text-center text-muted`}>
          <div className="mb-2.5 text-[26px]">💬</div>
          <h4 className="mb-1.5 text-[15px] text-ink">No custom quotes yet</h4>
          <p className="mx-auto max-w-[46ch] text-[13px] leading-[1.55]">
            On any boat page, open the group section and tap{' '}
            <b className="text-ink">Get a custom quote</b> to ask the owner for a
            whole-boat price.
          </p>
        </div>
      ) : (
        <div className="grid gap-3.5">
          {rows.map((q) => (
            <QuoteCard key={q.id} quote={q} onChange={() => mutate()} />
          ))}
        </div>
      )}
    </>
  );
}

function QuoteCard({
  quote: q,
  onChange,
}: {
  quote: CustomQuote;
  onChange: () => void;
}) {
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState<null | 'accept' | 'reply'>(null);
  const [err, setErr] = useState<string | null>(null);

  const canRespond = q.status === 'requested' || q.status === 'sent';
  const expired =
    q.status === 'expired' ||
    (q.expiresAt ? timeLeft(q.expiresAt) === 'expired' : false);

  const accept = async () => {
    setErr(null);
    setBusy('accept');
    try {
      await api.post(`/quotes/${q.id}/accept`);
      onChange();
    } catch (e) {
      setErr(apiErrorMessage(e, 'Could not accept this quote.'));
      setBusy(null);
    }
  };

  const sendReply = async () => {
    if (!reply.trim()) return;
    setErr(null);
    setBusy('reply');
    try {
      await api.post(`/quotes/${q.id}/reply`, { message: reply.trim() });
      setReply('');
      onChange();
    } catch (e) {
      setErr(apiErrorMessage(e, 'Could not send your reply.'));
      setBusy(null);
    }
  };

  return (
    <div className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hair px-5 py-4">
        <div>
          {q.houseboat ? (
            <Link
              href={`/boat/${q.houseboat.slug}`}
              className="font-display text-[16px] font-semibold text-ink hover:text-blue"
            >
              {q.houseboat.name}
            </Link>
          ) : (
            <span className="font-display text-[16px] font-semibold text-ink">
              Houseboat
            </span>
          )}
          <div className="mt-0.5 text-[12.5px] text-muted">
            {formatDate(q.date)}
            {q.groupSize ? ` · ${q.groupSize} guests` : ''}
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[12px] font-extrabold ${
            STATUS_TONE[q.status] ?? STATUS_TONE.expired
          }`}
        >
          {humanize(q.status)}
        </span>
      </div>

      <div className="px-5 py-4">
        {q.specialNeeds ? (
          <p className="mb-3 text-[13.5px] text-bodytext">
            <b className="text-ink">Your request:</b> {q.specialNeeds}
          </p>
        ) : null}

        {q.status === 'requested' ? (
          <p className="text-[13.5px] text-muted">
            Waiting for the owner to send you a price.
          </p>
        ) : null}

        {q.quotedPrice ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="font-display text-[24px] font-black tracking-[-0.02em] text-ink">
              {money(q.quotedPrice)}
              <small className="ml-1.5 font-sans text-[11px] font-semibold text-muted">
                full boat
              </small>
            </div>
            {q.status === 'sent' && q.expiresAt ? (
              <span className="rounded-full bg-[color-mix(in_srgb,var(--amber)_14%,transparent)] px-3 py-1 text-[12px] font-bold text-[#8a5a00]">
                {timeLeft(q.expiresAt)}
              </span>
            ) : null}
          </div>
        ) : null}

        {q.customerReply ? (
          <p className="mt-3 rounded-lg border border-hair bg-bg px-3.5 py-2.5 text-[13px] text-bodytext">
            <b className="text-ink">Your reply:</b> {q.customerReply}
          </p>
        ) : null}

        {q.status === 'sent' && !expired ? (
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={accept}
              disabled={busy !== null}
              className="inline-flex items-center justify-center rounded bg-blue px-5 py-2.5 text-sm font-bold text-white shadow-e1 transition-colors hover:bg-blue-600 disabled:opacity-60"
            >
              {busy === 'accept' ? 'Accepting…' : 'Accept this price'}
            </button>
          </div>
        ) : null}

        {canRespond && !expired ? (
          <div className="mt-4">
            <label className="mb-1.5 block text-[13px] font-semibold text-bodytext">
              {q.customerReply ? 'Send another note' : 'Reply to the owner'}
            </label>
            <textarea
              className={`${INPUT} min-h-[72px] resize-y`}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Ask a question or add details for the owner…"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={sendReply}
                disabled={busy !== null || !reply.trim()}
                className="inline-flex items-center justify-center rounded border border-hair bg-raise-1 px-4 py-2 text-sm font-bold text-ink transition-colors hover:border-blue hover:text-blue disabled:opacity-50"
              >
                {busy === 'reply' ? 'Sending…' : 'Send reply'}
              </button>
            </div>
          </div>
        ) : null}

        {err ? (
          <div className="mt-3 text-[13px] font-semibold text-danger">{err}</div>
        ) : null}
      </div>
    </div>
  );
}
