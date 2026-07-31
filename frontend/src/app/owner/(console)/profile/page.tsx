'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import {
  PageHead,
  Card,
  Field,
  Note,
  Kv,
  AsyncBlock,
} from '@/components/owner/ui';
import { Pill } from '@/components/owner/Pill';
import { apiErrorMessage, humanize } from '@/lib/owner/format';

interface BoatDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  safetyFeatures: string | null;
  foodMenu: string | null;
  bankAccount: Record<string, unknown> | null;
  childPolicy: Record<string, unknown> | null;
  profileCompletePct: number;
  status: string;
  operatingDates: string[];
  routes: { route: { id: string; name: string; region: string | null } }[];
}

interface Route {
  id: string;
  name: string;
  region: string | null;
}

export default function OwnerProfilePage() {
  const { boatId } = useActiveBoat();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [safetyFeatures, setSafetyFeatures] = useState('');
  const [foodMenu, setFoodMenu] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');

  const boat = useSWR<BoatDetail>(`/houseboats/${boatId}/manage`, fetcher, {
    revalidateOnFocus: false,
  });
  const routes = useSWR<Route[]>('/routes', fetcher, { revalidateOnFocus: false });

  // Hydrate the form once the boat loads, and again when the active boat
  // changes — otherwise switching boats would leave the previous one's text.
  useEffect(() => {
    const b = boat.data;
    if (!b) return;
    setName(b.name);
    setDescription(b.description ?? '');
    setSafetyFeatures(b.safetyFeatures ?? '');
    setFoodMenu(b.foodMenu ?? '');
    const acct = b.bankAccount as
      | { bankName?: string; accountNumber?: string; accountHolder?: string }
      | null;
    setBankName(acct?.bankName ?? '');
    setAccountNumber(acct?.accountNumber ?? '');
    setAccountHolder(acct?.accountHolder ?? '');
  }, [boat.data]);

  const linkedIds = new Set((boat.data?.routes ?? []).map((r) => r.route.id));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api.patch(`/houseboats/${boatId}`, {
        name,
        description: description || undefined,
        safetyFeatures: safetyFeatures || undefined,
        foodMenu: foodMenu || undefined,
        bankAccount:
          bankName || accountNumber
            ? { bankName, accountNumber, accountHolder }
            : undefined,
      });
      setSaved(true);
      await boat.mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the profile.'));
    } finally {
      setBusy(false);
    }
  }

  async function linkRoute(routeId: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/houseboats/${boatId}/routes`, { routeId });
      await boat.mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not link that route.'));
    } finally {
      setBusy(false);
    }
  }

  const pct = boat.data?.profileCompletePct ?? 0;

  return (
    <>
      <PageHead
        title="Boat profile"
        desc="What customers see, plus the details the platform needs before this boat can go live and take money."
        actions={
          boat.data ? (
            <Pill tone={boat.data.status === 'live' ? 'ok' : 'warn'}>
              {humanize(boat.data.status)}
            </Pill>
          ) : undefined
        }
      />

      {saved ? (
        <Note kind="ok" style={{ marginBottom: 18 }}>
          Profile saved.
        </Note>
      ) : null}
      {error ? (
        <Note kind="danger" style={{ marginBottom: 18 }}>
          {error}
        </Note>
      ) : null}

      <AsyncBlock isLoading={boat.isLoading} error={boat.error} onRetry={() => boat.mutate()}>
        <div className="grid-2">
          <div className="stack">
            <Card title="Basics">
              <form onSubmit={save} style={{ display: 'grid', gap: 12 }}>
                <Field label="Boat name">
                  <input value={name} onChange={(e) => setName(e.target.value)} required />
                </Field>

                <Field label="Public URL">
                  <input value={`/houseboat/${boat.data?.slug ?? ''}`} readOnly />
                </Field>

                <Field label="Description">
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Field>

                <Field label="Safety features">
                  <textarea
                    rows={2}
                    value={safetyFeatures}
                    onChange={(e) => setSafetyFeatures(e.target.value)}
                    placeholder="Life jackets for all guests, trained crew, first-aid kit"
                  />
                </Field>

                <Field label="Food menu">
                  <textarea
                    rows={2}
                    value={foodMenu}
                    onChange={(e) => setFoodMenu(e.target.value)}
                  />
                </Field>

                <div>
                  <button className="btn btn-b" type="submit" disabled={busy}>
                    {busy ? 'Saving…' : 'Save profile'}
                  </button>
                </div>
              </form>
            </Card>

            <Card title="Routes" sub="platform-curated">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {(routes.data ?? []).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`btn btn-sm ${linkedIds.has(r.id) ? 'btn-b' : 'btn-o'}`}
                    disabled={linkedIds.has(r.id) || busy}
                    onClick={() => linkRoute(r.id)}
                  >
                    {linkedIds.has(r.id) ? '✓ ' : '＋ '}
                    {r.name}
                  </button>
                ))}
              </div>
              <Note kind="info">
                Only the platform creates routes. You pick which of them this boat runs —
                a package is then a route plus a duration.
              </Note>
            </Card>

            <Card title="Bank account" sub="required before any payout">
              <form onSubmit={save} style={{ display: 'grid', gap: 12 }}>
                <Field label="Bank name">
                  <input
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="City Bank"
                  />
                </Field>
                <Field label="Account number">
                  <input
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                  />
                </Field>
                <Field label="Account holder">
                  <input
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                  />
                </Field>
                <div>
                  <button className="btn btn-b" type="submit" disabled={busy}>
                    {busy ? 'Saving…' : 'Save bank details'}
                  </button>
                </div>
                <Note kind="warn">
                  A payout batch cannot even be prepared without this. Your account number
                  is stored as a reference — the audit trail never records it in full.
                </Note>
              </form>
            </Card>
          </div>

          <div className="stack">
            <Card title="Completion">
              <div
                style={{
                  fontSize: 34,
                  fontFamily: 'var(--display)',
                  fontWeight: 600,
                  color: pct >= 100 ? 'var(--ok)' : 'var(--warn)',
                }}
              >
                {pct}%
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: 999,
                  background: 'var(--field)',
                  overflow: 'hidden',
                  margin: '10px 0 14px',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, pct)}%`,
                    height: '100%',
                    background: pct >= 100 ? 'var(--ok)' : 'var(--warn)',
                  }}
                />
              </div>
              <div className="stack" style={{ gap: 8 }}>
                <Note kind={boat.data?.bankAccount ? 'ok' : 'warn'}>
                  {boat.data?.bankAccount
                    ? 'Bank account on file'
                    : 'No bank account — payouts cannot run'}
                </Note>
                <Note kind={boat.data?.status === 'live' ? 'ok' : 'info'}>
                  {boat.data?.status === 'live'
                    ? 'Approved and visible to customers'
                    : 'The platform reviews the boat once the profile is complete'}
                </Note>
              </div>
            </Card>

            <Card title="Operating dates">
              <Kv
                rows={[
                  ['Dates set', boat.data?.operatingDates.length ?? 0],
                  ['Routes linked', boat.data?.routes.length ?? 0],
                ]}
              />
              <Note kind="info" style={{ marginTop: 12 }}>
                Only these dates can carry a departure. Everything else is invisible to
                customers, however full your schedule looks.
              </Note>
            </Card>

            <Card title="Child policy">
              {boat.data?.childPolicy ? (
                <pre
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: 'var(--body)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {JSON.stringify(boat.data.childPolicy, null, 2)}
                </pre>
              ) : (
                <Note kind="info">
                  No child policy set, so children are charged the full per-person rate.
                </Note>
              )}
            </Card>
          </div>
        </div>
      </AsyncBlock>
    </>
  );
}
