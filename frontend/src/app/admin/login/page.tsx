'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/admin/ThemeToggle';

// Standalone sign-in — no console chrome. Uses admin.css tokens.
export default function AdminLogin() {
  const [show, setShow] = useState(false);
  return (
    <div className="login-wrap">
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 2 }}>
        <ThemeToggle />
      </div>
      <form className="login-card" onSubmit={(e) => e.preventDefault()}>
        <div className="login-logo">
          <span className="mark">⚓</span> Haor<span className="b">Boat</span>
        </div>
        <span className="login-badge">Platform console</span>
        <div className="login-lead">
          <h1>Sign in</h1>
          <p>Staff access only. Owners &amp; crew sign in from the boat dashboard.</p>
        </div>

        <div className="note danger" style={{ marginBottom: 16 }}>
          <span className="ic">⚠</span>
          <span>Wrong phone or password. 2 attempts left before a 10-minute lock.</span>
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <label>Phone</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="login-pre">+880</span>
            <input type="tel" defaultValue="1700000000" autoComplete="username" />
          </div>
        </div>
        <div className="field" style={{ marginBottom: 14 }}>
          <label>Password</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type={show ? 'text' : 'password'} defaultValue="platform-secret" autoComplete="current-password" />
            <button type="button" className="login-show" onClick={() => setShow((v) => !v)}>
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

        <button className="btn btn-b login-submit" type="submit">
          Sign in →
        </button>
        <div className="login-foot">
          Sessions expire after 15 min idle · refreshed for 30 days · CSRF-protected
        </div>
      </form>
    </div>
  );
}
