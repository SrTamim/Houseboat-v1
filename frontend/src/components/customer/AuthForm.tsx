'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { api, clearCsrfToken } from '@/lib/api';
import { toE164, apiErrorMessage } from '@/lib/owner/format';
import { ThemeToggle } from '@/components/admin/ThemeToggle';
import { safeCustomerNext } from '@/lib/customer/login-url';

const REASONS: Record<string, string> = {
  session_expired: 'Your session expired — please sign in again.',
  backend_down: 'We couldn’t reach the server. Try again shortly.',
  login_required: 'Please sign in to continue to checkout.',
};

/**
 * Split-screen login / register (design: haorboat-account-login.html). Both
 * modes hit the shared /auth endpoints. Follows the owner login pattern:
 * clearCsrfToken → post → clearCsrfToken → hard navigate (so the server layout
 * re-reads the fresh cookie). Register auto-signs-in, so it lands the same place.
 *
 * OTP + social login from the preview are intentionally omitted this round
 * (password auth, no OTP — see plan).
 */
export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const params = useSearchParams();
  const next = safeCustomerNext(params.get('next')) ?? '/account/trips';
  const reasonCode = params.get('error');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    reasonCode ? (REASONS[reasonCode] ?? null) : null,
  );

  const isRegister = mode === 'register';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!phone.trim() || !password) {
      setError('Phone and password are required.');
      return;
    }
    if (isRegister && !name.trim()) {
      setError('Please enter your name.');
      return;
    }
    setBusy(true);
    try {
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
      clearCsrfToken();
      // Hard navigation so the account server layout re-reads the new cookie.
      window.location.assign(next);
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
    <div className="split">
      <aside className="brandside">
        <div className="bg">
          <img
            alt="Houseboat at sunrise on a haor"
            src="https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1400&q=70"
          />
        </div>
        <Link className="logo" href="/">
          <span className="mark">🛥</span>Haor<span className="b">Boat</span>
        </Link>
        <div className="mid">
          <h2>Your haor trips, all in one place.</h2>
          <p>
            Sign in to see your bookings, pay your boarding balance, and manage
            cancellations or reschedules.
          </p>
          <div className="bpoints">
            <div className="bpoint">
              <span className="i">🎟️</span> Every voucher &amp; e-ticket, ready at
              the ghat
            </div>
            <div className="bpoint">
              <span className="i">💳</span> Pay the balance due by bKash, Nagad or
              card
            </div>
            <div className="bpoint">
              <span className="i">↩</span> Cancel, reschedule or claim a refund in a
              few taps
            </div>
          </div>
        </div>
      </aside>

      <main className="formside">
        <div className="formcard">
          <div className="topbar">
            <ThemeToggle />
          </div>
          <div className="tabs">
            <Link
              className={`tab${!isRegister ? ' on' : ''}`}
              href={`/account/login${params.toString() ? `?${params}` : ''}`}
            >
              Log in
            </Link>
            <Link
              className={`tab${isRegister ? ' on' : ''}`}
              href={`/account/register${params.toString() ? `?${params}` : ''}`}
            >
              Register
            </Link>
          </div>
          <div className="fh">
            <h1>{isRegister ? 'Create your account' : 'Welcome back'}</h1>
            <p>
              {isRegister
                ? 'Just a name, phone and password to get started.'
                : 'Enter your phone and password to continue.'}
            </p>
          </div>

          <form onSubmit={submit}>
            {isRegister ? (
              <div className="field">
                <label>Full name</label>
                <div className="inp">
                  <span className="ic">👤</span>
                  <input
                    type="text"
                    placeholder="Rahim Uddin"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>
            ) : null}
            <div className="field">
              <label>Phone number</label>
              <div className="inp">
                <span className="ic">📱</span>
                <input
                  type="tel"
                  placeholder="01712 345 678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </div>
            </div>
            <div className="field">
              <label>Password</label>
              <div className="inp">
                <span className="ic">🔒</span>
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  className="eye"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label="Show password"
                >
                  👁
                </button>
              </div>
            </div>
            {!isRegister ? (
              <div className="row-between">
                <label className="chk">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  <span className="box" /> Remember me
                </label>
              </div>
            ) : null}

            {error ? (
              <div
                className="hint"
                style={{ color: 'var(--danger)', fontWeight: 700, margin: '10px 0' }}
              >
                {error}
              </div>
            ) : null}

            <button className="btn btn-b btn-block" disabled={busy} type="submit">
              {busy
                ? 'Please wait…'
                : isRegister
                  ? 'Create account →'
                  : 'Log in →'}
            </button>
          </form>

          <p className="swap">
            {isRegister ? (
              <>
                Already have an account?{' '}
                <Link href={`/account/login${params.toString() ? `?${params}` : ''}`}>
                  Log in
                </Link>
              </>
            ) : (
              <>
                New to HaorBoat?{' '}
                <Link href={`/account/register${params.toString() ? `?${params}` : ''}`}>
                  Create an account
                </Link>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
