import { redirect } from 'next/navigation';
import { AdminChrome } from '@/components/admin/AdminChrome';
import { getAdminSession } from '@/lib/admin/session';
import { loginUrl } from '@/lib/admin/login-url';

// Console chrome (sidebar + topbar) for all admin pages except login.
//
// This is the real authorization gate for /admin/*. It's a Server Component,
// so the check runs before any console markup is sent — unlike middleware.ts,
// which can only see that a cookie exists. Every platform API route is
// independently guarded by @PlatformOnly(), so this is defence in depth, not
// the only barrier.
export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  // No ?next= on these hops. Middleware already redirects (preserving the
  // destination) whenever no session cookie is present, so reaching this branch
  // means a cookie EXISTS but the backend rejected it or is unreachable — and a
  // Server Component can't see its own pathname without middleware stamping it
  // onto the request headers, which is what broke CSS emission in dev before.
  if (session.status === 'unavailable') {
    // Distinguished from signed-out so the login page can say "not a password
    // problem" instead of letting the user retype a correct password.
    redirect(loginUrl({ reason: 'backend_down' }));
  }
  if (session.status === 'anonymous') {
    redirect(loginUrl({ reason: 'session_expired' }));
  }

  // Authenticated but not staff: a customer or boat owner. Deliberately no
  // ?next= — it would point into a console they can never enter, so returning
  // them there after re-login would just bounce them straight back here.
  if (!session.user.isPlatform) redirect(loginUrl({ reason: 'not_staff' }));

  return <AdminChrome user={session.user}>{children}</AdminChrome>;
}
