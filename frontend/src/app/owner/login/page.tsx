'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, clearCsrfToken } from '@/lib/api';
import { ThemeToggle } from '@/components/admin/ThemeToggle';
import {
  OWNER_DASHBOARD_PATH,
  OWNER_LOGIN_PATH,
  OWNER_SIGNUP_PATH,
  safeOwnerNext,
} from '@/lib/owner/login-url';
import type { OwnerBoat } from '@/lib/owner/session';
import { toE164 } from '@/lib/owner/format';

/**
 * Messages for the ?error= codes emitted by ownerLoginUrl(). Unknown codes fall
 * through to no banner rather than showing the user a raw code.
 */
const REASONS: Record<string, string> = {
  not_owner:
    'That account does not operate any boat yet. Add your boat to open the owner console.',
  backend_down:
    'Cannot reach the server right now. This is not a password problem — please try again shortly.',
  session_expired: 'Your session expired. Please sign in again.',
};

// Standalone sign-in — no console chrome.
//
// useSearchParams() opts a route into client-side rendering, so the form lives
// in a child wrapped in Suspense, or the whole page fails to prerender.
export default function OwnerLoginPage() {
  return (
    <Suspense fallback={<div className="auth-wrap" />}>
      <OwnerLoginForm />
    </Suspense>
  );
}

function OwnerLoginForm() {
  const params = useSearchParams();

  const [show, setShow] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  // Step 2: which boat to open. Only shown when the account operates several.
  const [boats, setBoats] = useState<OwnerBoat[] | null>(null);

  const reason = params.get('error');
  const [error, setError] = useState<string | null>(
    reason ? (REASONS[reason] ?? null) : null,
  );

  /** Store the chosen boat and hard-navigate into the console. */
  function enterConsole(boatId: string) {
    try {
      localStorage.setItem('hb_owner_boat', boatId);
    } catch {
      // Storage unavailable — the console falls back to the first live boat.
    }
    // Full page load rather than router.replace(): the console layout is a
    // Server Component that reads the auth cookie, and a client-side navigation
    // can render from the router cache before the new cookie is in play.
    window.location.assign(safeOwnerNext(params.get('next')) ?? OWNER_DASHBOARD_PATH);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    // Mint against the CURRENT hb_sid. The CSRF token is bound to it
    // server-side, so a token cached from a previous session 403s here — and
    // that 403 is indistinguishable from a bad password in the UI.
    clearCsrfToken();

    try {
      await api.post('/auth/login', { phone: toE164(phone), password });
      // hb_sid rotates on successful login, so the token just used is stale.
      clearCsrfToken();

      // Identity says nothing about boat access — that comes from /me/boats.
      const { data } = await api.get<OwnerBoat[]>('/me/boats');

      if (data.length === 0) {
        // A customer or crew member who found this form. Signing them out
        // prevents a live-but-useless session sitting behind the bounce.
        await api.post('/auth/logout').catch(() => {});
        clearCsrfToken();
        setError(REASONS.not_owner);
        setBusy(false);
        return;
      }

      if (data.length === 1) {
        enterConsole(data[0].houseboatId);
        return;
      }

      setBoats(data);
      setBusy(false);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
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
    <div className="auth-wrap">
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 2 }}>
        <ThemeToggle />
      </div>

      {boats ? (
        <div className="auth-card">
          <div className="logo">
            <span className="mark">⚓</span> Haor<span style={{ color: 'var(--blue)' }}>Boat</span>
          </div>
          <span className="badge">Owner console</span>
          <h1>Choose a boat</h1>
          <p className="lede">
            You operate {boats.length} boats. Pick one to open — you can switch at any
            time from the sidebar.
          </p>

          <div className="auth-form">
            {boats.map((b) => (
              <button
                key={b.houseboatId}
                type="button"
                className="boat-pick"
                onClick={() => enterConsole(b.houseboatId)}
              >
                <span className="bav">⛵</span>
                <span>
                  <span className="bn">{b.name}</span>
                  <span className="bm">{b.status}</span>
                </span>
                <span className={`pill ${b.status === 'live' ? 'ok' : 'mut'} role`}>
                  {b.role}
                </span>
              </button>
            ))}
          </div>

          <div className="foot">
            Permissions are checked per boat, on every request · CSRF-protected
          </div>
        </div>
      ) : (
        /*
          method="post" is a safety net, not the submit path. If hydration fails
          (broken chunk, dueling dev servers), a method-less form degrades to a
          native GET submit — which would put the password into the URL, history
          and the dev log. With method="post" the fallback sends a body instead.
        */
        <form className="auth-card" method="post" onSubmit={onSubmit}>
          <div className="logo">
            <span className="mark">⚓</span> Haor<span style={{ color: 'var(--blue)' }}>Boat</span>
          </div>
          <span className="badge">Owner console</span>
          <h1>Sign in</h1>
          <p className="lede">
            For boat owners, shareholders and managers. Platform staff sign in from the
            admin console.
          </p>

          {error && (
            <div className="note danger" style={{ marginBottom: 16 }} role="alert">
              <span className="ic">⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/*
            A signed-in account with no boats would otherwise dead-end: the
            console bounces them here, but their session is still live, so
            signing in again just repeats the bounce.
          */}
          {reason === 'not_owner' && (
            <button
              type="button"
              className="btn btn-o btn-sm"
              style={{ marginBottom: 16 }}
              onClick={async () => {
                try {
                  await api.post('/auth/logout');
                } catch {
                  // Already signed out, or the API is unreachable — either way,
                  // clear local state and start fresh.
                }
                clearCsrfToken();
                window.location.assign(OWNER_LOGIN_PATH);
              }}
            >
              Sign out of the current account
            </button>
          )}

          <div className="auth-form">
            <div className="field">
              <label htmlFor="phone">Phone</label>
              <div className="with-pre">
                <span className="pre">+880</span>
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

            <div className="field">
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
                <button type="button" className="show" onClick={() => setShow((v) => !v)}>
                  {show ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div className="rowb">
              <label style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <input type="checkbox" defaultChecked /> Keep me signed in
              </label>
              <Link style={{ color: 'var(--blue)', fontWeight: 600 }} href="#">
                Forgot password?
              </Link>
            </div>

            <button className="btn btn-b" type="submit" disabled={busy} style={{ justifyContent: 'center' }}>
              {busy ? 'Signing in…' : 'Sign in →'}
            </button>
          </div>

          <div className="foot">
            New here? <Link href={OWNER_SIGNUP_PATH}>List your houseboat</Link>
            <br />
            Permissions are checked per boat, on every request · CSRF-protected
          </div>
        </form>
      )}
    </div>
  );
}
