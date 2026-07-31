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
  TableWrap,
  AsyncTable,
  AsyncBlock,
} from '@/components/owner/ui';
import { Pill } from '@/components/owner/Pill';
import { Drawer } from '@/components/owner/Drawer';
import { CabGrid, type CabTile } from '@/components/owner/CabGrid';
import { apiErrorMessage } from '@/lib/owner/format';

interface BoatDetail {
  decks: {
    id: string;
    name: string;
    position: number;
    cabins: { id: string; name: string; cabinCategoryId: string }[];
  }[];
  cabinCategories: {
    id: string;
    name: string;
    isAc: boolean;
    baseCapacity: number;
    extendedCapacity: number | null;
    facilities: string | null;
  }[];
}

type DrawerKind = 'deck' | 'category' | 'cabin' | null;

export default function OwnerCabinsPage() {
  const { boatId } = useActiveBoat();
  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deckName, setDeckName] = useState('');
  const [catName, setCatName] = useState('');
  const [isAc, setIsAc] = useState(true);
  const [baseCapacity, setBaseCapacity] = useState('2');
  const [extendedCapacity, setExtendedCapacity] = useState('3');
  const [facilities, setFacilities] = useState('');
  const [cabinName, setCabinName] = useState('');
  const [cabinDeck, setCabinDeck] = useState('');
  const [cabinCategory, setCabinCategory] = useState('');

  const boat = useSWR<BoatDetail>(`/houseboats/${boatId}/manage`, fetcher, {
    revalidateOnFocus: false,
  });

  const decks = boat.data?.decks ?? [];
  const categories = boat.data?.cabinCategories ?? [];
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (drawer === 'deck') {
        await api.post(`/houseboats/${boatId}/decks`, {
          name: deckName,
          position: decks.length,
        });
        setDeckName('');
      } else if (drawer === 'category') {
        await api.post(`/houseboats/${boatId}/categories`, {
          name: catName,
          isAc,
          baseCapacity: Number(baseCapacity),
          extendedCapacity: extendedCapacity ? Number(extendedCapacity) : undefined,
          facilities: facilities || undefined,
        });
        setCatName('');
        setFacilities('');
      } else if (drawer === 'cabin') {
        await api.post(`/houseboats/${boatId}/cabins`, {
          deckId: cabinDeck,
          cabinCategoryId: cabinCategory,
          name: cabinName,
        });
        setCabinName('');
      }
      setDrawer(null);
      await boat.mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save that.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="Decks & cabins"
        desc="The physical boat. A cabin belongs to a deck for layout and to a category for pricing — the category is what a price is set against."
        actions={
          <>
            <button className="btn btn-o" onClick={() => setDrawer('deck')}>
              ＋ Deck
            </button>
            <button className="btn btn-o" onClick={() => setDrawer('category')}>
              ＋ Category
            </button>
            <button
              className="btn btn-b"
              onClick={() => {
                setCabinDeck(decks[0]?.id ?? '');
                setCabinCategory(categories[0]?.id ?? '');
                setDrawer('cabin');
              }}
              disabled={decks.length === 0 || categories.length === 0}
            >
              ＋ Cabin
            </button>
          </>
        }
      />

      {error ? (
        <Note kind="danger" style={{ marginBottom: 18 }}>
          {error}
        </Note>
      ) : null}

      <Card title="Cabin categories" sub="what pricing is set against" flush style={{ marginBottom: 20 }}>
        <TableWrap minWidth={640}>
          <thead>
            <tr>
              <th>Category</th>
              <th>AC</th>
              <th>Base capacity</th>
              <th>Extended</th>
              <th>Facilities</th>
            </tr>
          </thead>
          <AsyncTable
            isLoading={boat.isLoading}
            error={boat.error}
            isEmpty={categories.length === 0}
            onRetry={() => boat.mutate()}
            empty={
              <div className="state">
                <div className="ic">🏷</div>
                <h4>No categories</h4>
                <p>
                  Add one before adding cabins — every cabin needs a category so it can be
                  priced.
                </p>
              </div>
            }
          >
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td className="t1">{c.name}</td>
                  <td>
                    <Pill tone={c.isAc ? 'blue' : 'mut'}>{c.isAc ? 'AC' : 'non-AC'}</Pill>
                  </td>
                  <td>{c.baseCapacity}</td>
                  <td>{c.extendedCapacity ?? '—'}</td>
                  <td className="t2">{c.facilities ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </AsyncTable>
        </TableWrap>
      </Card>

      <AsyncBlock
        isLoading={boat.isLoading}
        error={boat.error}
        isEmpty={decks.length === 0}
        onRetry={() => boat.mutate()}
        empty={
          <Card>
            <div className="state">
              <div className="ic">🚪</div>
              <h4>No decks yet</h4>
              <p>Add a deck, then the cabins that sit on it.</p>
            </div>
          </Card>
        }
      >
        <div className="grid-2">
          {decks.map((deck) => {
            const tiles: CabTile[] = deck.cabins.map((c) => ({
              id: c.id,
              name: c.name,
              caption: categoryName.get(c.cabinCategoryId) ?? null,
              state: 'free',
              statusLabel: '',
            }));
            return (
              <Card
                key={deck.id}
                title={deck.name}
                sub={`${deck.cabins.length} cabins`}
              >
                {tiles.length > 0 ? (
                  <CabGrid cabins={tiles} />
                ) : (
                  <Note kind="info">No cabins on this deck yet.</Note>
                )}
              </Card>
            );
          })}
        </div>
      </AsyncBlock>

      <Drawer
        open={drawer !== null}
        title={
          drawer === 'deck' ? 'Add deck' : drawer === 'category' ? 'Add category' : 'Add cabin'
        }
        onClose={() => setDrawer(null)}
        footer={
          <>
            <button className="btn btn-o" onClick={() => setDrawer(null)}>
              Cancel
            </button>
            <button className="btn btn-b" onClick={submit} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          {error ? <Note kind="danger">{error}</Note> : null}

          {drawer === 'deck' ? (
            <Field label="Deck name">
              <input
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                placeholder="Upper Deck"
                required
              />
            </Field>
          ) : null}

          {drawer === 'category' ? (
            <>
              <Field label="Category name">
                <input
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="Luxury AC"
                  required
                />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Base capacity">
                  <input
                    type="number"
                    min={1}
                    value={baseCapacity}
                    onChange={(e) => setBaseCapacity(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Extended capacity">
                  <input
                    type="number"
                    min={1}
                    value={extendedCapacity}
                    onChange={(e) => setExtendedCapacity(e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Facilities">
                <input
                  value={facilities}
                  onChange={(e) => setFacilities(e.target.value)}
                  placeholder="AC, attached bath, balcony view"
                />
              </Field>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={isAc} onChange={(e) => setIsAc(e.target.checked)} />
                Air conditioned
              </label>
              <Note kind="info">
                Extended capacity is the overflow a group may squeeze into — it only
                applies to group bookings, not ordinary cabin sales.
              </Note>
            </>
          ) : null}

          {drawer === 'cabin' ? (
            <>
              <Field label="Cabin name or number">
                <input
                  value={cabinName}
                  onChange={(e) => setCabinName(e.target.value)}
                  placeholder="101"
                  required
                />
              </Field>
              <Field label="Deck">
                <select value={cabinDeck} onChange={(e) => setCabinDeck(e.target.value)} required>
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Category">
                <select
                  value={cabinCategory}
                  onChange={(e) => setCabinCategory(e.target.value)}
                  required
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          ) : null}
        </form>
      </Drawer>
    </>
  );
}
