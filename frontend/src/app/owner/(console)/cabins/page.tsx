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
import {
  BTN_B,
  BTN_O,
  BTN_DANGER,
  BTN_SM,
  FACILITY_GRID,
  FACILITY_OPT,
} from '@/components/owner/styles';
import { Pill } from '@/components/owner/Pill';
import { Drawer } from '@/components/owner/Drawer';
import { CabGrid, type CabTile } from '@/components/owner/CabGrid';
import {
  MediaGallery,
  MediaQueue,
  uploadMediaImage,
} from '@/components/owner/MediaGallery';
import { apiErrorMessage } from '@/lib/owner/format';

const MAX_CABIN_IMAGES = 6;

interface BoatDetail {
  decks: {
    id: string;
    name: string;
    position: number;
    cabins: { id: string; name: string; cabinCategoryId: string; deckId: string }[];
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

type DrawerKind = 'deck' | 'category' | 'cabin';
/** null = closed; id present = editing that row, else creating. */
type DrawerState = { kind: DrawerKind; id?: string } | null;

/**
 * Canonical facility list for the checkbox grid. Anything an owner has stored
 * that isn't in this list round-trips through the "extras" comma box, so no
 * existing data is lost when the UI switched from free-text to checkboxes.
 */
const FACILITY_OPTIONS = [
  'Attached Bath',
  'AC',
  'Balcony',
  'Shared Bath',
  'Ceiling fan',
  'TV',
  'Fridge',
  'Mirror',
  'Swing',
];

/** Split a stored comma string into known-checked + free-text extras. */
function parseFacilities(raw: string | null | undefined) {
  const parts = (raw ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\.$/, ''))
    .filter(Boolean);
  const known = new Set<string>();
  const extras: string[] = [];
  const lookup = new Map(FACILITY_OPTIONS.map((o) => [o.toLowerCase(), o]));
  for (const p of parts) {
    const hit = lookup.get(p.toLowerCase());
    if (hit) known.add(hit);
    else extras.push(p);
  }
  return { known, extras: extras.join(', ') };
}

/** Join checked boxes + extras into a single comma string (deduped). */
function serializeFacilities(checked: Set<string>, extras: string): string {
  const extraList = extras
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const all = [...FACILITY_OPTIONS.filter((o) => checked.has(o)), ...extraList];
  return [...new Set(all)].join(', ');
}

export default function OwnerCabinsPage() {
  const { boatId } = useActiveBoat();
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deckName, setDeckName] = useState('');
  const [catName, setCatName] = useState('');
  const [baseCapacity, setBaseCapacity] = useState('2');
  const [extendedCapacity, setExtendedCapacity] = useState('3');
  const [facilitySet, setFacilitySet] = useState<Set<string>>(new Set());
  const [facilityExtras, setFacilityExtras] = useState('');
  const [cabinName, setCabinName] = useState('');
  const [cabinDeck, setCabinDeck] = useState('');
  const [cabinCategory, setCabinCategory] = useState('');
  // Images queued while creating a cabin (no cabinId exists yet). Uploaded in
  // the background right after the cabin is created.
  const [cabinImages, setCabinImages] = useState<File[]>([]);

  const boat = useSWR<BoatDetail>(`/houseboats/${boatId}/manage`, fetcher, {
    revalidateOnFocus: false,
  });

  const decks = boat.data?.decks ?? [];
  const categories = boat.data?.cabinCategories ?? [];
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  const editing = drawer?.id != null;

  function toggleFacility(name: string, on: boolean) {
    setFacilitySet((prev) => {
      const next = new Set(prev);
      if (on) next.add(name);
      else next.delete(name);
      return next;
    });
  }

  // ── Open drawer in create or edit mode ─────────────────────
  function openDeck(deck?: BoatDetail['decks'][number]) {
    setError(null);
    setDeckName(deck?.name ?? '');
    setDrawer({ kind: 'deck', id: deck?.id });
  }

