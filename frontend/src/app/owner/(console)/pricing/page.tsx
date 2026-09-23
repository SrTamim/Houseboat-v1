'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import {
  PageHead,
  Card,
  FilterBar,
  Seg,
  Field,
  Select,
  Note,
  TableWrap,
  AsyncTable,
  AsyncBlock,
} from '@/components/owner/ui';
import { BTN_B, BTN_O, BTN_SM } from '@/components/owner/buttons';
import { Drawer } from '@/components/owner/Drawer';
import { money, apiErrorMessage } from '@/lib/owner/format';

type PriceType = 'general' | 'weekend' | 'holiday';

const TYPES: { value: PriceType; label: string }[] = [
  { value: 'general', label: 'General day' },
  { value: 'weekend', label: 'Weekend' },
  { value: 'holiday', label: 'Holiday' },
];

interface Route {
  id: string;
  name: string;
  region: string | null;
}

interface RoutePricingProfile {
  id: string;
  priceType: PriceType | null;
  name: string;
  isDefault: boolean;
  dates: string[];
  rules: {
    id: string;
    cabinCategoryId: string;
    occupancy: number;
    pricePerPerson: string;
  }[];
}

interface GroupBand {
  id: string;
  minPeople: number;
  maxPeople: number;
  totalPrice: string;
}

interface BoatDetail {
  cabinCategories: {
    id: string;
    name: string;
    baseCapacity: number;
    extendedCapacity: number | null;
  }[];
}

/** Occupancy columns the matrix shows — 1 up to the largest extended capacity. */
function occupancyColumns(categories: BoatDetail['cabinCategories']): number[] {
  const max = categories.reduce(
    (m, c) => Math.max(m, c.extendedCapacity ?? c.baseCapacity),
    0,
  );
  return Array.from({ length: Math.max(max, 1) }, (_, i) => i + 1);
}

const cellKey = (categoryId: string, occ: number) => `${categoryId}:${occ}`;

const DAY_MS = 86_400_000;
const MAX_DATES = 400; // matches backend ArrayMaxSize

/** Inclusive list of ISO (yyyy-mm-dd) days from start to end. */
function expandRange(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  let t = Date.parse(`${startIso}T00:00:00Z`);
  const end = Date.parse(`${endIso}T00:00:00Z`);
  if (Number.isNaN(t) || Number.isNaN(end) || end < t) return out;
  while (t <= end && out.length < MAX_DATES) {
    out.push(new Date(t).toISOString().slice(0, 10));
    t += DAY_MS;
  }
  return out;
}

/** Fold a sorted ISO-day list into consecutive-day ranges for display. */
function toRanges(sorted: string[]): { start: string; end: string }[] {
  const ranges: { start: string; end: string }[] = [];
  for (const d of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && Date.parse(`${d}T00:00:00Z`) === Date.parse(`${last.end}T00:00:00Z`) + DAY_MS) {
      last.end = d;
    } else {
      ranges.push({ start: d, end: d });
    }
  }
  return ranges;
}

