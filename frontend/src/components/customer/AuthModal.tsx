'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { api, clearCsrfToken, refreshCsrfToken } from '@/lib/api';
import { toE164, apiErrorMessage } from '@/lib/owner/format';
import { authReasonCopy, type AuthMode } from '@/lib/customer/login-url';
import { DARK_CARD_SURFACE, PRIMARY_BTN } from '@/lib/customer/boat-card';

// ---- design tokens ---------------------------------------------------------
// Colours/radii/shadows resolve through the CSS vars in customer.css, so these
// switch with [data-theme] without a `dark:` variant each. Input/label/hint are
// the same strings CheckoutFlow uses, so the two auth surfaces cannot drift.
const LABEL = 'mb-1.5 block text-[13px] font-bold text-ink';
/** Required-field marker. Colour-independent (the asterisk itself carries it). */
const REQ = 'font-normal text-danger';
const INPUT =
  'w-full rounded border border-hair bg-bg py-3 pl-11 pr-3.5 text-[15px] text-ink transition-[border-color,box-shadow] duration-150 placeholder:text-muted focus:border-blue focus:bg-raise-1 focus:shadow-[0_0_0_3px_var(--blue-050)] focus:outline-none';
const ICON =
  'pointer-events-none absolute left-[14px] top-1/2 -translate-y-1/2 text-base text-muted';
const TAB_BASE =
  'flex-1 rounded-full px-4 py-[9px] text-[14.5px] font-bold transition-[background,color,box-shadow] duration-150';
const TAB_ON = 'bg-blue text-white shadow-[0_4px_12px_-4px_var(--blue)]';
const TAB_OFF = 'bg-transparent text-bodytext hover:text-ink';

const TABS: { id: AuthMode; label: string }[] = [
  { id: 'login', label: 'Log in' },
  { id: 'register', label: 'Register' },
];

/**
 * Customer sign-in / sign-up, as a modal over whatever page the visitor is on.
 *
 * Replaces the old /account/login and /account/register pages. Staying in place
 * is the point: a guest who hits the login wall mid-checkout keeps their form
 * state AND their cabin holds, which the old hard navigation destroyed.
 *
 * Both modes hit the shared /auth endpoints. The CSRF dance is load-bearing and
 * must keep its order — clearCsrfToken → post → clearCsrfToken — because the
 * token is bound to the hb_sid cookie and login mints a fresh one. On success
 * the caller runs router.refresh() so the RSC tree re-reads the new cookie.
 */
