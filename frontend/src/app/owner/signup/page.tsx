'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api, clearCsrfToken } from '@/lib/api';
import { ThemeToggle } from '@/components/admin/ThemeToggle';
import { OWNER_LOGIN_PATH } from '@/lib/owner/login-url';
import { apiErrorMessage, toE164 } from '@/lib/owner/format';

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
    <div className="auth-wrap">
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 2 }}>
        <ThemeToggle />
      </div>

      <form
        className="auth-card"
        method="post"
        onSubmit={step === 'account' ? createAccount : createBoat}
      >
        <div className="logo">
          <span className="mark">⚓</span> Haor<span style={{ color: 'var(--blue)' }}>Boat</span>
        </div>
        <span className="badge">List your houseboat</span>

        {error && (
          <div className="note danger" style={{ marginBottom: 16 }} role="alert">
            <span className="ic">⚠</span>
            <span>{error}</span>
          </div>
        )}

        {step === 'account' ? (
          <>
            <h1>Create your account</h1>
            <p className="lede">
              One login per person. The same account works as a customer, an owner and
              crew — what you can do comes from the boats you are attached to.
            </p>

            <div className="auth-form">
              <div className="field">
                <label htmlFor="name">Your name</label>
                <input
                  id="name"
                  name="name"
                  autoComplete="name"
                  placeholder="Kamal Uddin"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

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
                <label htmlFor="email">Email (optional)</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="password">Password</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    id="password"
                    name="password"
                    type={show ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button type="button" className="show" onClick={() => setShow((v) => !v)}>
                    {show ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button
                className="btn btn-b"
                type="submit"
                disabled={busy}
                style={{ justifyContent: 'center' }}
              >
                {busy ? 'Creating…' : 'Continue →'}
              </button>
            </div>

            <div className="foot">
              Already have an account? <Link href={OWNER_LOGIN_PATH}>Sign in</Link>
              <br />
              At least 8 characters · your password is hashed, never stored as typed
            </div>
          </>
        ) : (
          <>
            <h1>Add your boat</h1>
            <p className="lede">
              This creates the boat and makes you its Owner, with full permissions. You
              can complete the profile — decks, cabins, pricing, bank account — next.
            </p>

            <div className="auth-form">
              <div className="field">
                <label htmlFor="boatName">Boat name</label>
                <input
                  id="boatName"
                  name="boatName"
                  placeholder="Jol Kolol"
                  required
                  value={boatName}
                  onChange={(e) => setBoatName(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="description">Short description (optional)</label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  placeholder="A comfortable houseboat cruising Tanguar Haor."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="note info">
                <span className="ic">ℹ</span>
                <span>
                  Your boat starts as a draft. The platform reviews it once the profile
                  is complete and a bank account is on file — only then can it go live
                  and take bookings.
                </span>
              </div>

              <button
                className="btn btn-b"
                type="submit"
                disabled={busy}
                style={{ justifyContent: 'center' }}
              >
                {busy ? 'Creating…' : 'Create boat →'}
              </button>
            </div>

            <div className="foot">Routes are curated by the platform — you pick from them later.</div>
          </>
        )}
      </form>
    </div>
  );
}
