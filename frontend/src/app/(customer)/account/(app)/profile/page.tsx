'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { apiErrorMessage } from '@/lib/owner/format';
import type { CustomerUser } from '@/lib/customer/session';

/** Initials for the avatar, from a name or phone. */
function initials(user?: CustomerUser): string {
  const n = user?.name?.trim();
  if (n) {
    const parts = n.split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
  }
  return (user?.phone ?? '👤').slice(-2);
}

/** Profile & settings (design: haorboat-account-profile.html). Reads /auth/me,
 * saves via PATCH /me (name / phone / email — the only fields the API accepts). */
export default function ProfilePage() {
  const { data, mutate } = useSWR<CustomerUser>('/auth/me', fetcher, {
    revalidateOnFocus: false,
  });

  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [nid, setNid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const nameVal = name ?? data?.name ?? '';
  const emailVal = email ?? data?.email ?? '';
  const phoneVal = phone ?? data?.phone ?? '';
  const nidVal = nid ?? data?.nid ?? '';

  const dirty =
    (name !== null && name !== (data?.name ?? '')) ||
    (email !== null && email !== (data?.email ?? '')) ||
    (phone !== null && phone !== (data?.phone ?? '')) ||
    (nid !== null && nid !== (data?.nid ?? ''));

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.patch('/me', {
        name: nameVal,
        email: emailVal || undefined,
        phone: phoneVal,
        nid: nidVal,
      });
      await mutate();
      setName(null);
      setEmail(null);
      setPhone(null);
      setNid(null);
      setMsg({ ok: true, text: 'Profile updated.' });
    } catch (e) {
      setMsg({ ok: false, text: apiErrorMessage(e, 'Could not save changes.') });
    } finally {
      setBusy(false);
    }
  };

  const discard = () => {
    setName(null);
    setEmail(null);
    setPhone(null);
    setNid(null);
    setMsg(null);
  };

  return (
    <>
      <div>
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.02em] text-ink">
          Profile &amp; settings
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Your details and how we reach you.
        </p>
      </div>

      {/* identity card */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-hair bg-raise-1 p-5 shadow-e1">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-[color-mix(in_srgb,var(--blue)_10%,transparent)] text-xl font-extrabold text-blue">
          {initials(data)}
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">
            {data?.name || 'Your account'}
          </h2>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
            {data?.phone ? <span>📱 {data.phone}</span> : null}
            {data?.email ? <span>✉️ {data.email}</span> : null}
            {data?.phoneVerified ? (
              <span className="font-semibold text-ok">✓ Phone verified</span>
            ) : null}
            {data?.nid ? <span>🪪 {data.nid}</span> : null}
          </div>
        </div>
      </div>

      {/* personal details */}
      <div className="overflow-hidden rounded-2xl border border-hair bg-raise-1 shadow-e1">
        <div className="border-b border-hair px-5 py-4">
          <h3 className="font-display text-[15px] font-semibold text-ink">
            Personal details
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <Field label="Full name">
            <input
              type="text"
              value={nameVal}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className={INPUT}
            />
          </Field>
          <Field label="Phone" hint="Used to sign in & receive vouchers">
            <input
              type="tel"
              value={phoneVal}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01XXXXXXXXX"
              className={INPUT}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={emailVal}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className={INPUT}
            />
          </Field>
          <Field
            label="NID / Passport"
            hint="Required at the ghat for every adult guest"
          >
            <input
              type="text"
              value={nidVal}
              onChange={(e) => setNid(e.target.value)}
              placeholder="1990 XXXX XXX"
              className={INPUT}
            />
          </Field>
        </div>
      </div>

      {msg ? (
        <div
          className={`text-sm font-bold ${msg.ok ? 'text-ok' : 'text-danger'}`}
        >
          {msg.text}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2.5">
        <button
          onClick={discard}
          disabled={!dirty || busy}
          className="inline-flex items-center justify-center rounded border border-hair bg-raise-1 px-5 py-2.5 text-sm font-bold text-ink shadow-e1 transition-colors hover:border-blue hover:text-blue disabled:opacity-50"
        >
          Discard
        </button>
        <button
          onClick={save}
          disabled={!dirty || busy}
          className="inline-flex items-center justify-center rounded bg-blue px-5 py-2.5 text-sm font-bold text-white shadow-e1 transition-colors hover:bg-blue-600 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </>
  );
}

const INPUT =
  'w-full rounded border border-hair bg-field px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-blue focus:shadow-ring';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-bodytext">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}
