'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { apiErrorMessage } from '@/lib/owner/format';

const INPUT =
  'w-full rounded border border-hair bg-field px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-blue focus:shadow-ring';

type Method = 'bkash' | 'nagad' | 'bank';

const METHODS: { value: Method; label: string }[] = [
  { value: 'bkash', label: 'bKash' },
  { value: 'nagad', label: 'Nagad' },
  { value: 'bank', label: 'Bank' },
];

/**
 * Collect where to send a host-cancelled trip's refund (POST
 * /booking/:id/request-refund). Full amount paid is refunded — no figure is
 * entered here, only the payout destination, stored encrypted for the admin.
 * Mirrors the QuoteRequestModal / cash-out form pattern.
 */
export function RefundRequestModal({
  bookingId,
  onClose,
  onDone,
}: {
  bookingId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [method, setMethod] = useState<Method>('bkash');
  const [accountRef, setAccountRef] = useState('');
  const [accountName, setAccountName] = useState('');
  const [bankName, setBankName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isBank = method === 'bank';

  const submit = async () => {
    setErr(null);
    if (accountRef.trim().length < 3) {
      setErr('Enter the account/number to send your refund to.');
      return;
    }
    if (isBank && !bankName.trim()) {
      setErr('Bank name is required for a bank refund.');
      return;
    }
    setBusy(true);
    try {
      await api.post(`/booking/${bookingId}/request-refund`, {
        method,
        accountRef: accountRef.trim(),
        accountName: accountName.trim() || undefined,
        bankName: isBank ? bankName.trim() : undefined,
      });
      onDone();
    } catch (e) {
      setErr(apiErrorMessage(e, 'Could not submit your refund request.'));
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
        <h2 className="font-display text-lg font-semibold text-ink">
          Request your refund
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          The host cancelled this trip, so you get a full refund of what you paid.
          Tell us where to send it — our team will transfer it to this account.
        </p>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[13px] font-semibold text-bodytext">
            Refund to
          </span>
          <div className="flex gap-2">
            {METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMethod(m.value)}
                className={`flex-1 rounded border px-3 py-2 text-[13px] font-bold transition-colors ${
                  method === m.value
                    ? 'border-blue bg-[color-mix(in_srgb,var(--blue)_10%,transparent)] text-blue'
                    : 'border-hair bg-raise-1 text-bodytext hover:text-ink'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </label>

        {isBank ? (
          <label className="mt-4 block">
            <span className="mb-1.5 block text-[13px] font-semibold text-bodytext">
              Bank name
            </span>
            <input
              className={INPUT}
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g. BRAC Bank"
            />
          </label>
        ) : null}

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[13px] font-semibold text-bodytext">
            {isBank ? 'Account number' : `${method === 'bkash' ? 'bKash' : 'Nagad'} number`}
          </span>
          <input
            className={INPUT}
            value={accountRef}
            onChange={(e) => setAccountRef(e.target.value)}
            placeholder={isBank ? 'Account number' : '01XXXXXXXXX'}
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[13px] font-semibold text-bodytext">
            Account holder name{' '}
            <span className="font-normal text-muted">(optional)</span>
          </span>
          <input
            className={INPUT}
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="Name on the account"
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
            {busy ? 'Submitting…' : 'Submit request'}
          </button>
        </div>
      </div>
    </div>
  );
}
