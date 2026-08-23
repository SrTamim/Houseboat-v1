'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, clearCsrfToken } from '@/lib/api';
import { ThemeToggle } from '@/components/admin/ThemeToggle';
import { BTN_B, FIELD, FIELD_INPUT, FIELD_LABEL } from '@/components/admin/styles';
import { Note } from '@/components/admin/ui';
import { LOGIN_PATH, DASHBOARD_PATH } from '@/lib/admin/login-url';

// Standalone login shell (was `.login-wrap` + its two blurred `::before`/`::after`
// background blobs). Kept as a const so the Suspense fallback matches the form.
const LOGIN_WRAP =
  "relative grid min-h-screen place-items-center overflow-hidden bg-bg p-6 before:fixed before:-left-[120px] before:-top-[160px] before:z-0 before:h-[520px] before:w-[520px] before:rounded-full before:bg-[color-mix(in_srgb,var(--blue)_22%,transparent)] before:blur-[90px] before:content-[''] after:fixed after:-bottom-[180px] after:-right-[120px] after:z-0 after:h-[460px] after:w-[460px] after:rounded-full after:bg-[color-mix(in_srgb,var(--blue)_14%,transparent)] after:blur-[90px] after:content-['']";

const DASHBOARD = DASHBOARD_PATH;

/**
 * Only allow same-origin relative paths from ?next=. Accepting an arbitrary
 * value here is the classic post-login open redirect ("//evil.com" is a
 * protocol-relative URL, not a local path).
 */
function safeNext(raw: string | null): string {
  if (!raw) return DASHBOARD;
  if (!raw.startsWith('/') || raw.startsWith('//')) return DASHBOARD;
  return raw.startsWith('/admin') ? raw : DASHBOARD;
}

/** Backend expects a full BD number; the field takes the local part. */
function toE164(local: string): string {
  return `+880${local.replace(/\D/g, '').replace(/^0/, '')}`;
}

/**
 * Messages for the ?error= reason codes emitted by loginUrl(). Unknown codes
 * fall through to no banner rather than rendering a raw code at the user.
 */
const REASONS: Record<string, string> = {
  not_staff: 'That account does not have platform staff access.',
  backend_down:
    'Cannot reach the server right now. This is not a password problem — please try again shortly.',
  session_expired: 'Your session expired. Please sign in again.',
};

