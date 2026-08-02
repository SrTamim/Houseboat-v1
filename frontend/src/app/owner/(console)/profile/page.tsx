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

interface FoodMenu {
  breakfast?: string;
  brunch?: string;
  lunch?: string;
  snacks?: string;
  dinner?: string;
}

interface BankAccount {
  bankName?: string;
  accountNo?: string;
  accountHolder?: string;
  district?: string;
  branch?: string;
  routingNumber?: string;
}

interface ChildBand {
  min: number;
  max: number;
  chargePct: number;
}

interface BoatDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  safetyFeatures: string | null;
  foodMenu: FoodMenu | null;
  bankAccount: BankAccount | null;
  childPolicy: ChildBand[] | null;
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

const MEALS: { key: keyof FoodMenu; label: string; placeholder: string }[] = [
  { key: 'breakfast', label: 'Breakfast', placeholder: 'Paratha, egg, seasonal bhaji and tea' },
  { key: 'brunch', label: 'Brunch', placeholder: 'Fresh fruit and light snacks' },
  { key: 'lunch', label: 'Lunch', placeholder: 'Rice, dal, fish, vegetables and bhorta' },
  { key: 'snacks', label: 'Snacks', placeholder: 'Evening pakora, muri and tea' },
  { key: 'dinner', label: 'Dinner', placeholder: 'BBQ night — chicken, fish, rice and dessert' },
];

const BANK_FIELDS: { key: keyof BankAccount; label: string; placeholder?: string }[] = [
  { key: 'bankName', label: 'Bank name', placeholder: 'City Bank' },
  { key: 'accountNo', label: 'Account number' },
  { key: 'accountHolder', label: 'Account holder name' },
  { key: 'district', label: 'District' },
  { key: 'branch', label: 'Branch' },
  { key: 'routingNumber', label: 'Routing number' },
];

const EMPTY_BANK: BankAccount = {
  bankName: '',
  accountNo: '',
  accountHolder: '',
  district: '',
  branch: '',
  routingNumber: '',
};

