import { CustomerNav } from '@/components/customer/CustomerNav';
import { getCustomerSession } from '@/lib/customer/session';
import { CheckoutFlow } from './CheckoutFlow';

/**
 * Checkout (design: haorboat-checkout.html). The login wall lives here: the
 * page renders for everyone, but the flow requires a signed-in customer to take
 * holds + pay. A signed-out visitor is sent to /account/login?next=/checkout
 * with their selection preserved in sessionStorage (client-side, since the
 * selection is built anonymously on the boat page).
 */
export default async function CheckoutPage() {
  const session = await getCustomerSession();
  const user = session.status === 'authenticated' ? session.user : null;
  return (
    <>
      <CustomerNav user={user} />
      <CheckoutFlow
        signedIn={!!user}
        defaultName={user?.name ?? ''}
        defaultPhone={user?.phone ?? ''}
        defaultEmail={user?.email ?? ''}
      />
    </>
  );
}