export function AuthModal({
  mode,
  reason,
  onModeChange,
  onClose,
  onSuccess,
}: {
  mode: AuthMode;
  reason?: string | null;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Registration succeeded; showing the confirmation before handing off. */
  const [done, setDone] = useState(false);
  const doneTimer = useRef<number | null>(null);
  /** Mirror of `done` for the keydown listener, which closes over its own scope. */
  const doneRef = useRef(false);
  doneRef.current = done;

  useEffect(
    () => () => {
      if (doneTimer.current !== null) window.clearTimeout(doneTimer.current);
    },
    [],
  );

  const isRegister = mode === 'register';
  // The reason the modal was opened only applies until the user's own attempt
  // produces a message of its own.
  const message = error ?? authReasonCopy(reason);

  useEffect(() => {
    restoreTo.current = document.activeElement as HTMLElement | null;
    firstFieldRef.current?.focus();
    return () => restoreTo.current?.focus?.();
  }, []);

  /**
   * Body scroll lock. Save/restore the previous value rather than clearing it,
   * so closing this modal can't unlock a scroll another overlay is holding.
   */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Mid-confirmation the session already exists; dismissing here would
      // cancel the hand-off and strand a signed-in user on a stale page.
      if (e.key === 'Escape') {
        if (!doneRef.current) onClose();
        return;
      }
      if (e.key === 'Tab' && boxRef.current) {
        // :not([disabled]) matters here — the submit button is disabled while a
        // request is in flight, and a disabled element cannot take focus, so
        // counting it would trap Tab on a dead node.
        const items = Array.from(
          boxRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  /** Left/Right arrows move between tabs, per the WAI-ARIA tabs pattern. */
  const onTabKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    switchMode(isRegister ? 'login' : 'register');
  };

  /** Keep what they typed; only the mode-specific error is stale. */
  const switchMode = (next: AuthMode) => {
    if (next === mode) return;
    setError(null);
    onModeChange(next);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Checked in field order so the message points at the first empty box.
    // These mirror RegisterDto — the server is still the authority, this just
    // saves a round trip.
    if (isRegister && name.trim().length < 2) {
      setError(
        name.trim() ? 'Please enter your full name.' : 'Your name is required.',
      );
      return;
    }
    if (!phone.trim()) {
      setError('Your phone number is required.');
      return;
    }
    if (!password) {
      setError('A password is required.');
      return;
    }
    if (isRegister && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      // Drop any token bound to the pre-login session before we start.
      clearCsrfToken();
      if (isRegister) {
        await api.post('/auth/register', {
          phone: toE164(phone),
          password,
          name: name.trim(),
        });
      } else {
        await api.post('/auth/login', {
          phone: toE164(phone),
          password,
          rememberMe: remember,
        });
      }
      // AWAIT a token bound to the hb_sid this response just minted. Clearing
      // the cache alone would leave the interceptor to refill it lazily, and
      // the next mutating request (checkout's Pay, a cabin hold) could go out
      // with a token from the dead session and 403.
      await refreshCsrfToken();

      if (isRegister) {
        // Acknowledge the account before handing off — router.refresh() is
        // silent, so without this a successful sign-up just closes the modal
        // and reads as "nothing happened". Tracked so unmounting (Escape,
        // backdrop) cancels the pending hand-off instead of firing into a
        // dead component.
        setDone(true);
        doneTimer.current = window.setTimeout(onSuccess, 1100);
        return;
      }
      onSuccess();
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          isRegister
            ? 'Could not create your account.'
            : 'Invalid phone or password.',
        ),
      );
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-5">
      <button
        type="button"
        aria-label="Close sign in"
        onClick={() => {
          if (!done) onClose();
        }}
        className="absolute inset-0 cursor-default bg-[rgba(10,20,40,.6)] backdrop-blur-[2px]"
      />
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative flex max-h-[90vh] w-[min(420px,100%)] flex-col overflow-y-auto rounded-2xl border border-hair bg-raise-1 p-6 shadow-e3 outline-none ${DARK_CARD_SURFACE}`}
      >
        {done ? null : (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full border-none bg-chip text-sm text-bodytext transition-colors hover:bg-hover hover:text-ink"
          >
            ✕
          </button>
        )}

        <div className="mb-5 mr-9 flex items-center gap-[11px]">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[linear-gradient(145deg,var(--blue),var(--blue-700))] text-base text-white shadow-[0_6px_14px_-6px_var(--blue),var(--top-hi)] dark:shadow-[0_6px_18px_-4px_rgba(90,160,255,.55),var(--top-hi)]"
          >
            🛥
          </span>
          <span className="font-display text-[19px] font-bold tracking-[-.03em] text-ink">
            Haor<span className="text-blue">Boat</span>
          </span>
        </div>

        {done ? (
          <div className="py-6 text-center" role="status" aria-live="polite">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[color-mix(in_srgb,var(--ok)_14%,var(--raise-1))] text-2xl text-ok">
              ✓
            </div>
            <h2
              id={titleId}
              className="font-display text-[21px] font-semibold tracking-[-.02em] text-ink"
            >
              Account created
            </h2>
            <p className="mx-auto mt-2 max-w-[30ch] text-[13.5px] leading-[1.55] text-muted">
              You’re signed in{name.trim() ? ` as ${name.trim().split(' ')[0]}` : ''}.
              Taking you back…
            </p>
          </div>
        ) : (
          <>
        <div
          role="tablist"
          aria-label="Sign in or register"
          onKeyDown={onTabKey}
          className="mb-5 flex rounded-full border border-hair bg-bg p-1"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              id={`auth-tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={mode === t.id}
              aria-controls="auth-tabpanel"
              tabIndex={mode === t.id ? 0 : -1}
              onClick={() => switchMode(t.id)}
              className={`${TAB_BASE} ${mode === t.id ? TAB_ON : TAB_OFF}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div id="auth-tabpanel" role="tabpanel" aria-labelledby={`auth-tab-${mode}`}>
          <h2
            id={titleId}
            className="font-display text-[21px] font-semibold tracking-[-.02em] text-ink"
          >
            {isRegister ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="mb-5 mt-1 text-[13.5px] text-muted">
            {isRegister
              ? 'Just a name, phone and password to get started.'
              : 'Enter your phone and password to continue.'}
          </p>

          <form onSubmit={submit}>
            {isRegister ? (
              <div className="mb-4">
                <label className={LABEL} htmlFor="auth-name">
                  Full name <span className={REQ}>*</span>
                </label>
                <div className="relative">
                  <span className={ICON} aria-hidden="true">
                    👤
                  </span>
                  <input
                    id="auth-name"
                    ref={isRegister ? firstFieldRef : undefined}
                    type="text"
                    className={INPUT}
                    placeholder="Rahim Uddin"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={120}
                  />
                </div>
              </div>
            ) : null}

            <div className="mb-4">
              <label className={LABEL} htmlFor="auth-phone">
                Phone number <span className={REQ}>*</span>
              </label>
              <div className="relative">
                <span className={ICON} aria-hidden="true">
                  📱
                </span>
                <input
                  id="auth-phone"
                  ref={isRegister ? undefined : firstFieldRef}
                  type="tel"
                  className={INPUT}
                  placeholder="01712 345 678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  required
                />
              </div>
            </div>

            <div className="mb-4">
              <label className={LABEL} htmlFor="auth-password">
                Password <span className={REQ}>*</span>
              </label>
              <div className="relative">
                <span className={ICON} aria-hidden="true">
                  🔒
                </span>
                <input
                  id="auth-password"
                  type={showPw ? 'text' : 'password'}
                  className={`${INPUT} pr-11`}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  aria-pressed={showPw}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-base text-muted transition-colors hover:text-ink"
                >
                  👁
                </button>
              </div>
            </div>

            {!isRegister ? (
              <label className="mb-4 flex cursor-pointer items-center gap-2 text-[13.5px] font-semibold text-bodytext">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-[17px] w-[17px] accent-blue"
                />
                Remember me
              </label>
            ) : null}

            <div aria-live="polite">
              {message ? (
                <p className="mb-3 text-[13px] font-bold text-danger">{message}</p>
              ) : null}
            </div>

            <button className={PRIMARY_BTN} disabled={busy} type="submit">
              {busy
                ? 'Please wait…'
                : isRegister
                  ? 'Create account →'
                  : 'Log in →'}
            </button>
          </form>

          <p className="mt-4 text-center text-[13.5px] text-muted">
            {isRegister ? 'Already have an account? ' : 'New to HaorBoat? '}
            <button
              type="button"
              onClick={() => switchMode(isRegister ? 'login' : 'register')}
              className="font-bold text-blue hover:underline"
            >
              {isRegister ? 'Log in' : 'Create an account'}
            </button>
          </p>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