// Standalone sign-in — no console chrome. Styled with Tailwind utilities that
// resolve through the design tokens in globals.css.
//
// useSearchParams() opts a route into client-side rendering, so the form lives
// in a child wrapped in Suspense — otherwise the whole page fails to prerender.
export default function AdminLogin() {
  return (
    <Suspense fallback={<div className={LOGIN_WRAP} />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();

  const [show, setShow] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  // Why the console (or middleware, or the 401 handler) sent them here.
  const reason = params.get('error');
  const [error, setError] = useState<string | null>(
    reason ? (REASONS[reason] ?? null) : null,
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    // Mint against the CURRENT hb_sid.
    //
    // The CSRF token's hash is bound to hb_sid server-side. A token cached from
    // a previous session 403s here, and that 403 is indistinguishable from a
    // bad password in the UI — so drop it before every attempt, not just after
    // a successful one.
    clearCsrfToken();

    try {
      await api.post('/auth/login', { phone: toE164(phone), password, rememberMe: remember });

      // hb_sid rotates again on a successful login, so the token we just used
      // is already stale for the next request.
      clearCsrfToken();

      // Full page load rather than router.replace().
      //
      // The console layout is a Server Component that reads the auth cookie to
      // verify isPlatform. A client-side navigation can render from the router
      // cache before the new cookie is in play, which bounced the user straight
      // back here despite a successful 201. A hard navigation guarantees the
      // server re-runs that check with the session that was just created.
      window.location.assign(safeNext(params.get('next')));
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      // Never leave a poisoned token behind for the retry.
      clearCsrfToken();
      // Deliberately identical for unknown phone vs wrong password — the
      // backend doesn't distinguish them either, and doing so here would
      // reintroduce account enumeration.
      setError(
        status === 401
          ? 'Wrong phone or password.'
          : status === 429
            ? 'Too many attempts. Wait a minute and try again.'
            : status === 403
              ? 'Session check failed. Please try again.'
              : 'Could not sign in. Please try again.',
      );
      setBusy(false);
    }
  }

  return (
    <div className={LOGIN_WRAP}>
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 2 }}>
        <ThemeToggle />
      </div>
      {/*
        method="post" is a safety net, not the submit path. If hydration ever
        fails (broken JS chunk, dueling dev servers), a method-less form
        degrades to a native GET submit — which put ?phone=...&password=...
        into the URL, browser history, and the dev log. With method="post" the
        native fallback sends a body instead; Next answers 405 and nothing
        secret touches a URL.
      */}
      <form
        className="relative z-[1] w-full max-w-[412px] rounded-2xl border border-hair bg-raise-1 px-8 py-9 shadow-[var(--e3),var(--top-hi)]"
        method="post"
        onSubmit={onSubmit}
      >
        <div className="flex items-center justify-center gap-[11px] font-display text-[23px] font-bold tracking-[-0.03em] text-ink">
          <span className="grid h-[38px] w-[38px] place-items-center rounded-xl bg-[linear-gradient(145deg,var(--blue),var(--blue-700))] text-[18px] text-white shadow-[0_8px_18px_-6px_var(--blue),var(--top-hi)]">
            ⚓
          </span>{' '}
          Haor<span className="text-blue">Boat</span>
        </div>
        <span className="mx-auto mt-4 block w-[186px] rounded-full bg-[color-mix(in_srgb,var(--blue)_11%,transparent)] py-1.5 text-center text-[11px] font-bold uppercase tracking-[0.09em] text-blue">
          Platform console
        </span>
        <div className="my-6 text-center">
          <h1 className="text-[23px]">Sign in</h1>
          <p className="mt-2 text-[13.5px] leading-[1.55] text-muted">
            Staff access only. Owners &amp; crew sign in from the boat dashboard.
          </p>
        </div>

        {error && (
          <div className="mb-4" role="alert">
            <Note kind="danger" icon="⚠">{error}</Note>
          </div>
        )}

        {/*
          A signed-in non-staff account would otherwise dead-end: the console
          bounces them here, but their session is still live, so signing in
          again just repeats the bounce. Give them a way to clear it.
        */}
        {reason === 'not_staff' && (
          <button
            type="button"
            className="mb-4 cursor-pointer border-none bg-none p-0 font-semibold text-blue"
            onClick={async () => {
              try {
                await api.post('/auth/logout');
              } catch {
                // Already signed out server-side, or the API is unreachable —
                // either way, clear local state and start fresh.
              }
              clearCsrfToken();
              window.location.assign(LOGIN_PATH);
            }}
          >
            Sign out of the current account
          </button>
        )}

        <div className={`mb-3.5 ${FIELD}`}>
          <label htmlFor="phone" className={FIELD_LABEL}>Phone</label>
          <div className="flex items-center gap-2.5">
            <span className="font-display text-[15px] font-semibold text-muted">+880</span>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="username"
              placeholder="1700000000"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`${FIELD_INPUT} placeholder:font-normal placeholder:text-muted`}
            />
          </div>
        </div>
        <div className={`mb-3.5 ${FIELD}`}>
          <label htmlFor="password" className={FIELD_LABEL}>Password</label>
          <div className="flex items-center gap-2.5">
            <input
              id="password"
              name="password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={FIELD_INPUT}
            />
            <button
              type="button"
              className="border-none bg-none text-[12px] font-bold text-blue"
              onClick={() => setShow((v) => !v)}
            >
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div className="my-0.5 mb-[18px] flex items-center justify-between text-[13px]">
          <label className="flex items-center gap-2 font-medium text-bodytext">
            <input
              type="checkbox"
              className="accent-blue"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />{' '}
            Keep me signed in
          </label>
          <Link className="font-semibold text-blue" href="#">
            Forgot password?
          </Link>
        </div>

        <button className={`${BTN_B} w-full justify-center p-[13px] text-[15px]`} type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in →'}
        </button>
        <div className="mt-5 text-center text-[11.5px] leading-[1.5] text-muted">
          Sessions expire after 15 min idle · refreshed for 30 days · CSRF-protected
        </div>
      </form>
    </div>
  );
}
