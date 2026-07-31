'use client';

import { useState } from 'react';
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
import { Drawer } from '@/components/owner/Drawer';
import { apiErrorMessage } from '@/lib/owner/format';

interface TripPackage {
  id: string;
  durationDays: number;
  durationLabel: string | null;
  departureGhat: string | null;
  returnGhat: string | null;
  meals: string | null;
  included: string | null;
  excluded: string | null;
  route: { id: string; name: string; region: string | null };
  departures: { id: string; status: string }[];
}

interface Route {
  id: string;
  name: string;
  region: string | null;
}

/** Split a comma or newline separated list into chips. */
function chips(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function OwnerPackagesPage() {
  const { boatId } = useActiveBoat();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [routeId, setRouteId] = useState('');
  const [durationDays, setDurationDays] = useState('2');
  const [durationLabel, setDurationLabel] = useState('');
  const [departureGhat, setDepartureGhat] = useState('');
  const [returnGhat, setReturnGhat] = useState('');
  const [meals, setMeals] = useState('');
  const [included, setIncluded] = useState('');
  const [excluded, setExcluded] = useState('');

  const packages = useSWR<TripPackage[]>(`/houseboats/${boatId}/packages`, fetcher, {
    revalidateOnFocus: false,
  });
  // Boat-linked routes are what a package may use; the platform curates the list.
  const boat = useSWR<{ routes: { route: Route }[] }>(
    `/houseboats/${boatId}/manage`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const routes = (boat.data?.routes ?? []).map((r) => r.route);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !routeId) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/houseboats/${boatId}/packages`, {
        routeId,
        durationDays: Number(durationDays),
        durationLabel: durationLabel || undefined,
        departureGhat: departureGhat || undefined,
        returnGhat: returnGhat || undefined,
        meals: meals || undefined,
        included: included || undefined,
        excluded: excluded || undefined,
      });
      setOpen(false);
      setDurationLabel('');
      setDepartureGhat('');
      setReturnGhat('');
      setMeals('');
      setIncluded('');
      setExcluded('');
      await packages.mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create the package.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="Trip packages"
        desc="A package is a route plus a duration — the thing a customer actually books. Departures are scheduled against a package."
        actions={
          <button className="btn btn-b" onClick={() => setOpen(true)} disabled={routes.length === 0}>
            ＋ New package
          </button>
        }
      />

      {routes.length === 0 && !boat.isLoading ? (
        <Note kind="warn" style={{ marginBottom: 18 }}>
          No routes are linked to this boat yet. Link one from the boat profile — routes
          are curated by the platform, so you pick from their list rather than creating
          your own.
        </Note>
      ) : null}

      <div className="stack">
        <AsyncBlock
          isLoading={packages.isLoading}
          error={packages.error}
          isEmpty={(packages.data?.length ?? 0) === 0}
          onRetry={() => packages.mutate()}
          empty={
            <Card>
              <div className="state">
                <div className="ic">📦</div>
                <h4>No packages yet</h4>
                <p>
                  Create one to describe what you sell — the route, how many days, and
                  what is included.
                </p>
              </div>
            </Card>
          }
        >
          {packages.data?.map((p) => {
            const live = p.departures.filter((d) => d.status !== 'cancelled').length;
            return (
              <Card
                key={p.id}
                title={`${p.route.name} · ${p.durationLabel ?? `${p.durationDays} days`}`}
                sub={p.route.region ?? undefined}
                actions={
                  <Pill tone={live > 0 ? 'ok' : 'mut'}>
                    {live > 0 ? `${live} departures` : 'no departures'}
                  </Pill>
                }
              >
                <div className="grid-2">
                  <Kv
                    rows={[
                      ['Route', p.route.name],
                      ['Duration', p.durationLabel ?? `${p.durationDays} day(s)`],
                      ['Departure ghat', p.departureGhat ?? '—'],
                      ['Return ghat', p.returnGhat ?? '—'],
                      ['Meals', p.meals ?? '—'],
                    ]}
                  />
                  <div className="stack" style={{ gap: 12 }}>
                    <div>
                      <div
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '.06em',
                          color: 'var(--muted)',
                          marginBottom: 6,
                        }}
                      >
                        Included
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {chips(p.included).length > 0 ? (
                          chips(p.included).map((c) => (
                            <span className="tag" key={c}>
                              {c}
                            </span>
                          ))
                        ) : (
                          <span className="t2">Not listed</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '.06em',
                          color: 'var(--muted)',
                          marginBottom: 6,
                        }}
                      >
                        Excluded
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {chips(p.excluded).length > 0 ? (
                          chips(p.excluded).map((c) => (
                            <span className="tag" key={c}>
                              {c}
                            </span>
                          ))
                        ) : (
                          <span className="t2">Not listed</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </AsyncBlock>
      </div>

      <Drawer
        open={open}
        title="New package"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-o" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-b" onClick={create} disabled={busy || !routeId}>
              {busy ? 'Creating…' : 'Create package'}
            </button>
          </>
        }
      >
        <form onSubmit={create} style={{ display: 'grid', gap: 12 }}>
          {error ? <Note kind="danger">{error}</Note> : null}

          <Field label="Route">
            <select value={routeId} onChange={(e) => setRouteId(e.target.value)} required>
              <option value="">Choose a route…</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.region ? ` · ${r.region}` : ''}
                </option>
              ))}
            </select>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Duration (days)">
              <input
                type="number"
                min={1}
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                required
              />
            </Field>
            <Field label="Shown as">
              <input
                value={durationLabel}
                onChange={(e) => setDurationLabel(e.target.value)}
                placeholder="2 days 1 night"
              />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Departure ghat">
              <input
                value={departureGhat}
                onChange={(e) => setDepartureGhat(e.target.value)}
                placeholder="Tahirpur ghat"
              />
            </Field>
            <Field label="Return ghat">
              <input value={returnGhat} onChange={(e) => setReturnGhat(e.target.value)} />
            </Field>
          </div>

          <Field label="Meals">
            <input
              value={meals}
              onChange={(e) => setMeals(e.target.value)}
              placeholder="Breakfast, lunch, dinner"
            />
          </Field>

          <Field label="Included (comma separated)">
            <input
              value={included}
              onChange={(e) => setIncluded(e.target.value)}
              placeholder="Guide, life jackets, generator"
            />
          </Field>

          <Field label="Excluded (comma separated)">
            <input
              value={excluded}
              onChange={(e) => setExcluded(e.target.value)}
              placeholder="Transport to ghat, entry fees"
            />
          </Field>
        </form>
      </Drawer>
    </>
  );
}
