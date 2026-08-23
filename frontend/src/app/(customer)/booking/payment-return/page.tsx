import { Suspense } from 'react';
import { CustomerNav } from '@/components/customer/CustomerNav';
import { CustomerFooter } from '@/components/customer/CustomerFooter';
import { getCustomerSession } from '@/lib/customer/session';
import { PaymentReturn } from './PaymentReturn';

/**
 * Payment return / booking confirmation (design: haorboat-confirmation.html).
 *
 * SSLCommerz redirects the browser here after payment — the URL and its
 * `?invoice=` param are hardcoded in the backend gateway redirect, so neither
 * may be renamed. The IPN is the source of truth (a forged return can't confirm
 * anything), so the client island POLLS the invoice and only shows "paid" once
 * the server records it.
 */
export default async function PaymentReturnPage() {
  const session = await getCustomerSession();
  const user = session.status === 'authenticated' ? session.user : null;
  return (
    <>
      {/* ambient layers — hooks live in _home/home-effects.css (preview 310–312) */}
      <div className="aurora-move print:hidden" aria-hidden="true" />
      <div className="orbfield print:hidden" aria-hidden="true">
        <span className="orb o-a" />
        <span className="orb o-b" />
        <span className="orb o-c" />
      </div>

      {/* Nav and footer are shared components, so the print:hidden lives on a
          wrapper here rather than inside them — hiding them globally would
          change how every other customer page prints. */}
      <div className="print:hidden">
        <CustomerNav user={user} />
      </div>
      {/* reads ?invoice= from the URL, so it needs the Suspense boundary */}
      <Suspense fallback={null}>
        <PaymentReturn />
      </Suspense>
      <div className="print:hidden">
        <CustomerFooter />
      </div>
    </>
  );
}
