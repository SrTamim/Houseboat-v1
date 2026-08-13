import { Suspense } from 'react';
import { CustomerNav } from '@/components/customer/CustomerNav';
import { getCustomerSession } from '@/lib/customer/session';
import { PaymentReturn } from './PaymentReturn';

/**
 * Payment return / confirmation (design: haorboat-confirmation.html). SSLCommerz
 * redirects the browser here after payment. The IPN is the source of truth — a
 * forged return can't confirm anything — so this page POLLS the invoice status
 * and only shows "paid" once the server records it.
 */
export default async function PaymentReturnPage() {
  const session = await getCustomerSession();
  const user = session.status === 'authenticated' ? session.user : null;
  return (
    <>
      <CustomerNav user={user} />
      <Suspense fallback={null}>
        <PaymentReturn />
      </Suspense>
    </>
  );
}
