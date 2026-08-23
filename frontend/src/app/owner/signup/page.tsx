'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api, clearCsrfToken } from '@/lib/api';
import { ThemeToggle } from '@/components/admin/ThemeToggle';
import { OWNER_LOGIN_PATH } from '@/lib/owner/login-url';
import { apiErrorMessage, toE164 } from '@/lib/owner/format';
import { DARK_CARD_SURFACE, PRIMARY_BTN } from '@/lib/customer/boat-card';

// ---- design tokens ---------------------------------------------------------
// Resolve through the owner.css CSS vars, so they theme-switch on [data-theme]
// without a `dark:` variant — same idiom as the login page and AuthModal.
const CARD = `flex max-h-[92vh] w-[min(420px,100%)] flex-col overflow-y-auto rounded-2xl border border-hair bg-raise-1 p-6 shadow-e3 ${DARK_CARD_SURFACE}`;
const LABEL = 'mb-1 block text-[13px] font-bold text-ink';
const INPUT =
  'w-full rounded border border-hair bg-bg py-2.5 px-3.5 text-[15px] text-ink transition-[border-color,box-shadow] duration-150 placeholder:text-muted focus:border-blue focus:bg-raise-1 focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--blue)_18%,transparent)] focus:outline-none';

/**
 * Owner sign-up: create an account, then create the first boat.
 *
 * Both steps happen here because POST /houseboats is what actually makes
 * someone an owner — it auto-creates the Owner role and the membership. An
 * account with no boat cannot enter the console at all, so stopping after
 * registration would leave the person stranded on the not_owner bounce.
 */
export default function OwnerSignupPage() {
  const [step, setStep] = useState<'account' | 'boat'>('account');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);

  // Step 2
  const [boatName, setBoatName] = useState('');
  const [description, setDescription] = useState('');

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    // The CSRF token is bound to hb_sid, which rotates on register and again on
    // login — drop it before and after each hop or the next call 403s.
    clearCsrfToken();

    try {
      await api.post('/auth/register', {
        phone: toE164(phone),
        password,
        name: name || undefined,
        email: email || undefined,
      });
      clearCsrfToken();

      // Register does not sign you in, and creating a boat requires a session.
      await api.post('/auth/login', { phone: toE164(phone), password });
      clearCsrfToken();

      setStep('boat');
      setBusy(false);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      clearCsrfToken();
      setError(
        status === 409
          ? 'An account with that phone already exists. Sign in instead.'
          : status === 429
            ? 'Too many attempts. Wait a minute and try again.'
            : apiErrorMessage(err, 'Could not create your account. Please try again.'),
      );
      setBusy(false);
    }
  }

  async function createBoat(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const { data } = await api.post<{ id: string }>('/houseboats', {
        name: boatName,
        description: description || undefined,
      });

      try {
        localStorage.setItem('hb_owner_boat', data.id);
      } catch {
        // Storage unavailable — the console falls back to the first boat.
      }

      // Hard navigation: the console layout is a Server Component that reads
      // the session cookie, so the router cache must not answer this one.
      window.location.assign('/owner/profile');
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Could not create the boat. Please try again.'));
      setBusy(false);
    }
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden px-5">
      {/* Ambient aurora — decorative. */}
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

      <form
        className={`relative ${CARD}`}
        method="post"
        onSubmit={step === 'account' ? createAccount : createBoat}
      >
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
        <span className="mt-4 w-fit rounded-full bg-[color-mix(in_srgb,var(--blue)_12%,transparent)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-blue">
          List your houseboat
        </span>

        {error && (
          <div
            role="alert"
            className="mb-4 mt-4 flex items-start gap-2 rounded border border-[color-mix(in_srgb,var(--danger)_35%,var(--hair))] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] px-3 py-2.5 text-[13px] font-semibold text-danger"
          >
            <span aria-hidden="true">⚠</span>
            <span>{error}</span>
          </div>
        )}

        {step === 'account' ? (
          <>
            <h1 className="mb-4 mt-2.5 font-display text-[20px] font-semibold tracking-[-.02em] text-ink">
              Create your account
            </h1>

            <div className="mb-3">
              <label className={LABEL} htmlFor="name">
                Your name
              </label>
              <input
                id="name"
                name="name"
                autoComplete="name"
                placeholder="Kamal Uddin"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={INPUT}
              />
            </div>

            <div className="mb-3">
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

            <div className="mb-3">
              <label className={LABEL} htmlFor="email">
                Email (optional)
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={INPUT}
              />
            </div>

            <div className="mb-3">
              <label className={LABEL} htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={8}
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

            <button className={PRIMARY_BTN} type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Continue →'}
            </button>

            <div className="mt-4 border-t border-hair pt-3.5 text-center text-[12.5px] leading-[1.6] text-muted">
              Already have an account?{' '}
              <Link href={OWNER_LOGIN_PATH} className="font-bold text-blue hover:underline">
                Sign in
              </Link>
              <br />
              At least 8 characters · your password is hashed, never stored as typed
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-2.5 font-display text-[20px] font-semibold tracking-[-.02em] text-ink">
              Add your boat
            </h1>
            <p className="mb-4 mt-1 text-[13.5px] leading-[1.5] text-muted">
              This creates the boat and makes you its Owner, with full permissions. You
              can complete the profile — decks, cabins, pricing, bank account — next.
            </p>

            <div className="mb-3">
              <label className={LABEL} htmlFor="boatName">
                Boat name
              </label>
              <input
                id="boatName"
                name="boatName"
                placeholder="Jol Kolol"
                required
                value={boatName}
                onChange={(e) => setBoatName(e.target.value)}
                className={INPUT}
              />
            </div>

            <div className="mb-3">
              <label className={LABEL} htmlFor="description">
                Short description (optional)
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                placeholder="A comfortable houseboat cruising Tanguar Haor."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`${INPUT} resize-y`}
              />
            </div>

            <div className="mb-3 flex items-start gap-2 rounded border border-[color-mix(in_srgb,var(--blue)_25%,var(--hair))] bg-[color-mix(in_srgb,var(--blue)_7%,transparent)] px-3 py-2.5 text-[12.5px] leading-[1.45] text-bodytext">
              <span aria-hidden="true" className="text-blue">
                ℹ
              </span>
              <span>
                Your boat starts as a draft. The platform reviews it once the profile
                is complete and a bank account is on file — only then can it go live
                and take bookings.
              </span>
            </div>

            <button className={PRIMARY_BTN} type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create boat →'}
            </button>

            <div className="mt-4 border-t border-hair pt-3.5 text-center text-[12.5px] leading-[1.6] text-muted">
              Routes are curated by the platform — you pick from them later.
            </div>
          </>
        )}
      </form>
    </div>
  );
}
