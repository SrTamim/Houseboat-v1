'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, clearCsrfToken } from '@/lib/api';
import { ThemeToggle } from '@/components/admin/ThemeToggle';
import { LOGIN_PATH, DASHBOARD_PATH } from '@/lib/admin/login-url';

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

// Standalone sign-in — no console chrome. Uses admin.css tokens.
//
// useSearchParams() opts a route into client-side rendering, so the form lives
// in a child wrapped in Suspense — otherwise the whole page fails to prerender.
export default function AdminLogin() {
  return (
    <Suspense fallback={<div className="login-wrap" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();

  const [show, setShow] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
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
      await api.post('/auth/login', { phone: toE164(phone), password });

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
    <div className="login-wrap">
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
      <form className="login-card" method="post" onSubmit={onSubmit}>
        <div className="login-logo">
          <span className="mark">⚓</span> Haor<span className="b">Boat</span>
        </div>
        <span className="login-badge">Platform console</span>
        <div className="login-lead">
          <h1>Sign in</h1>
          <p>Staff access only. Owners &amp; crew sign in from the boat dashboard.</p>
        </div>

        {error && (
          <div className="note danger" style={{ marginBottom: 16 }} role="alert">
            <span className="ic">⚠</span>
            <span>{error}</span>
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
            className="login-link"
            style={{
              marginBottom: 16,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
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

        <div className="field" style={{ marginBottom: 14 }}>
          <label htmlFor="phone">Phone</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="login-pre">+880</span>
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
            />
          </div>
        </div>
        <div className="field" style={{ marginBottom: 14 }}>
          <label htmlFor="password">Password</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              id="password"
              name="password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="login-show"
              onClick={() => setShow((v) => !v)}
            >
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div className="login-row">
          <label className="login-chk">
            <input type="checkbox" defaultChecked /> Keep me signed in
          </label>
          <Link className="login-link" href="#">
            Forgot password?
          </Link>
        </div>

        <button className="btn btn-b login-submit" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in →'}
        </button>
        <div className="login-foot">
          Sessions expire after 15 min idle · refreshed for 30 days · CSRF-protected
        </div>
      </form>
    </div>
  );
}