export default function OwnerProfilePage() {
  const { boatId } = useActiveBoat();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [safetyFeatures, setSafetyFeatures] = useState('');
  const [foodMenu, setFoodMenu] = useState<FoodMenu>({});
  const [bank, setBank] = useState<BankAccount>(EMPTY_BANK);
  const [childPolicy, setChildPolicy] = useState<ChildBand[]>([]);

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
    setFoodMenu(b.foodMenu ?? {});
    setBank({ ...EMPTY_BANK, ...(b.bankAccount ?? {}) });
    setChildPolicy(Array.isArray(b.childPolicy) ? b.childPolicy : []);
  }, [boat.data]);

  const linkedId = boat.data?.routes[0]?.route.id ?? '';

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const bankFilled = Object.values(bank).some((v) => v && v.trim());
      await api.patch(`/houseboats/${boatId}`, {
        name,
        description: description || undefined,
        safetyFeatures: safetyFeatures || undefined,
        foodMenu,
        bankAccount: bankFilled ? bank : undefined,
        childPolicy,
      });
      setSaved(true);
      await boat.mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the profile.'));
    } finally {
      setBusy(false);
    }
  }

  async function chooseRoute(routeId: string) {
    if (busy || routeId === linkedId) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/houseboats/${boatId}/routes`, { routeId });
      await boat.mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not set that route.'));
    } finally {
      setBusy(false);
    }
  }

  function addBand() {
    const last = childPolicy[childPolicy.length - 1];
    const min = last ? last.max : 0;
    setChildPolicy([...childPolicy, { min, max: min + 1, chargePct: 100 }]);
  }

  function updateBand(i: number, patch: Partial<ChildBand>) {
    setChildPolicy(childPolicy.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }

  function removeBand(i: number) {
    setChildPolicy(childPolicy.filter((_, idx) => idx !== i));
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
        <form onSubmit={save}>
          <div className="grid-2">
            <div className="stack">
              <Card title="Basics">
                <div style={{ display: 'grid', gap: 12 }}>
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
                </div>
              </Card>

              <Card title="Food menu" sub="one line per meal">
                <div style={{ display: 'grid', gap: 12 }}>
                  {MEALS.map((m) => (
                    <Field key={m.key} label={m.label}>
                      <textarea
                        rows={2}
                        value={foodMenu[m.key] ?? ''}
                        placeholder={m.placeholder}
                        onChange={(e) =>
                          setFoodMenu({ ...foodMenu, [m.key]: e.target.value })
                        }
                      />
                    </Field>
                  ))}
                </div>
              </Card>

              <Card title="Route" sub="platform-curated · one per boat">
                <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                  {(routes.data ?? []).map((r) => (
                    <label
                      key={r.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                    >
                      <input
                        type="radio"
                        name="route"
                        checked={linkedId === r.id}
                        disabled={busy}
                        onChange={() => chooseRoute(r.id)}
                      />
                      <span>
                        {r.name}
                        {r.region ? <span className="t2"> · {r.region}</span> : null}
                      </span>
                    </label>
                  ))}
                </div>
                <Note kind="info">
                  A boat runs exactly one route — this is what your weekly schedule builds
                  departures for. Only the platform creates routes.
                </Note>
              </Card>

              <Card title="Bank account" sub="required before any payout">
                <div style={{ display: 'grid', gap: 12 }}>
                  {BANK_FIELDS.map((f) => (
                    <Field key={f.key} label={f.label}>
                      <input
                        value={bank[f.key] ?? ''}
                        placeholder={f.placeholder}
                        onChange={(e) => setBank({ ...bank, [f.key]: e.target.value })}
                      />
                    </Field>
                  ))}
                  <Note kind="warn">
                    A payout batch cannot even be prepared without this. Your account number
                    is stored as a reference — the audit trail never records it in full.
                  </Note>
                </div>
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
                    ['Route', boat.data?.routes[0]?.route.name ?? '—'],
                  ]}
                />
                <Note kind="info" style={{ marginTop: 12 }}>
                  Only these dates can carry a departure. Everything else is invisible to
                  customers, however full your schedule looks.
                </Note>
              </Card>

              <Card title="Child policy" sub="age bands — first match wins">
                <div className="stack" style={{ gap: 10 }}>
                  {childPolicy.length === 0 ? (
                    <Note kind="info">
                      No bands set, so children are charged the full per-person rate.
                    </Note>
                  ) : (
                    childPolicy.map((b, i) => (
                      <div
                        key={i}
                        style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}
                      >
                        <Field label="Age from">
                          <input
                            type="number"
                            min={0}
                            value={b.min}
                            onChange={(e) =>
                              updateBand(i, { min: Number(e.target.value) })
                            }
                          />
                        </Field>
                        <Field label="Age to">
                          <input
                            type="number"
                            min={0}
                            value={b.max}
                            onChange={(e) =>
                              updateBand(i, { max: Number(e.target.value) })
                            }
                          />
                        </Field>
                        <Field label="Charge %">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={b.chargePct}
                            onChange={(e) =>
                              updateBand(i, { chargePct: Number(e.target.value) })
                            }
                          />
                        </Field>
                        <button
                          type="button"
                          className="btn btn-o btn-sm"
                          onClick={() => removeBand(i)}
                          aria-label="Remove band"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                  <div>
                    <button type="button" className="btn btn-o btn-sm" onClick={addBand}>
                      ＋ Add band
                    </button>
                  </div>
                  <Note kind="info">
                    “Age to” is exclusive: 0–3 at 0% means under-3s are free; 3–5 at 50% is
                    ages 3 and 4 at half price.
                  </Note>
                </div>
              </Card>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <button className="btn btn-b" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </form>
      </AsyncBlock>
    </>
  );
}
