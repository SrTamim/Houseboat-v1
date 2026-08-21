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
import { DARK_CARD_SURFACE, NAV_BTN_O, PRIMARY_BTN } from '@/lib/customer/boat-card';

// ---- design tokens ---------------------------------------------------------
// Colours/radii/shadows resolve through the CSS vars owner.css defines in both
// :root and :root[data-theme='dark'], so these switch theme without a `dark:`
// variant each — the same idiom the customer AuthModal uses.
const CARD = `flex w-[min(420px,100%)] flex-col rounded-2xl border border-hair bg-raise-1 p-7 shadow-e3 ${DARK_CARD_SURFACE}`;
const LABEL = 'mb-1.5 block text-[13px] font-bold text-ink';
const INPUT =
  'w-full rounded border border-hair bg-bg py-3 px-3.5 text-[15px] text-ink transition-[border-color,box-shadow] duration-150 placeholder:text-muted focus:border-blue focus:bg-raise-1 focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--blue)_18%,transparent)] focus:outline-none';

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
    <Suspense fallback={<div className="grid min-h-screen place-items-center px-5" />}>
      <OwnerLoginForm />
    </Suspense>
  );
}

function OwnerLoginForm() {
  const params = useSearchParams();

  const [show, setShow] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
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
      await api.post('/auth/login', { phone: toE164(phone), password, rememberMe: remember });
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
    <div className="relative grid min-h-screen place-items-center overflow-hidden px-5">
      {/* Ambient aurora — decorative, replaces the old .auth-wrap::before/::after. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--blue)_16%,transparent),transparent_70%)] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-48 -right-40 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--blue)_10%,transparent),transparent_70%)] blur-3xl"
      />

      <div className="fixed right-5 top-5 z-10">
        <ThemeToggle />
      </div>

      {boats ? (
        <div className={`relative ${CARD}`}>
          <Logo />
          <Badge>Owner console</Badge>
          <h1 className="mt-3 font-display text-[21px] font-semibold tracking-[-.02em] text-ink">
            Choose a boat
          </h1>
          <p className="mb-5 mt-1 text-[13.5px] leading-[1.55] text-muted">
            You operate {boats.length} boats. Pick one to open — you can switch at any
            time from the sidebar.
          </p>

          <div className="flex flex-col gap-2.5">
            {boats.map((b) => (
              <button
                key={b.houseboatId}
                type="button"
                onClick={() => enterConsole(b.houseboatId)}
                className="flex items-center gap-3 rounded-xl border border-hair bg-bg px-3.5 py-3 text-left transition-[border-color,background] duration-dur ease-ease hover:border-[color-mix(in_srgb,var(--blue)_45%,var(--hair))] hover:bg-[color-mix(in_srgb,var(--blue)_6%,var(--raise-1))]"
              >
                <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-chip text-lg">
                  ⛵
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold text-ink">
                    {b.name}
                  </span>
                  <span className="block text-[12.5px] capitalize text-muted">{b.status}</span>
                </span>
                <span
                  className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                    b.status === 'live'
                      ? 'bg-[color-mix(in_srgb,var(--ok)_14%,transparent)] text-ok'
                      : 'bg-chip text-muted'
                  }`}
                >
                  {b.role}
                </span>
              </button>
            ))}
          </div>

          <Foot>Permissions are checked per boat, on every request · CSRF-protected</Foot>
        </div>
      ) : (
        /*
          method="post" is a safety net, not the submit path. If hydration fails
          (broken chunk, dueling dev servers), a method-less form degrades to a
          native GET submit — which would put the password into the URL, history
          and the dev log. With method="post" the fallback sends a body instead.
        */
        <form className={`relative ${CARD}`} method="post" onSubmit={onSubmit}>
          <Logo />
          <Badge>Owner console</Badge>
          <h1 className="mt-3 font-display text-[21px] font-semibold tracking-[-.02em] text-ink">
            Sign in
          </h1>
          <p className="mb-5 mt-1 text-[13.5px] leading-[1.55] text-muted">
            For boat owners, shareholders and managers. Platform staff sign in from the
            admin console.
          </p>

          {error && <DangerNote>{error}</DangerNote>}

          {/*
            A signed-in account with no boats would otherwise dead-end: the
            console bounces them here, but their session is still live, so
            signing in again just repeats the bounce.
          */}
          {reason === 'not_owner' && (
            <button
              type="button"
              className={`mb-4 ${NAV_BTN_O} justify-center`}
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

          <div className="mb-4">
            <label className={LABEL} htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="username"
              placeholder="01700000000"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={INPUT}
            />
          </div>

          <div className="mb-4">
            <label className={LABEL} htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${INPUT} pr-16`}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-[13px] font-bold text-muted transition-colors hover:text-ink"
              >
                {show ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-[13.5px] font-semibold text-bodytext">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-[17px] w-[17px] accent-blue"
              />
              Keep me signed in
            </label>
            <Link href="#" className="text-[13.5px] font-bold text-blue hover:underline">
              Forgot password?
            </Link>
          </div>

          <button className={PRIMARY_BTN} type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in →'}
          </button>

          <Foot>
            New here?{' '}
            <Link href={OWNER_SIGNUP_PATH} className="font-bold text-blue hover:underline">
              List your houseboat
            </Link>
            <br />
            Permissions are checked per boat, on every request · CSRF-protected
          </Foot>
        </form>
      )}
    </div>
  );
}

// ---- small shared bits (login + signup share the same shell) ---------------

function Logo() {
  return (
    <div className="flex items-center gap-[11px]">
      <span
        aria-hidden="true"
        className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[linear-gradient(145deg,var(--blue),var(--blue-700))] text-base text-white shadow-[0_6px_14px_-6px_var(--blue),var(--top-hi)]"
      >
        ⚓
      </span>
      <span className="font-display text-[19px] font-bold tracking-[-.03em] text-ink">
        Haor<span className="text-blue">Boat</span>
      </span>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-4 w-fit rounded-full bg-[color-mix(in_srgb,var(--blue)_12%,transparent)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-blue">
      {children}
    </span>
  );
}

function DangerNote({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-2 rounded border border-[color-mix(in_srgb,var(--danger)_35%,var(--hair))] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] px-3 py-2.5 text-[13px] font-semibold text-danger"
    >
      <span aria-hidden="true">⚠</span>
      <span>{children}</span>
    </div>
  );
}

function Foot({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 border-t border-hair pt-4 text-center text-[12.5px] leading-[1.7] text-muted">
      {children}
    </div>
  );
}
