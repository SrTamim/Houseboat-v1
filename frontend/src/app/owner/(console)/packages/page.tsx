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
import { BTN_B, BTN_O, BTN_SM, FACILITY_GRID, FACILITY_OPT } from '@/components/owner/styles';
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

const MEAL_OPTIONS = [
  'Breakfast',
  'Snacks before lunch',
  'Lunch',
  'Evening snacks',
  'Dinner',
];

/** Split stored meals string into checked-known + free-text extras. */
function parseMeals(raw: string | null | undefined) {
  const parts = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const known = new Set<string>();
  const extras: string[] = [];
  const lookup = new Map(MEAL_OPTIONS.map((o) => [o.toLowerCase(), o]));
  for (const p of parts) {
    const hit = lookup.get(p.toLowerCase());
    if (hit) known.add(hit);
    else extras.push(p);
  }
  return { known, extras: extras.join(', ') };
}

/** Join checked meals + extras into one comma string (deduped). */
function serializeMeals(checked: Set<string>, extras: string): string {
  const extraList = extras
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const all = [...MEAL_OPTIONS.filter((o) => checked.has(o)), ...extraList];
  return [...new Set(all)].join(', ');
}

export default function OwnerPackagesPage() {
  const { boatId } = useActiveBoat();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TripPackage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const [routeId, setRouteId] = useState('');
  const [durationDays, setDurationDays] = useState('2');
  const [durationLabel, setDurationLabel] = useState('');
  const [departureGhat, setDepartureGhat] = useState('');
  const [returnGhat, setReturnGhat] = useState('');
  const [mealSet, setMealSet] = useState<Set<string>>(new Set());
  const [mealExtras, setMealExtras] = useState('');
  const [included, setIncluded] = useState('');

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

  function resetForm() {
    setRouteId('');
    setDurationDays('2');
    setDurationLabel('');
    setDepartureGhat('');
    setReturnGhat('');
    setMealSet(new Set());
    setMealExtras('');
    setIncluded('');
  }

  function toggleMeal(name: string, on: boolean) {
    setMealSet((prev) => {
      const next = new Set(prev);
      if (on) next.add(name);
      else next.delete(name);
      return next;
    });
  }

  function openCreate() {
    setEditing(null);
    setError(null);
    resetForm();
    setOpen(true);
  }

  function openEdit(p: TripPackage) {
    setEditing(p);
    setError(null);
    setRouteId(p.route.id);
    setDurationDays(String(p.durationDays));
    setDurationLabel(p.durationLabel ?? '');
    setDepartureGhat(p.departureGhat ?? '');
    setReturnGhat(p.returnGhat ?? '');
    const m = parseMeals(p.meals);
    setMealSet(m.known);
    setMealExtras(m.extras);
    setIncluded(p.included ?? '');
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !routeId) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        routeId,
        durationDays: Number(durationDays),
        durationLabel: durationLabel || undefined,
        departureGhat: departureGhat || undefined,
        returnGhat: returnGhat || undefined,
        meals: serializeMeals(mealSet, mealExtras) || undefined,
        included: included || undefined,
      };
      if (editing) {
        await api.patch(`/houseboats/${boatId}/packages/${editing.id}`, body);
      } else {
        await api.post(`/houseboats/${boatId}/packages`, body);
      }
      setOpen(false);
      setEditing(null);
      resetForm();
      await packages.mutate();
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          editing ? 'Could not save the package.' : 'Could not create the package.',
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: TripPackage) {
    if (busy) return;
    if (!window.confirm(`Delete "${p.route.name}"? This can't be undone.`)) return;
    setBusy(true);
    setPageError(null);
    try {
      await api.delete(`/houseboats/${boatId}/packages/${p.id}`);
      await packages.mutate();
    } catch (err) {
      setPageError(apiErrorMessage(err, 'Could not delete the package.'));
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
          <button className={BTN_B} onClick={openCreate} disabled={routes.length === 0}>
            ＋ New package
          </button>
        }
      />

      {pageError ? (
        <Note kind="danger" style={{ marginBottom: 18 }}>
          {pageError}
        </Note>
      ) : null}

      {routes.length === 0 && !boat.isLoading ? (
        <Note kind="warn" style={{ marginBottom: 18 }}>
          No routes are linked to this boat yet. Link one from the boat profile — routes
          are curated by the platform, so you pick from their list rather than creating
          your own.
        </Note>
      ) : null}

      <div className="flex flex-col gap-5">
        <AsyncBlock
          isLoading={packages.isLoading}
          error={packages.error}
          isEmpty={(packages.data?.length ?? 0) === 0}
          onRetry={() => packages.mutate()}
          empty={
            <Card>
              <div className="px-6 py-11 text-center text-muted">
                <div className="mb-2.5 text-[26px]">📦</div>
                <h4 className="mb-1.5 text-[15px] text-ink">No packages yet</h4>
                <p className="mx-auto max-w-[46ch] text-[13px] leading-[1.55]">
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Pill tone={live > 0 ? 'ok' : 'mut'}>
                      {live > 0 ? `${live} departures` : 'no departures'}
                    </Pill>
                    <button className={`${BTN_O} ${BTN_SM}`} onClick={() => openEdit(p)}>
                      Edit
                    </button>
                    <button
                      className={`${BTN_O} ${BTN_SM}`}
                      onClick={() => remove(p)}
                      disabled={busy}
                    >
                      Delete
                    </button>
                  </div>
                }
              >
                <div className="grid grid-cols-[2fr_1fr] items-start gap-5 max-[1024px]:grid-cols-1">
                  <Kv
                    rows={[
                      ['Route', p.route.name],
                      ['Duration', p.durationLabel ?? `${p.durationDays} day(s)`],
                      ['Departure ghat', p.departureGhat ?? '—'],
                      ['Return ghat', p.returnGhat ?? '—'],
                      ['Meals', p.meals ?? '—'],
                    ]}
                  />
                  <div className="flex flex-col gap-3">
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
                      <div className="t2" style={{ marginTop: 8, fontSize: 12 }}>
                        Anything not listed here is not included.
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
        title={editing ? 'Edit package' : 'New package'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className={BTN_O} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className={BTN_B} onClick={submit} disabled={busy || !routeId}>
              {busy
                ? editing
                  ? 'Saving…'
                  : 'Creating…'
                : editing
                  ? 'Save changes'
                  : 'Create package'}
            </button>
          </>
        }
      >
        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
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
            <div className={FACILITY_GRID}>
              {MEAL_OPTIONS.map((opt) => (
                <label key={opt} className={FACILITY_OPT}>
                  <input
                    type="checkbox"
                    checked={mealSet.has(opt)}
                    onChange={(e) => toggleMeal(opt, e.target.checked)}
                  />
                  {opt}
                </label>
              ))}
            </div>
            <input
              value={mealExtras}
              onChange={(e) => setMealExtras(e.target.value)}
              placeholder="Other (comma separated) — optional"
              style={{ marginTop: 8 }}
            />
          </Field>

          <Field label="Included (comma separated)">
            <input
              value={included}
              onChange={(e) => setIncluded(e.target.value)}
              placeholder="Guide, life jackets, generator"
            />
            <Note kind="info" style={{ marginTop: 8 }}>
              Anything you don&apos;t list here counts as not included — no need for
              a separate excluded list.
            </Note>
          </Field>
        </form>
      </Drawer>
    </>
  );
}
