'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import {
  PageHead,
  Card,
  FilterBar,
  Seg,
  Field,
  Note,
  TableWrap,
  AsyncTable,
  AsyncBlock,
} from '@/components/owner/ui';
import { Drawer } from '@/components/owner/Drawer';
import { money, apiErrorMessage } from '@/lib/owner/format';

interface PricingProfile {
  id: string;
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

export default function OwnerPricingPage() {
  const { boatId } = useActiveBoat();
  const [activeProfile, setActiveProfile] = useState('');
  const [bandOpen, setBandOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [minPeople, setMinPeople] = useState('10');
  const [maxPeople, setMaxPeople] = useState('16');
  const [totalPrice, setTotalPrice] = useState('');

  const profiles = useSWR<PricingProfile[]>(
    `/houseboats/${boatId}/pricing-profiles`,
    fetcher,
    { revalidateOnFocus: false },
  );
  const bands = useSWR<GroupBand[]>(`/houseboats/${boatId}/group-bands`, fetcher, {
    revalidateOnFocus: false,
  });
  const boat = useSWR<BoatDetail>(`/houseboats/${boatId}/manage`, fetcher, {
    revalidateOnFocus: false,
  });

  const list = profiles.data ?? [];
  const currentId = activeProfile || list.find((p) => p.isDefault)?.id || list[0]?.id || '';
  const current = list.find((p) => p.id === currentId);
  // Memoised because `?? []` is a new array reference every render, which would
  // otherwise invalidate the two memos below on each pass.
  const categories = useMemo(
    () => boat.data?.cabinCategories ?? [],
    [boat.data?.cabinCategories],
  );
  const columns = useMemo(() => occupancyColumns(categories), [categories]);

  // A price is missing when a category has no rule for an occupancy it can hold.
  const missing = useMemo(() => {
    if (!current) return 0;
    let n = 0;
    for (const c of categories) {
      const cap = c.extendedCapacity ?? c.baseCapacity;
      for (let occ = 1; occ <= cap; occ++) {
        const has = current.rules.some(
          (r) => r.cabinCategoryId === c.id && r.occupancy === occ,
        );
        if (!has) n++;
      }
    }
    return n;
  }, [current, categories]);

  async function addBand(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !totalPrice) return;
    setBusy(true);
    setError(null);
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
      setError(apiErrorMessage(err, 'Could not add the band.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="Pricing"
        desc="Each profile owns a full, independent price table — a weekend is not a multiplier on a weekday. Price is per person and varies by how many share the cabin."
      />

      {missing > 0 ? (
        <Note kind="warn" style={{ marginBottom: 18 }}>
          {missing} price{missing > 1 ? 's are' : ' is'} missing from this profile. A cabin
          with no price for a given party size cannot be booked at that size.
        </Note>
      ) : null}

      <FilterBar>
        <AsyncBlock
          isLoading={profiles.isLoading}
          error={profiles.error}
          isEmpty={list.length === 0}
          onRetry={() => profiles.mutate()}
          empty={<Note kind="warn">No pricing profiles yet.</Note>}
        >
          <Seg
            options={list.map((p) => ({
              value: p.id,
              label: p.isDefault ? `${p.name} (default)` : p.name,
            }))}
            value={currentId}
            onChange={setActiveProfile}
          />
        </AsyncBlock>
        {current ? (
          <span className="tag">
            {current.isDefault
              ? 'applies to every date without a special profile'
              : `${current.dates.length} dates`}
          </span>
        ) : null}
      </FilterBar>

      <Card
        title={current ? `${current.name} · price per person` : 'Price table'}
        sub="by cabin category and party size"
        flush
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
            isLoading={boat.isLoading || profiles.isLoading}
            error={boat.error ?? profiles.error}
            isEmpty={categories.length === 0}
            onRetry={() => boat.mutate()}
            empty={
              <div className="state">
                <div className="ic">🚪</div>
                <h4>No cabin categories</h4>
                <p>Add categories from Decks &amp; cabins before setting prices.</p>
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
                      const rule = current?.rules.find(
                        (r) => r.cabinCategoryId === cat.id && r.occupancy === occ,
                      );
                      return (
                        <td
                          key={occ}
                          className="num"
                          style={rule ? undefined : { color: 'var(--warn)' }}
                        >
                          {rule ? money(rule.pricePerPerson) : 'not set'}
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
          <button className="btn btn-sm btn-b" onClick={() => setBandOpen(true)}>
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
              <div className="state">
                <div className="ic">৳</div>
                <h4>No group bands</h4>
                <p>
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
                  <td className="num">{money(b.totalPrice)}</td>
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
            <button className="btn btn-o" onClick={() => setBandOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-b" onClick={addBand} disabled={busy || !totalPrice}>
              {busy ? 'Adding…' : 'Add band'}
            </button>
          </>
        }
      >
        <form onSubmit={addBand} style={{ display: 'grid', gap: 12 }}>
          {error ? <Note kind="danger">{error}</Note> : null}
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
