import { redirect } from 'next/navigation';
import { CustomerNav } from '@/components/customer/CustomerNav';
import { AccountSidebar } from '@/components/customer/AccountSidebar';
import { getCustomerSession } from '@/lib/customer/session';
import { customerLoginUrl } from '@/lib/customer/login-url';

/**
 * Gated account shell. The authoritative auth check (middleware only tests that
 * a cookie exists). An anonymous/expired session is bounced to login with a
 * ?next= back here; an API outage is surfaced rather than misreported as
 * signed-out.
 */
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCustomerSession();

  if (session.status === 'anonymous') {
    redirect(customerLoginUrl({ next: '/account/trips', reason: 'session_expired' }));
  }
  if (session.status === 'unavailable') {
    redirect(customerLoginUrl({ reason: 'backend_down' }));
  }

  const user = session.status === 'authenticated' ? session.user : null;

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
