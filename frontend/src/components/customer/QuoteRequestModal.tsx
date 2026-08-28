'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { apiErrorMessage } from '@/lib/owner/format';

const INPUT =
  'w-full rounded border border-hair bg-field px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-blue focus:shadow-ring';

/**
 * Ask the owner for a whole-boat custom price (POST /houseboats/:id/quotes).
 * The caller only opens this once the guest is signed in — quote creation is an
 * authenticated route. Mirrors the CashoutModal pattern in the wallet page.
 */
export function QuoteRequestModal({
  boatId,
  boatName,
  onClose,
}: {
  boatId: string;
  boatName: string;
  onClose: () => void;
}) {
  const [date, setDate] = useState('');
  const [groupSize, setGroupSize] = useState('');
  const [specialNeeds, setSpecialNeeds] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      await api.post(`/houseboats/${boatId}/quotes`, {
        date: date || undefined,
        groupSize: groupSize ? Number(groupSize) : undefined,
        specialNeeds: specialNeeds.trim() || undefined,
      });
      setDone(true);
    } catch (e) {
      setErr(apiErrorMessage(e, 'Could not send your quote request.'));
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-[min(460px,100%)] rounded-2xl border border-hair bg-raise-1 p-6 shadow-e3"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <>
            <div className="mb-1 text-3xl">✅</div>
            <h2 className="font-display text-lg font-semibold text-ink">
              Quote request sent
            </h2>
            <p className="mt-1.5 text-[13.5px] text-bodytext">
              {boatName}&rsquo;s owner will send you a whole-boat price. Track it and
              reply from{' '}
              <Link
                href="/account/quotes"
                className="font-semibold text-blue hover:underline"
              >
                Account → Custom quotes
              </Link>
              .
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded bg-blue px-5 py-2.5 text-sm font-bold text-white shadow-e1 transition-colors hover:bg-blue-600"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-display text-lg font-semibold text-ink">
              Get a custom quote
            </h2>
            <p className="mt-1 text-[13px] text-muted">
              Tell {boatName}&rsquo;s owner your plan and they&rsquo;ll send a
              whole-boat price. No payment now.
            </p>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-[13px] font-semibold text-bodytext">
                Preferred date
              </span>
              <input
                type="date"
                className={INPUT}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-[13px] font-semibold text-bodytext">
                Group size
              </span>
              <input
                type="number"
                min={1}
                className={INPUT}
                value={groupSize}
                onChange={(e) => setGroupSize(e.target.value)}
                placeholder="e.g. 24"
              />
            </label>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-[13px] font-semibold text-bodytext">
                Details
              </span>
              <textarea
                className={`${INPUT} min-h-[84px] resize-y`}
                value={specialNeeds}
                onChange={(e) => setSpecialNeeds(e.target.value)}
                placeholder="Occasion, meals, route, anything the owner should know…"
              />
            </label>

            {err ? (
              <div className="mt-3 text-[13px] font-semibold text-danger">{err}</div>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="inline-flex items-center justify-center rounded border border-hair bg-raise-1 px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:border-blue hover:text-blue disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="inline-flex items-center justify-center rounded bg-blue px-5 py-2.5 text-sm font-bold text-white shadow-e1 transition-colors hover:bg-blue-600 disabled:opacity-60"
              >
                {busy ? 'Sending…' : 'Send request'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