  function openCategory(cat?: BoatDetail['cabinCategories'][number]) {
    setError(null);
    if (cat) {
      const { known, extras } = parseFacilities(cat.facilities);
      // AC lives in the facility grid now; seed it from the isAc DB flag too.
      if (cat.isAc) known.add('AC');
      setCatName(cat.name);
      setBaseCapacity(String(cat.baseCapacity));
      setExtendedCapacity(cat.extendedCapacity != null ? String(cat.extendedCapacity) : '');
      setFacilitySet(known);
      setFacilityExtras(extras);
    } else {
      setCatName('');
      setBaseCapacity('2');
      setExtendedCapacity('3');
      setFacilitySet(new Set(['AC']));
      setFacilityExtras('');
    }
    setDrawer({ kind: 'category', id: cat?.id });
  }

  function openCabin(cabin?: { id: string; name: string; deckId: string; cabinCategoryId: string }) {
    setError(null);
    setCabinName(cabin?.name ?? '');
    setCabinDeck(cabin?.deckId ?? decks[0]?.id ?? '');
    setCabinCategory(cabin?.cabinCategoryId ?? categories[0]?.id ?? '');
    setCabinImages([]);
    setDrawer({ kind: 'cabin', id: cabin?.id });
  }

  // ── Save (create or edit) ──────────────────────────────────
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !drawer) return;
    setBusy(true);
    setError(null);
    try {
      const base = `/houseboats/${boatId}`;
      if (drawer.kind === 'deck') {
        const body = { name: deckName, position: editing ? undefined : decks.length };
        if (drawer.id) await api.patch(`${base}/decks/${drawer.id}`, body);
        else await api.post(`${base}/decks`, body);
      } else if (drawer.kind === 'category') {
        const facilities = serializeFacilities(facilitySet, facilityExtras);
        const body = {
          name: catName,
          // AC is a facility checkbox now; keep the DB isAc flag in sync with it.
          isAc: facilitySet.has('AC'),
          baseCapacity: Number(baseCapacity),
          extendedCapacity: extendedCapacity ? Number(extendedCapacity) : undefined,
          facilities: facilities || undefined,
        };
        if (drawer.id) await api.patch(`${base}/categories/${drawer.id}`, body);
        else await api.post(`${base}/categories`, body);
      } else {
        const body = {
          deckId: cabinDeck,
          cabinCategoryId: cabinCategory,
          name: cabinName,
        };
        if (drawer.id) {
          await api.patch(`${base}/cabins/${drawer.id}`, body);
        } else {
          const { data: created } = await api.post<{ id: string }>(
            `${base}/cabins`,
            body,
          );
          // Background-upload the queued images — don't block closing the drawer.
          // A failed upload doesn't undo the created cabin; surface it quietly.
          if (cabinImages.length > 0 && created?.id) {
            const queued = cabinImages;
            void (async () => {
              for (const file of queued) {
                try {
                  await uploadMediaImage(boatId, file, created.id);
                } catch {
                  setError('Cabin created, but some images failed to upload.');
                }
              }
              await boat.mutate();
            })();
          }
        }
      }
      setDrawer(null);
      await boat.mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save that.'));
    } finally {
      setBusy(false);
    }
  }

  // ── Delete (guarded server-side; surface conflict messages) ─
  async function remove(kind: DrawerKind, id: string, label: string) {
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    setError(null);
    try {
      const path = kind === 'deck' ? 'decks' : kind === 'category' ? 'categories' : 'cabins';
      await api.delete(`/houseboats/${boatId}/${path}/${id}`);
      await boat.mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not delete that.'));
    }
  }

  return (
    <>
      <PageHead
        title="Decks & cabins"
        desc="The physical boat. A cabin belongs to a deck for layout and to a category for pricing — the category is what a price is set against."
        actions={
          <>
            <button className={BTN_O} onClick={() => openDeck()}>
              ＋ Deck
            </button>
            <button className={BTN_O} onClick={() => openCategory()}>
              ＋ Category
            </button>
            <button
              className={BTN_B}
              onClick={() => openCabin()}
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
        <TableWrap minWidth={720}>
          <thead>
            <tr>
              <th>Category</th>
              <th>AC</th>
              <th>Base capacity</th>
              <th>Extended</th>
              <th>Facilities</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <AsyncTable
            isLoading={boat.isLoading}
            error={boat.error}
            isEmpty={categories.length === 0}
            onRetry={() => boat.mutate()}
            empty={
              <div className="px-6 py-11 text-center text-muted">
                <div className="mb-2.5 text-[26px]">🏷</div>
                <h4 className="mb-1.5 text-[15px] text-ink">No categories</h4>
                <p className="mx-auto max-w-[46ch] text-[13px] leading-[1.55]">
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
                  <td data-label="Base capacity">{c.baseCapacity}</td>
                  <td data-label="Extended">{c.extendedCapacity ?? '—'}</td>
                  <td className="t2" data-label="Facilities">{c.facilities ?? '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button className={`${BTN_O} ${BTN_SM}`} onClick={() => openCategory(c)}>
                        Edit
                      </button>
                      <button
                        className={`${BTN_DANGER} shadow-e1 ${BTN_SM}`}
                        onClick={() => remove('category', c.id, `category “${c.name}”`)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
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
            <div className="px-6 py-11 text-center text-muted">
              <div className="mb-2.5 text-[26px]">🚪</div>
              <h4 className="mb-1.5 text-[15px] text-ink">No decks yet</h4>
              <p className="mx-auto max-w-[46ch] text-[13px] leading-[1.55]">
                Add a deck, then the cabins that sit on it.
              </p>
            </div>
          </Card>
        }
      >
        <div className="grid grid-cols-[2fr_1fr] items-start gap-5 max-[1024px]:grid-cols-1">
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
                actions={
                  <>
                    <button className={`${BTN_O} ${BTN_SM}`} onClick={() => openDeck(deck)}>
                      Edit
                    </button>
                    <button
                      className={`${BTN_DANGER} shadow-e1 ${BTN_SM}`}
                      onClick={() => remove('deck', deck.id, `deck “${deck.name}”`)}
                    >
                      Delete
                    </button>
                  </>
                }
              >
                {tiles.length > 0 ? (
                  <CabGrid
                    cabins={tiles}
                    onEdit={(t) => {
                      const cab = deck.cabins.find((x) => x.id === t.id);
                      if (cab) openCabin(cab);
                    }}
                    onDelete={(t) => remove('cabin', t.id, `cabin “${t.name}”`)}
                  />
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
          drawer?.kind === 'deck'
            ? editing
              ? 'Edit deck'
              : 'Add deck'
            : drawer?.kind === 'category'
              ? editing
                ? 'Edit category'
                : 'Add category'
              : editing
                ? 'Edit cabin'
                : 'Add cabin'
        }
        onClose={() => setDrawer(null)}
        footer={
          <>
            <button className={BTN_O} onClick={() => setDrawer(null)}>
              Cancel
            </button>
            <button className={BTN_B} onClick={submit} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          {error ? <Note kind="danger">{error}</Note> : null}

          {drawer?.kind === 'deck' ? (
            <Field label="Deck name">
              <input
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                placeholder="Upper Deck"
                required
              />
            </Field>
          ) : null}

          {drawer?.kind === 'category' ? (
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
                <div className={FACILITY_GRID}>
                  {FACILITY_OPTIONS.map((opt) => (
                    <label key={opt} className={FACILITY_OPT}>
                      <input
                        type="checkbox"
                        checked={facilitySet.has(opt)}
                        onChange={(e) => toggleFacility(opt, e.target.checked)}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="More facilities (comma separated)">
                <input
                  value={facilityExtras}
                  onChange={(e) => setFacilityExtras(e.target.value)}
                  placeholder="sea-facing deck, private butler"
                />
              </Field>
              <Note kind="info">
                Extended capacity is the overflow a group may squeeze into — it only
                applies to group bookings, not ordinary cabin sales.
              </Note>
            </>
          ) : null}

          {drawer?.kind === 'cabin' ? (
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

              <Field label={`Cabin photos (up to ${MAX_CABIN_IMAGES})`}>
                {drawer.id ? (
                  <MediaGallery
                    houseboatId={boatId}
                    cabinId={drawer.id}
                    max={MAX_CABIN_IMAGES}
                  />
                ) : (
                  <MediaQueue
                    files={cabinImages}
                    onChange={setCabinImages}
                    max={MAX_CABIN_IMAGES}
                  />
                )}
              </Field>
            </>
          ) : null}
        </form>
      </Drawer>
    </>
  );
}
