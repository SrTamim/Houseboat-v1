'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { toE164, apiErrorMessage } from '@/lib/owner/format';
import { PRIMARY_BTN, NAV_BTN_O } from '@/lib/customer/boat-card';

// ---- design tokens (copied verbatim from AuthModal — not exported there) ----
const LABEL = 'mb-1.5 block text-[13px] font-bold text-ink';
const INPUT =
  'w-full rounded border border-hair bg-bg py-3 px-3.5 text-[15px] text-ink transition-[border-color,box-shadow] duration-150 placeholder:text-muted focus:border-blue focus:bg-raise-1 focus:shadow-[0_0_0_3px_var(--blue-050)] focus:outline-none';

const OTP_TTL_S = 120; // must match backend OTP_TTL_S
const RED_AT_S = 40; // timer turns red with this many seconds left
const MAX_RESENDS = 3;
const PW_MIN = 6;

type Step = 'phone' | 'otp' | 'password' | 'done';

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Forgot-password stepper (phone → OTP → new password → done), shared by the
 * customer AuthModal and the owner login page. Anonymous — hits the public
 * /auth/password/* endpoints, so no CSRF token is needed.
 *
 * `onDone` returns control to the host's login view.
 */
export function ForgotPasswordFlow({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OTP
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [remaining, setRemaining] = useState(OTP_TTL_S);
  const [resends, setResends] = useState(0);
  const boxRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset ticket + new password
  const [resetTicket, setResetTicket] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);

  const expired = remaining <= 0;
  const canResend = expired && resends < MAX_RESENDS;

  // Countdown — runs only on the OTP step.
  useEffect(() => {
    if (step !== 'otp') return;
    if (remaining <= 0) return;
    const id = window.setInterval(() => {
      setRemaining((r) => (r <= 1 ? 0 : r - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [step, remaining]);

  // ---- password checklist (realtime) ----
  const checks = useMemo(() => {
    const hasLetter = /[A-Za-z]/.test(pw);
    const hasNumber = /\d/.test(pw);
    const longEnough = pw.length >= PW_MIN;
    const match = pw.length > 0 && pw === pw2;
    return { hasLetter, hasNumber, longEnough, match };
  }, [pw, pw2]);
  const allValid =
    checks.hasLetter && checks.hasNumber && checks.longEnough && checks.match;

  async function sendOtp(isResend: boolean) {
    setError(null);
    if (!phone.trim()) {
      setError('Your phone number is required.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/password/request-otp', { phone: toE164(phone) });
      setDigits(Array(6).fill(''));
      setRemaining(OTP_TTL_S);
      if (isResend) setResends((n) => n + 1);
      setStep('otp');
      // Focus the first OTP box after render.
      window.setTimeout(() => boxRefs.current[0]?.focus(), 30);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not send the code. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  function setDigit(i: number, value: string) {
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      setDigits((d) => {
        const next = [...d];
        next[i] = '';
        return next;
      });
      return;
    }
    // A paste into one box fills forward from there.
    setDigits((d) => {
      const next = [...d];
      const chars = clean.split('');
      for (let k = 0; k < chars.length && i + k < 6; k++) {
        next[i + k] = chars[k];
      }
      return next;
    });
    const nextIndex = Math.min(i + clean.length, 5);
    boxRefs.current[nextIndex]?.focus();
  }

  function onDigitKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      boxRefs.current[i - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && i > 0) boxRefs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) boxRefs.current[i + 1]?.focus();
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const code = digits.join('');
    if (code.length !== 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post<{ resetTicket: string }>(
        '/auth/password/verify-otp',
        { phone: toE164(phone), code },
      );
      setResetTicket(data.resetTicket);
      setStep('password');
    } catch (err) {
      setError(apiErrorMessage(err, 'Wrong OTP. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!allValid) return;
    setBusy(true);
    try {
      await api.post('/auth/password/reset', { resetTicket, password: pw });
      setStep('done');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not reset your password.'));
    } finally {
      setBusy(false);
    }
  }

  // ---------------------------------------------------------------- render ---
  if (step === 'done') {
    return (
      <div className="py-4 text-center" role="status" aria-live="polite">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[color-mix(in_srgb,var(--ok)_14%,var(--raise-1))] text-2xl text-ok">
          ✓
        </div>
        <h2 className="font-display text-[21px] font-semibold tracking-[-.02em] text-ink">
          Password updated
        </h2>
        <p className="mx-auto mt-2 max-w-[32ch] text-[13.5px] leading-[1.55] text-muted">
          You can now sign in with your new password.
        </p>
        <button
          type="button"
          onClick={onDone}
          className={`${PRIMARY_BTN} mt-5`}
        >
          Back to login →
        </button>
      </div>
    );
  }

  const errorNode = (
    <div aria-live="polite">
      {error ? (
        <p className="mb-3 text-[13px] font-bold text-danger">{error}</p>
      ) : null}
    </div>
  );

  if (step === 'phone') {
    return (
      <div>
        <h2 className="font-display text-[21px] font-semibold tracking-[-.02em] text-ink">
          Forgot Password
        </h2>
        <p className="mb-5 mt-1 text-[13.5px] text-muted">
          Enter your registered phone number. We’ll send an OTP to reset your
          password.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendOtp(false);
          }}
        >
          <div className="mb-4">
            <label className={LABEL} htmlFor="fp-phone">
              Phone number
            </label>
            <input
              id="fp-phone"
              type="tel"
              className={INPUT}
              placeholder="01XXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              autoFocus
              required
            />
          </div>
          {errorNode}
          <button className={PRIMARY_BTN} disabled={busy} type="submit">
            {busy ? 'Sending…' : 'Send OTP'}
          </button>
        </form>
        <button
          type="button"
          onClick={onDone}
          className="mt-4 block text-[13.5px] font-bold text-blue hover:underline"
        >
          ← Back to Login
        </button>
      </div>
    );
  }

  if (step === 'otp') {
    return (
      <div>
        <h2 className="font-display text-[21px] font-semibold tracking-[-.02em] text-ink">
          Verify Phone
        </h2>
        <p className="mb-5 mt-1 text-[13.5px] leading-[1.55] text-muted">
          An OTP has been sent to{' '}
          <b className="text-ink">{phone}</b>. Please enter it below to verify.
        </p>
        <form onSubmit={verifyOtp}>
          <label className={`${LABEL} text-center`}>OTP CODE</label>
          <div className="mb-4 flex justify-center gap-2.5">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  boxRefs.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={d}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => onDigitKey(i, e)}
                aria-label={`Digit ${i + 1}`}
                className="h-12 w-11 rounded border border-hair bg-bg text-center text-[18px] font-bold text-ink transition-[border-color,box-shadow] duration-150 focus:border-blue focus:shadow-[0_0_0_3px_var(--blue-050)] focus:outline-none"
              />
            ))}
          </div>

          <div className="mb-4 text-center" aria-live="polite">
            {expired ? (
              <p className="text-[13px] font-bold text-danger">
                OTP Expired. Click Resend to get a new OTP.
              </p>
            ) : (
              <p
                className={`text-[13px] font-bold ${remaining <= RED_AT_S ? 'text-danger' : 'text-muted'}`}
              >
                OTP expires in {fmt(remaining)}
              </p>
            )}
          </div>

          {errorNode}

          {expired ? (
            <button
              type="button"
              disabled={!canResend || busy}
              onClick={() => void sendOtp(true)}
              className={`${NAV_BTN_O} w-full justify-center disabled:cursor-not-allowed disabled:opacity-55`}
            >
              {resends >= MAX_RESENDS
                ? 'Resend limit reached — wait 10 minutes'
                : busy
                  ? 'Resending…'
                  : 'Resend OTP'}
            </button>
          ) : (
            <button className={PRIMARY_BTN} disabled={busy} type="submit">
              {busy ? 'Verifying…' : 'Verify OTP'}
            </button>
          )}
        </form>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setStep('phone');
          }}
          className="mt-4 block w-full text-center text-[13.5px] font-bold text-blue hover:underline"
        >
          ‹ Back
        </button>
      </div>
    );
  }

  // step === 'password'
  const strengthCount = [
    checks.longEnough,
    checks.hasLetter,
    checks.hasNumber,
  ].filter(Boolean).length;

  return (
    <div>
      <h2 className="font-display text-[21px] font-semibold tracking-[-.02em] text-ink">
        Set a new password
      </h2>
      <p className="mb-5 mt-1 text-[13.5px] text-muted">
        Choose a password with at least {PW_MIN} characters, a letter and a
        number.
      </p>
      <form onSubmit={submitPassword}>
        <div className="mb-3">
          <label className={LABEL} htmlFor="fp-pw">
            Password <span className="font-normal text-danger">*</span>
          </label>
          <div className="relative">
            <input
              id="fp-pw"
              type={showPw ? 'text' : 'password'}
              className={`${INPUT} pr-11`}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="new-password"
              autoFocus
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

          {/* strength bar */}
          <div className="mt-2 flex gap-1.5" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i < strengthCount
                    ? strengthCount >= 3
                      ? 'bg-ok'
                      : 'bg-danger'
                    : 'bg-hair'
                }`}
              />
            ))}
          </div>

          {/* chips */}
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Chip on={checks.hasLetter}>A-Z / a-z</Chip>
            <Chip on={checks.hasNumber}>0-9</Chip>
            <Chip on={checks.longEnough}>min {PW_MIN} chars</Chip>
          </div>

          {pw.length > 0 && strengthCount < 3 ? (
            <p className="mt-2 text-[12.5px] font-bold text-danger">
              ✗ Weak password
            </p>
          ) : null}
        </div>

        <div className="mb-4">
          <label className={LABEL} htmlFor="fp-pw2">
            Confirm password <span className="font-normal text-danger">*</span>
          </label>
          <input
            id="fp-pw2"
            type={showPw ? 'text' : 'password'}
            className={`${INPUT} ${
              pw2.length > 0
                ? checks.match
                  ? 'border-ok shadow-[0_0_0_3px_color-mix(in_srgb,var(--ok)_20%,transparent)]'
                  : 'border-danger'
                : ''
            }`}
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            autoComplete="new-password"
          />
          {pw2.length > 0 && !checks.match ? (
            <p className="mt-1.5 text-[12.5px] font-bold text-danger">
              ✗ Passwords do not match
            </p>
          ) : null}
        </div>

        {errorNode}

        <button
          className={PRIMARY_BTN}
          disabled={busy || !allValid}
          type="submit"
        >
          {busy ? 'Saving…' : 'Reset password →'}
        </button>
      </form>
    </div>
  );
}

/** A single realtime requirement chip: hollow when unmet, green ✓ when met. */
function Chip({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[11.5px] font-semibold transition-colors ${
        on
          ? 'border-[color-mix(in_srgb,var(--ok)_22%,transparent)] bg-[color-mix(in_srgb,var(--ok)_13%,transparent)] text-ok'
          : 'border-hair bg-chip text-muted'
      }`}
    >
      <span aria-hidden="true">{on ? '✓' : '○'}</span>
      {children}
    </span>
  );
}
