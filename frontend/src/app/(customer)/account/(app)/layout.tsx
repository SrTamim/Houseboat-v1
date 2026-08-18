import { CustomerNav } from '@/components/customer/CustomerNav';
import { AccountSidebar } from '@/components/customer/AccountSidebar';
import { AccountSignedOut } from '@/components/customer/AccountSignedOut';
import { getCustomerSession } from '@/lib/customer/session';

/**
 * Account shell, and the authoritative front-end auth check — the middleware
 * deliberately does not gate /account/* (customer sign-in is a modal, so there
 * is no login page to redirect to).
 *
 * When there's no session it renders AccountSignedOut INSTEAD of `children`.
 * That substitution is load-bearing: every account page fetches its data with
 * SWR on mount, so rendering them signed-out would fire a burst of 401s and
 * paint error states. An API outage is surfaced as such rather than misreported
 * as signed-out — offering a sign-in that cannot succeed would just confuse.
 */
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCustomerSession();
  const user = session.status === 'authenticated' ? session.user : null;

  if (!user) {
    return (
      <>
        <CustomerNav user={null} />
        <AccountSignedOut
          reason={session.status === 'unavailable' ? 'backend_down' : 'session_expired'}
        />
      </>
    );
  }

  return (
    <>
      <CustomerNav user={user} />
      <div className="shell">
        <AccountSidebar />
        <main className="main">{children}</main>
      </div>
    </>
  );
}
