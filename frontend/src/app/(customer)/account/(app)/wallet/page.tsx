'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { money } from '@/lib/owner/format';
import type { WalletView } from '@/lib/customer/types';

/** Wallet & credits (design: haorboat-account-wallet.html). Reads /me/credits. */
export default function WalletPage() {
  const { data, error, isLoading } = useSWR<WalletView>('/me/credits', fetcher, {
    revalidateOnFocus: false,
  });

  return (
    <>
      <div className="page-head">
        <h1>Wallet &amp; credits</h1>
        <p>Credit is applied automatically at your next checkout.</p>
      </div>

      <div className="balance">
        <div className="lab">Available credit</div>
        <div className="big">৳ {money(data?.balance ?? '0')}</div>
        <p>
          Applies automatically at checkout on your next trip. Credit never
          expires and is tied to your phone number.
        </p>
        <div className="acts">
          <Link className="btn btn-w" href="/search">
            Use credit on a booking →
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="ch">
          <h3>Credit history</h3>
        </div>
        {isLoading ? (
          <p style={{ color: 'var(--muted)' }}>Loading…</p>
        ) : error ? (
          <p style={{ color: 'var(--muted)' }}>Couldn’t load your credits.</p>
        ) : !data || data.credits.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>
            No credit yet. Refunds and overpayments show up here.
          </p>
        ) : (
          data.credits.map((c) => {
            const used = c.status === 'used';
            return (
              <div className="tx" key={c.id}>
                <div className={`ic ${used ? 'out' : 'in'}`}>{used ? '🎟️' : '＋'}</div>
                <div>
                  <div className="t">
                    {used ? 'Applied to a booking' : 'Credit added'}
                  </div>
                  <div className="d">
                    {used
                      ? 'Used at checkout'
                      : c.sourceInvoiceId
                        ? 'From a refund / overpayment'
                        : 'Account credit'}
                  </div>
                </div>
                <div
                  style={{
                    marginLeft: 'auto',
                    fontWeight: 800,
                    color: used ? 'var(--muted)' : 'var(--ok)',
                  }}
                >
                  {used ? '−' : '+'} ৳ {money(c.amount)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
