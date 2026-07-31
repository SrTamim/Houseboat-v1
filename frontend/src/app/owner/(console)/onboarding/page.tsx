'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { PageHead, Card, Field, Note } from '@/components/owner/ui';
import { apiErrorMessage } from '@/lib/owner/format';

/**
 * Add another boat from inside the console.
 *
 * Same call as the signup flow's second step: POST /houseboats creates the
 * boat, the Owner role and the membership together, so the new boat appears in
 * the switcher on the next load.
 */
export default function OwnerOnboardingPage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post<{ id: string }>('/houseboats', {
        name,
        description: description || undefined,
      });
      try {
        localStorage.setItem('hb_owner_boat', data.id);
      } catch {
        // Storage unavailable — the switcher still lists the new boat.
      }
      // Hard navigation so the server layout re-reads /me/boats and the new
      // boat is present in the switcher.
      window.location.assign('/owner/profile');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create the boat. Please try again.'));
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="Add a boat"
        desc="Creates the boat and makes you its Owner with full permissions. Complete the profile afterwards — decks, cabins, pricing and a bank account are all required before it can go live."
      />

      <Card title="Boat details" style={{ maxWidth: 620 }}>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error ? <Note kind="danger">{error}</Note> : null}

          <Field label="Boat name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Meghduar"
              required
            />
          </Field>

          <Field label="Short description">
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A comfortable houseboat cruising the haor."
            />
          </Field>

          <Note kind="info">
            The boat starts as a draft. The platform reviews it once the profile reaches
            100% and a bank account is on file.
          </Note>

          <div>
            <button className="btn btn-b" type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create boat →'}
            </button>
          </div>
        </form>
      </Card>
    </>
  );
}
