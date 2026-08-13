'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { apiErrorMessage } from '@/lib/owner/format';
import type { CustomerUser } from '@/lib/customer/session';

/** Profile & settings (design: haorboat-account-profile.html). */
export default function ProfilePage() {
  const { data, mutate } = useSWR<CustomerUser>('/auth/me', fetcher, {
    revalidateOnFocus: false,
  });

  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Uncontrolled-until-edited: fall back to the loaded value.
  const nameVal = name ?? data?.name ?? '';
  const emailVal = email ?? data?.email ?? '';
  const phoneVal = phone ?? data?.phone ?? '';

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.patch('/me', {
        name: nameVal,
        email: emailVal || undefined,
        phone: phoneVal,
      });
      await mutate();
      setMsg({ ok: true, text: 'Profile updated.' });
    } catch (e) {
      setMsg({ ok: false, text: apiErrorMessage(e, 'Could not save changes.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Profile &amp; settings</h1>
        <p>Manage your contact details.</p>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <div className="fld">
          <label>Full name</label>
          <input
            type="text"
            value={nameVal}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>
        <div className="fld">
          <label>Phone</label>
          <input
            type="tel"
            value={phoneVal}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01XXXXXXXXX"
          />
        </div>
        <div className="fld">
          <label>Email</label>
          <input
            type="email"
            value={emailVal}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
          />
        </div>

        {msg ? (
          <div
            className="hint"
            style={{
              color: msg.ok ? 'var(--ok)' : 'var(--danger)',
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            {msg.text}
          </div>
        ) : null}

        <button className="btn btn-b" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </>
  );
}
