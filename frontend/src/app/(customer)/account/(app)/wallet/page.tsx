'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { money, apiErrorMessage } from '@/lib/owner/format';
import type { WalletView } from '@/lib/customer/types';

const CARD =
  'overflow-hidden rounded-2xl border border-hair bg-raise-1 shadow-e1';
const CARD_HEAD =
  'flex items-center justify-between gap-3 border-b border-hair px-5 py-4';

type Method = 'bkash' | 'nagad' | 'bank';

/** Wallet & credits (design: haorboat-account-wallet.html). Reads /me/credits. */
export default function WalletPage() {
  const { data, error, isLoading, mutate } = useSWR<WalletView>(
    '/me/credits',
    fetcher,
    { revalidateOnFocus: false },
  );
  const [modalOpen, setModalOpen] = useState(false);

  const balance = data?.balance ?? '0';
  const pendingCashout = data?.pendingCashout ?? '0';
  const hasPending = Number(pendingCashout) > 0 || !!data?.pendingRequest;
  const canCashOut = Number(balance) > 0 && !hasPending;

  return (
    <>
      <div>
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.02em] text-ink">
          Wallet &amp; credits
        </h1>
      </div>

      {/* balance hero */}
      <div className="relative isolate overflow-hidden rounded-2xl bg-[linear-gradient(130deg,var(--blue-700),var(--blue))] px-[30px] py-7 text-white shadow-e2">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-[0.18]"
          style={{
            background:
              'radial-gradient(circle at 88% 12%,#fff 0,transparent 34%),radial-gradient(circle at 8% 108%,#fff 0,transparent 40%)',
          }}
        />
        <div className="text-[12.5px] font-bold uppercase tracking-[0.06em] text-[#dbe8ff]">
          Available credit
        </div>
        <div className="mt-1.5 font-display text-[44px] font-black tracking-[-0.03em]">
          {money(balance)}
        </div>
        <p className="mt-1.5 max-w-[44ch] text-[13.5px] text-[#e7eefb]">
          Credit never expires and is tied to your phone number. Cash it out to
          bKash, Nagad or your bank anytime.
        </p>
        <div className="mt-[18px] flex flex-wrap gap-2.5">
          <button
            type="button"
            disabled={!canCashOut}
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded bg-white px-5 py-2.5 text-sm font-bold text-blue-700 transition-colors hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Request cash-out
          </button>
        </div>
      </div>

      {/* pending cash-out banner */}
      {hasPending ? (
        <div className="flex items-start gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--amber)_30%,transparent)] bg-[color-mix(in_srgb,var(--amber)_8%,transparent)] px-5 py-4">
          <span className="text-xl">⏳</span>
          <div>
            <div className="font-display text-[15px] font-semibold text-ink">
              Cash-out of {money(pendingCashout)} is being reviewed
            </div>
            <p className="mt-1 text-[13px] text-bodytext">
              Our finance team is verifying your request. This balance is on hold and
              can&rsquo;t be spent on a booking until it&rsquo;s resolved. You&rsquo;ll
              be notified once the transfer is done.
            </p>
          </div>
        </div>
      ) : null}

      {/* credit history ledger */}
      <div className={CARD}>
        <div className={CARD_HEAD}>
          <h3 className="font-display text-[15px] font-semibold text-ink">
            Credit history
          </h3>
          <span className="text-xs font-semibold text-muted">append-only ledger</span>
        </div>
        {isLoading ? (
          <p className="px-5 py-4 text-muted">Loading…</p>
        ) : error ? (
          <p className="px-5 py-4 text-muted">Couldn&rsquo;t load your credits.</p>
        ) : !data || data.credits.length === 0 ? (
          <p className="px-5 py-4 text-muted">
            No credit yet. Refunds and overpayments show up here.
          </p>
        ) : (
          data.credits.map((c) => {
            const used = c.status === 'used';
            return (
              <div
                key={c.id}
                className="grid grid-cols-[42px_1fr_auto] items-center gap-3.5 border-b border-hair px-5 py-[15px] last:border-b-0"
              >
                <div
                  className={`grid h-[42px] w-[42px] place-items-center rounded-xl text-lg ${
                    used ? 'bg-[color-mix(in_srgb,var(--blue)_10%,transparent)] text-blue' : 'bg-[color-mix(in_srgb,var(--ok)_10%,transparent)] text-ok'
                  }`}
                >
                  {used ? '🎟️' : '＋'}
                </div>
                <div>
                  <div className="text-[14.5px] font-bold text-ink">
                    {used ? 'Applied to a booking' : 'Credit added'}
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-muted">
                    {used
                      ? 'Used at checkout'
                      : c.sourceInvoiceId
                        ? 'From a refund / overpayment'
                        : 'Account credit'}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`font-display text-[15px] font-extrabold ${
                      used ? 'text-muted' : 'text-ok'
                    }`}
                  >
                    {used ? '−' : '+'} {money(c.amount)}
                  </div>
                  <div className="mt-0.5 text-[11px] font-semibold text-muted">
                    {used ? 'spent' : 'credited'}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border border-[color-mix(in_srgb,var(--blue)_25%,transparent)] bg-[color-mix(in_srgb,var(--blue)_6%,transparent)] px-3.5 py-3 text-[13px] leading-snug text-bodytext">
        <span>ℹ️</span>
        <div>
          <b className="text-ink">Credit vs refund.</b> Credit is spendable on
          HaorBoat instantly. If you&rsquo;d rather have the money back to bank or
          bKash, request a cash-out &mdash; finance verifies it the same way as a
          refund.
        </div>
      </div>

      {modalOpen ? (
        <CashoutModal
          balance={balance}
          onClose={() => setModalOpen(false)}
          onDone={() => {
            setModalOpen(false);
            mutate();
          }}
        />
      ) : null}
    </>
  );
}

const CHIP =
  'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13.5px] font-semibold transition-colors';
const INPUT =
  'w-full rounded border border-hair bg-field px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-blue focus:shadow-ring';

function CashoutModal({
  balance,
  onClose,
  onDone,
}: {
  balance: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [method, setMethod] = useState<Method>('bkash');
  const [accountRef, setAccountRef] = useState('');
  const [bankName, setBankName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!accountRef.trim()) {
      setErr(method === 'bank' ? 'Enter your bank account number.' : 'Enter your number.');
      return;
    }
    if (method === 'bank' && !bankName.trim()) {
      setErr('Enter your bank name.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/me/cashout', {
        method,
        accountRef: accountRef.trim(),
        bankName: method === 'bank' ? bankName.trim() : undefined,
      });
      onDone();
    } catch (e) {
      setErr(apiErrorMessage(e, 'Could not submit your cash-out request.'));
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
        <h2 className="font-display text-lg font-semibold text-ink">Request cash-out</h2>
        <p className="mt-1 text-[13px] text-muted">
          We&rsquo;ll transfer your full available balance of{' '}
          <b className="text-ink">{money(balance)}</b>. Finance verifies every request
          before the money moves.
        </p>

        <div className="mt-4">
          <span className="mb-1.5 block text-[13px] font-semibold text-bodytext">
            Send to
          </span>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['bkash', '📱 bKash'],
                ['nagad', '💗 Nagad'],
                ['bank', '🏦 Bank'],
              ] as [Method, string][]
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`${CHIP} ${
                  method === m
                    ? 'border-blue bg-[color-mix(in_srgb,var(--blue)_10%,transparent)] text-blue'
                    : 'border-hair bg-raise-1 text-bodytext hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {method === 'bank' ? (
          <label className="mt-4 block">
            <span className="mb-1.5 block text-[13px] font-semibold text-bodytext">
              Bank name
            </span>
            <input
              className={INPUT}
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g. Dutch-Bangla Bank"
            />
          </label>
        ) : null}

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[13px] font-semibold text-bodytext">
            {method === 'bank' ? 'Account number' : `${method === 'bkash' ? 'bKash' : 'Nagad'} number`}
          </span>
          <input
            className={INPUT}
            value={accountRef}
            onChange={(e) => setAccountRef(e.target.value)}
            placeholder={method === 'bank' ? '0000 0000 0000' : '01XXXXXXXXX'}
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
            {busy ? 'Submitting…' : `Cash out ${money(balance)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
