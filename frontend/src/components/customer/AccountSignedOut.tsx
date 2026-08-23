'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useAuthModal } from '@/components/customer/AuthModalProvider';
import {
  DARK_CARD_SURFACE,
  NAV_BTN_B,
  NAV_BTN_O,
} from '@/lib/customer/boat-card';

/**
 * What the account area shows instead of its pages when there's no session.
 *
 * The account routes used to redirect to /account/login. With sign-in now a
 * modal there is nowhere to redirect to, so the shell stays put and offers the
 * modal here. The account pages themselves are NOT rendered behind this — they
 * assume a session and would fire 401s — so this component fully replaces them.
 */
export function AccountSignedOut({
  reason,
}: {
  reason?: 'session_expired' | 'backend_down';
}) {
  const { openAuth } = useAuthModal();
  const down = reason === 'backend_down';
  const autoOpened = useRef(false);

  // Someone who navigated straight to /account/trips came here to do something,
  // so open the modal for them rather than making them find the button.
  //
  // Once only: if they dismiss it they get the panel below, with both buttons
  // still there. Re-opening on every render would make the modal impossible to
  // close. Skipped entirely when the API is down, since signing in would fail
  // too — and when a ?auth= param is already driving the modal.
  useEffect(() => {
    if (down || autoOpened.current) return;
    if (new URLSearchParams(window.location.search).has('auth')) return;
    autoOpened.current = true;
    openAuth('login', { reason: 'session_expired' });
  }, [down, openAuth]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-wrap items-center justify-center px-6 py-16">
      <div
        className={`w-[min(460px,100%)] rounded-2xl border border-hair bg-raise-1 p-8 text-center shadow-e1 ${DARK_CARD_SURFACE}`}
      >
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-chip text-2xl">
          {down ? '⚠️' : '🎟️'}
        </div>
        <h1 className="font-display text-[22px] font-semibold tracking-[-.02em] text-ink">
          {down ? 'We couldn’t reach the server' : 'Sign in to see your trips'}
        </h1>
        <p className="mx-auto mt-2 max-w-[36ch] text-[14px] leading-[1.55] text-muted">
          {down
            ? 'Your session couldn’t be checked just now. This is usually brief — please try again in a moment.'
            : 'Your bookings, vouchers, wallet credit and waitlist all live here. Sign in to pick up where you left off.'}
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          {down ? (
            <>
              <Link href="/account/trips" className={NAV_BTN_B}>
                Try again
              </Link>
              <Link href="/" className={NAV_BTN_O}>
                Back to home
              </Link>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => openAuth('login')}
                className={NAV_BTN_B}
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => openAuth('register')}
                className={NAV_BTN_O}
              >
                Create an account
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
