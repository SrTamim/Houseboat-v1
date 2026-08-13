'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { money } from '@/lib/owner/format';

interface InvoiceView {
  id: string;
  bookingId: string;
  status: string;
  displayTotal: string;
  amountPaid: string;
  discountAmount: string;
}

type Phase = 'polling' | 'paid' | 'partial' | 'pending' | 'error';

/**
 * Polls GET /me/invoices/:id until the IPN records the payment. Shows the
 * paid/due split once settled. We poll (not trust the redirect) because only the
 * server-to-server IPN is authoritative — a forged browser return can't confirm.
 */
export function PaymentReturn() {
  const params = useSearchParams();
  const invoiceId = params.get('invoice');
  const [invoice, setInvoice] = useState<InvoiceView | null>(null);
  const [phase, setPhase] = useState<Phase>('polling');
  const tries = useRef(0);

  useEffect(() => {
    if (!invoiceId) {
      setPhase('error');
      return;
    }
    let stop = false;
    const poll = async () => {
      try {
        const { data } = await api.get<InvoiceView>(`/me/invoices/${invoiceId}`);
        if (stop) return;
        setInvoice(data);
        const paid = Number(data.amountPaid);
        const total = Number(data.displayTotal);
        if (data.status === 'paid' || (paid > 0 && paid >= total)) {
          setPhase('paid');
          return;
        }
        if (paid > 0) {
          setPhase('partial');
          return;
        }
        tries.current += 1;
        if (tries.current >= 12) {
          setPhase('pending');
          return;
        }
        setTimeout(poll, 2500);
      } catch {
        if (!stop) setPhase('error');
      }
    };
    poll();
    return () => {
      stop = true;
    };
  }, [invoiceId]);

  const paidNow = invoice ? Number(invoice.amountPaid) : 0;
  const total = invoice ? Number(invoice.displayTotal) : 0;
  const due = Math.max(total - paidNow, 0);
  const settled = phase === 'paid' || phase === 'partial';

  return (
    <div className="wrap">
      <div className="success">
        <div className="tick">
          {phase === 'polling' ? '⏳' : phase === 'pending' ? '🕑' : '✓'}
        </div>
        {phase === 'error' ? (
          <>
            <h1>We couldn’t find that payment</h1>
            <p>
              Check your trips — if you were charged, the booking is there.
            </p>
          </>
        ) : phase === 'polling' ? (
          <>
            <h1>Confirming your payment…</h1>
            <p>Hang tight — we’re verifying with the payment gateway.</p>
          </>
        ) : phase === 'pending' ? (
          <>
            <h1>Payment is being confirmed</h1>
            <p>
              This can take a moment. Your booking will appear in My trips once
              the gateway confirms.
            </p>
          </>
        ) : (
          <>
            <h1>{phase === 'partial' ? 'Advance received!' : 'Booking confirmed!'}</h1>
            <p>
              Your cabins are locked in. A voucher has been sent to your phone
              &amp; email.
            </p>
          </>
        )}
      </div>

      {settled && invoice ? (
        <>
          <div className="paid-split">
            <div className="psplit ok">
              <div className="l">
                Paid now{phase === 'partial' ? ' (50% advance)' : ''}
              </div>
              <div className="v">৳ {money(paidNow)}</div>
            </div>
            <div className="psplit">
              <div className="l">Due at boarding</div>
              <div className="v">{due > 0 ? `৳ ${money(due)}` : 'Nothing due'}</div>
            </div>
          </div>

          <div className="nsteps">
            <div className="nstep">
              <span className="i">📱</span>
              <div>
                <b>Voucher sent.</b> Check your SMS &amp; email for the e-voucher
                and QR code.
              </div>
            </div>
            {due > 0 ? (
              <div className="nstep">
                <span className="i">💳</span>
                <div>
                  <b>Due at boarding.</b> Pay the remaining balance in cash or
                  bKash when you board.
                </div>
              </div>
            ) : null}
            <div className="nstep">
              <span className="i">🛟</span>
              <div>
                <b>Bring your NID.</b> Every adult guest needs a valid
                NID/passport at the ghat.
              </div>
            </div>
          </div>
        </>
      ) : null}

      <div className="actions noprint">
        <Link className="btn btn-b" href="/account/trips">
          View my trips
        </Link>
        <Link className="btn btn-o" href="/search">
          Browse more boats
        </Link>
      </div>
    </div>
  );
}