export default function OwnerPricingPage() {
  const { boatId } = useActiveBoat();

  const [routeId, setRouteId] = useState('');
  const [activeType, setActiveType] = useState<PriceType>('general');

  // Draft price cells keyed by `${categoryId}:${occupancy}` for the active type.
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [draftDates, setDraftDates] = useState<string[]>([]);
  const [dateMode, setDateMode] = useState<'single' | 'range'>('single');
  const [newDate, setNewDate] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Group-band drawer state (unchanged behavior).
  const [bandOpen, setBandOpen] = useState(false);
  const [minPeople, setMinPeople] = useState('10');
  const [maxPeople, setMaxPeople] = useState('16');
  const [totalPrice, setTotalPrice] = useState('');
  const [bandBusy, setBandBusy] = useState(false);
  const [bandError, setBandError] = useState<string | null>(null);

  const routes = useSWR<Route[]>('/routes', fetcher, { revalidateOnFocus: false });
  const boat = useSWR<BoatDetail>(`/houseboats/${boatId}/manage`, fetcher, {
    revalidateOnFocus: false,
  });
  const bands = useSWR<GroupBand[]>(`/houseboats/${boatId}/group-bands-list`, fetcher, {
    revalidateOnFocus: false,
  });

  // Default the route selector to the first available route.
  useEffect(() => {
    if (!routeId && routes.data && routes.data.length > 0) {
      setRouteId(routes.data[0].id);
    }
  }, [routes.data, routeId]);

  const pricing = useSWR<RoutePricingProfile[]>(
    boatId && routeId
      ? `/houseboats/${boatId}/route-pricing?routeId=${routeId}`
      : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const categories = useMemo(
    () => boat.data?.cabinCategories ?? [],
    [boat.data?.cabinCategories],
  );
  const columns = useMemo(() => occupancyColumns(categories), [categories]);

  const current = useMemo(
    () => pricing.data?.find((p) => p.priceType === activeType),
    [pricing.data, activeType],
  );

  // Load the active type's saved prices into the editable draft whenever the
  // route, type, or fetched data changes.
  useEffect(() => {
    if (!current) {
      setDraft({});
      setDraftDates([]);
      return;
    }
    const next: Record<string, string> = {};
    for (const r of current.rules) {
      next[cellKey(r.cabinCategoryId, r.occupancy)] = String(Number(r.pricePerPerson));
    }
    setDraft(next);
    setDraftDates(current.dates.map((d) => d.slice(0, 10)));
    setSaved(false);
    setError(null);
  }, [current]);

  function setCell(categoryId: string, occ: number, value: string) {
    setSaved(false);
    setDraft((d) => ({ ...d, [cellKey(categoryId, occ)]: value }));
  }

  function mergeDates(days: string[]) {
    if (days.length === 0) return;
    setDraftDates((prev) => {
      const set = new Set(prev);
      for (const d of days) set.add(d);
      return [...set].sort();
    });
    setSaved(false);
  }
  function addSingle() {
    if (!newDate) return;
    mergeDates([newDate]);
    setNewDate('');
  }
  function addRange() {
    if (!rangeStart || !rangeEnd) return;
    mergeDates(expandRange(rangeStart, rangeEnd));
    setRangeStart('');
    setRangeEnd('');
  }
  /** Remove a whole consecutive run (one displayed chip). */
  function removeRange(start: string, end: string) {
    const days = new Set(expandRange(start, end));
    setDraftDates((prev) => prev.filter((x) => !days.has(x)));
    setSaved(false);
  }

  // A price is missing when a category has no draft value for an occupancy it holds.
  const missing = useMemo(() => {
    let n = 0;
    for (const c of categories) {
      const cap = c.extendedCapacity ?? c.baseCapacity;
      for (let occ = 1; occ <= cap; occ++) {
        const v = draft[cellKey(c.id, occ)];
        if (v === undefined || v === '') n++;
      }
    }
    return n;
  }, [draft, categories]);

  async function save() {
    if (busy || !routeId) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const rules: {
        cabinCategoryId: string;
        occupancy: number;
        pricePerPerson: number;
      }[] = [];
      for (const c of categories) {
        const cap = c.extendedCapacity ?? c.baseCapacity;
        for (let occ = 1; occ <= cap; occ++) {
          const v = draft[cellKey(c.id, occ)];
          if (v === undefined || v === '') continue;
          rules.push({
            cabinCategoryId: c.id,
            occupancy: occ,
            pricePerPerson: Number(v),
          });
        }
      }
      await api.put(`/houseboats/${boatId}/route-pricing`, {
        routeId,
        priceType: activeType,
        // Only holiday carries dates; weekend is auto Fri/Sat, general is fallback.
        dates: activeType === 'holiday' ? draftDates : [],
        rules,
      });
      await pricing.mutate();
      setSaved(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the prices.'));
    } finally {
      setBusy(false);
    }
  }

  async function addBand(e: React.FormEvent) {
    e.preventDefault();
    if (bandBusy || !totalPrice) return;
    setBandBusy(true);
    setBandError(null);
    try {
      await api.post(`/houseboats/${boatId}/group-bands`, {
        minPeople: Number(minPeople),
        maxPeople: Number(maxPeople),
        totalPrice: Number(totalPrice),
      });
      setBandOpen(false);
      setTotalPrice('');
      await bands.mutate();
    } catch (err) {
      setBandError(apiErrorMessage(err, 'Could not add the band.'));
    } finally {
      setBandBusy(false);
    }
  }

  const routeOptions = (routes.data ?? []).map((r) => ({
    value: r.id,
    label: r.region ? `${r.name} · ${r.region}` : r.name,
  }));

  return (
    <>
      <PageHead
        title="Pricing"
        desc="Pick a route, then set per-person prices for each cabin category and party size. Each route keeps its own General / Weekend / Holiday tables — switching routes never loses what you saved."
        descHideOnMobile
      />

      <FilterBar>
        <AsyncBlock
          isLoading={routes.isLoading}
          error={routes.error}
          isEmpty={(routes.data?.length ?? 0) === 0}
          onRetry={() => routes.mutate()}
          empty={<Note kind="warn">No routes available.</Note>}
        >
          <Field label="Route">
            <Select
              options={routeOptions}
              value={routeId}
              onChange={setRouteId}
              ariaLabel="Route"
            />
          </Field>
        </AsyncBlock>
        <Seg
          options={TYPES.map((t) => ({ value: t.value, label: t.label }))}
          value={activeType}
          onChange={(v) => setActiveType(v as PriceType)}
        />
      </FilterBar>

      {missing > 0 ? (
        <Note kind="warn" style={{ marginTop: 14, marginBottom: 4 }}>
          {missing} price{missing > 1 ? 's are' : ' is'} missing from this table. A cabin
          with no price for a given party size cannot be booked at that size.
        </Note>
      ) : null}
      {error ? (
        <Note kind="danger" style={{ marginTop: 14, marginBottom: 4 }}>
          {error}
        </Note>
      ) : null}
      {saved ? (
        <Note kind="ok" style={{ marginTop: 14, marginBottom: 4 }}>
          Prices saved.
        </Note>
      ) : null}

      {activeType === 'weekend' ? (
        <Note kind="info" style={{ marginTop: 16 }}>
          Weekend prices apply automatically every Friday &amp; Saturday. No dates to set —
          just fill in the table below.
        </Note>
      ) : null}

      {activeType === 'holiday' ? (
        <Card
          title="Holiday dates"
          sub="Eid, public holidays — the exact days this price applies. Add a single day or a range."
          style={{ marginTop: 16 }}
          actions={
            <Seg
              options={[
                { value: 'single', label: 'Single day' },
                { value: 'range', label: 'Date range' },
              ]}
              value={dateMode}
              onChange={(v) => setDateMode(v as 'single' | 'range')}
            />
          }
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
              {dateMode === 'single' ? (
                <>
                  <Field label="Date">
                    <input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                    />
                  </Field>
                  <button
                    type="button"
                    className={`${BTN_O} ${BTN_SM}`}
                    onClick={addSingle}
                    disabled={!newDate}
                  >
                    ＋ Add day
                  </button>
                </>
              ) : (
                <>
                  <Field label="From">
                    <input
                      type="date"
                      value={rangeStart}
                      onChange={(e) => setRangeStart(e.target.value)}
                    />
                  </Field>
                  <Field label="To">
                    <input
                      type="date"
                      value={rangeEnd}
                      min={rangeStart || undefined}
                      onChange={(e) => setRangeEnd(e.target.value)}
                    />
                  </Field>
                  <button
                    type="button"
                    className={`${BTN_O} ${BTN_SM}`}
                    onClick={addRange}
                    disabled={!rangeStart || !rangeEnd || rangeEnd < rangeStart}
                  >
                    ＋ Add range
                  </button>
                </>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {draftDates.length === 0 ? (
                <span className="t2">
                  No holiday dates yet — add the days this price applies to.
                </span>
              ) : (
                toRanges(draftDates).map((r) => (
                  <span
                    key={`${r.start}:${r.end}`}
                    className="tag"
                    style={{ display: 'inline-flex', gap: 6 }}
                  >
                    {r.start === r.end ? r.start : `${r.start} – ${r.end}`}
                    <button
                      type="button"
                      className={`${BTN_O} ${BTN_SM}`}
                      style={{ padding: '0 6px' }}
                      onClick={() => removeRange(r.start, r.end)}
                      aria-label={`Remove ${r.start}${r.end !== r.start ? ` to ${r.end}` : ''}`}
                    >
                      ✕
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        </Card>
      ) : null}

      <Card
        title={`${TYPES.find((t) => t.value === activeType)?.label} · price per person`}
        sub="by cabin category and party size"
        flush
        style={{ marginTop: 16 }}
        actions={
          <button className={`${BTN_B} ${BTN_SM}`} onClick={save} disabled={busy || !routeId}>
            {busy ? 'Saving…' : 'Save prices'}
          </button>
        }
      >
        <TableWrap minWidth={640}>
          <thead>
            <tr>
              <th>Cabin category</th>
              {columns.map((c) => (
                <th key={c} className="num">
                  {c} {c === 1 ? 'person' : 'people'}
                </th>
              ))}
            </tr>
          </thead>
          <AsyncTable
            isLoading={boat.isLoading || pricing.isLoading}
            error={boat.error ?? pricing.error}
            isEmpty={categories.length === 0}
            onRetry={() => boat.mutate()}
            empty={
              <div className="px-6 py-11 text-center text-muted">
                <div className="mb-2.5 text-[26px]">🚪</div>
                <h4 className="mb-1.5 text-[15px] text-ink">No cabin categories</h4>
                <p className="mx-auto max-w-[46ch] text-[13px] leading-[1.55]">
                  Add categories from Decks &amp; cabins before setting prices.
                </p>
              </div>
            }
          >
            <tbody>
              {categories.map((cat) => {
                const cap = cat.extendedCapacity ?? cat.baseCapacity;
                return (
                  <tr key={cat.id}>
                    <td>
                      <div className="t1">{cat.name}</div>
                      <div className="t2">
                        base {cat.baseCapacity}
                        {cat.extendedCapacity ? ` · ext ${cat.extendedCapacity}` : ''}
                      </div>
                    </td>
                    {columns.map((occ) => {
                      if (occ > cap) {
                        return (
                          <td key={occ} className="num t2">
                            —
                          </td>
                        );
                      }
                      return (
                        <td key={occ} className="num">
                          {/* The occupancy count lives in the <th>, which the
                              mobile card-stack hides — so surface it inline as a
                              field label ≤1024px. Desktop keeps the column head. */}
                          <span className="hidden max-[1024px]:block mb-1 text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
                            {occ} {occ === 1 ? 'person' : 'people'}
                          </span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            inputMode="decimal"
                            value={draft[cellKey(cat.id, occ)] ?? ''}
                            onChange={(e) => setCell(cat.id, occ, e.target.value)}
                            placeholder="—"
                            className="max-[1024px]:!w-full max-[1024px]:!text-left"
                            style={{ width: 90, textAlign: 'right' }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </AsyncTable>
        </TableWrap>
      </Card>

      <Card
        title="Group price bands"
        sub="full-boat buyout"
        flush
        style={{ marginTop: 20 }}
        actions={
          <button className={`${BTN_B} ${BTN_SM}`} onClick={() => setBandOpen(true)}>
            ＋ Add band
          </button>
        }
      >
        <TableWrap minWidth={480}>
          <thead>
            <tr>
              <th>Band</th>
              <th className="num">Total price</th>
            </tr>
          </thead>
          <AsyncTable
            isLoading={bands.isLoading}
            error={bands.error}
            isEmpty={(bands.data?.length ?? 0) === 0}
            onRetry={() => bands.mutate()}
            empty={
              <div className="px-6 py-11 text-center text-muted">
                <div className="mb-2.5 text-[26px]">৳</div>
                <h4 className="mb-1.5 text-[15px] text-ink">No group bands</h4>
                <p className="mx-auto max-w-[46ch] text-[13px] leading-[1.55]">
                  A band is one price for the whole boat at a headcount range — what a
                  group quote is measured against.
                </p>
              </div>
            }
          >
            <tbody>
              {bands.data?.map((b) => (
                <tr key={b.id}>
                  <td className="t1">
                    {b.minPeople} – {b.maxPeople} people
                  </td>
                  <td className="num" data-label="Total price">{money(b.totalPrice)}</td>
                </tr>
              ))}
            </tbody>
          </AsyncTable>
        </TableWrap>
      </Card>

      <Drawer
        open={bandOpen}
        title="Add group band"
        onClose={() => setBandOpen(false)}
        footer={
          <>
            <button className={BTN_O} onClick={() => setBandOpen(false)}>
              Cancel
            </button>
            <button
              className={BTN_B}
              onClick={addBand}
              disabled={bandBusy || !totalPrice}
            >
              {bandBusy ? 'Adding…' : 'Add band'}
            </button>
          </>
        }
      >
        <form onSubmit={addBand} style={{ display: 'grid', gap: 12 }}>
          {bandError ? <Note kind="danger">{bandError}</Note> : null}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Min people">
              <input
                type="number"
                min={1}
                value={minPeople}
                onChange={(e) => setMinPeople(e.target.value)}
                required
              />
            </Field>
            <Field label="Max people">
              <input
                type="number"
                min={1}
                value={maxPeople}
                onChange={(e) => setMaxPeople(e.target.value)}
                required
              />
            </Field>
          </div>
          <Field label="Total price (৳)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={totalPrice}
              onChange={(e) => setTotalPrice(e.target.value)}
              placeholder="150000"
              required
            />
          </Field>
          <Note kind="info">
            The customer picks a band and types their headcount. The total is for the whole
            boat, not per person.
          </Note>
        </form>
      </Drawer>
    </>
  );
}
