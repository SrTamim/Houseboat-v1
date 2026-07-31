import { redirect } from 'next/navigation';
import { getOwnerSession } from '@/lib/owner/session';
import { ownerLoginUrl } from '@/lib/owner/login-url';
import { OwnerBoatProvider } from '@/lib/owner/boat-context';
import { OwnerChrome } from '@/components/owner/OwnerChrome';

/**
 * Authorization gate for the owner console.
 *
 * A Server Component so the check happens before anything renders — the
 * middleware only tests that a cookie exists (Edge runtime, no JWT secret), so
 * this is where access is actually decided.
 *
 * The three failure modes get different treatment on purpose: an API outage
 * must not be reported to a valid owner as "signed out", and an account with no
 * boats must not be handed a ?next= that would bounce it straight back here.
 */
export default async function OwnerConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getOwnerSession();

  if (session.status === 'unavailable') {
    redirect(ownerLoginUrl({ reason: 'backend_down' }));
  }
  if (session.status === 'anonymous') {
    redirect(ownerLoginUrl({ reason: 'session_expired' }));
  }
  if (session.status === 'no_boats') {
    redirect(ownerLoginUrl({ reason: 'not_owner' }));
  }

  return (
    <OwnerBoatProvider boats={session.boats}>
      <OwnerChrome user={session.user}>{children}</OwnerChrome>
    </OwnerBoatProvider>
  );
}
