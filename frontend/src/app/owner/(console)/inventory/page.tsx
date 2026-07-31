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
} from '@/components/owner/ui';
import { Pill } from '@/components/owner/Pill';
import { Drawer } from '@/components/owner/Drawer';
import { apiErrorMessage, normalizeDigits } from '@/lib/owner/format';

interface Item {
  id: string;
  name: string;
  kind: string;
  unit: string | null;
  reorderThreshold: string | null;
  currentQty: string;
}

export default function OwnerInventoryPage() {
  const { boatId } = useActiveBoat();
  const [addOpen, setAddOpen] = useState(false);
  const [moveFor, setMoveFor] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<'consumable' | 'durable'>('consumable');
  const [unit, setUnit] = useState('');
  const [reorderThreshold, setReorderThreshold] = useState('');
  const [currentQty, setCurrentQty] = useState('');

  const [direction, setDirection] = useState<'in' | 'out' | 'count'>('out');
  const [qty, setQty] = useState('');

  const { data, error: loadError, isLoading, mutate } = useSWR<Item[]>(
    `/houseboats/${boatId}/inventory`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const items = data ?? [];
  const consumables = items.filter((i) => i.kind === 'consumable');
  const durables = items.filter((i) => i.kind === 'durable');

  const isLow = (i: Item): boolean =>
    i.reorderThreshold !== null && Number(i.currentQty) <= Number(i.reorderThreshold);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !name) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/houseboats/${boatId}/inventory`, {
        name,
        kind,
        unit: unit || undefined,
        reorderThreshold: reorderThreshold ? Number(reorderThreshold) : undefined,
        currentQty: currentQty ? Number(currentQty) : undefined,
      });
      setAddOpen(false);
      setName('');
      setUnit('');
      setReorderThreshold('');
      setCurrentQty('');
      await mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not add the item.'));
    } finally {
      setBusy(false);
    }
  }

  async function recordMovement(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !moveFor || !qty) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/houseboats/${boatId}/inventory/${moveFor.id}/movements`, {
        direction,
        qty: Number(normalizeDigits(qty)),
      });
      setMoveFor(null);
      setQty('');
      await mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not record the movement.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="Inventory"
        desc="Consumables warn you when they drop below the reorder level. Durables are counted when you choose — not automatically after every trip."
        actions={
          <button className="btn btn-b" onClick={() => setAddOpen(true)}>
            ＋ Add item
          </button>
        }
      />

      {error ? (
        <Note kind="danger" style={{ marginBottom: 18 }}>
          {error}
        </Note>
      ) : null}

      <Card title="Consumables" sub="reorder alerts" flush style={{ marginBottom: 20 }}>
        <TableWrap minWidth={620}>
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">On hand</th>
              <th className="num">Reorder at</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <AsyncTable
            isLoading={isLoading}
            error={loadError}
            isEmpty={consumables.length === 0}
            onRetry={() => mutate()}
            empty={
              <div className="state">
                <div className="ic">📦</div>
                <h4>No consumables</h4>
                <p>Add rice, gas and fuel so the dashboard can warn you.</p>
              </div>
            }
          >
            <tbody>
              {consumables.map((i) => (
                <tr key={i.id}>
                  <td className="t1">
                    {i.name}
                    {i.unit ? <span className="t2"> ({i.unit})</span> : null}
                  </td>
                  <td className="num">{Number(i.currentQty)}</td>
                  <td className="num">
                    {i.reorderThreshold ? Number(i.reorderThreshold) : '—'}
                  </td>
                  <td>
                    <Pill tone={isLow(i) ? 'danger' : 'ok'}>
                      {isLow(i) ? 'low — reorder' : 'ok'}
                    </Pill>
                  </td>
                  <td>
                    <div className="rowact">
                      <button
                        className="btn btn-sm btn-o"
                        onClick={() => {
                          setMoveFor(i);
                          setDirection('out');
                        }}
                      >
                        Log usage
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </AsyncTable>
        </TableWrap>
      </Card>

      <Card title="Durables" sub="counted on demand" flush>
        <TableWrap minWidth={560}>
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Expected</th>
              <th />
            </tr>
          </thead>
          <AsyncTable
            isLoading={isLoading}
            error={loadError}
            isEmpty={durables.length === 0}
            onRetry={() => mutate()}
            empty={
              <div className="state">
                <div className="ic">🧯</div>
                <h4>No durables</h4>
                <p>Life jackets, plates, bedding — anything you count rather than consume.</p>
              </div>
            }
          >
            <tbody>
              {durables.map((i) => (
                <tr key={i.id}>
                  <td className="t1">
                    {i.name}
                    {i.unit ? <span className="t2"> ({i.unit})</span> : null}
                  </td>
                  <td className="num">{Number(i.currentQty)}</td>
                  <td>
                    <div className="rowact">
                      <button
                        className="btn btn-sm btn-o"
                        onClick={() => {
                          setMoveFor(i);
                          setDirection('count');
                        }}
                      >
                        Run a count
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </AsyncTable>
        </TableWrap>
      </Card>

      <Drawer
        open={addOpen}
        title="Add item"
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <button className="btn btn-o" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-b" onClick={addItem} disabled={busy || !name}>
              {busy ? 'Adding…' : 'Add item'}
            </button>
          </>
        }
      >
        <form onSubmit={addItem} style={{ display: 'grid', gap: 12 }}>
          {error ? <Note kind="danger">{error}</Note> : null}
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Kind">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as 'consumable' | 'durable')}
            >
              <option value="consumable">Consumable</option>
              <option value="durable">Durable</option>
            </select>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Unit">
              <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg" />
            </Field>
            <Field label="Starting quantity">
              <input
                type="number"
                min={0}
                value={currentQty}
                onChange={(e) => setCurrentQty(e.target.value)}
              />
            </Field>
          </div>
          {kind === 'consumable' ? (
            <Field label="Reorder at">
              <input
                type="number"
                min={0}
                value={reorderThreshold}
                onChange={(e) => setReorderThreshold(e.target.value)}
                placeholder="10"
              />
            </Field>
          ) : null}
        </form>
      </Drawer>

      <Drawer
        open={moveFor !== null}
        title={`${direction === 'count' ? 'Count' : 'Movement'} · ${moveFor?.name ?? ''}`}
        onClose={() => setMoveFor(null)}
        footer={
          <>
            <button className="btn btn-o" onClick={() => setMoveFor(null)}>
              Cancel
            </button>
            <button className="btn btn-b" onClick={recordMovement} disabled={busy || !qty}>
              {busy ? 'Saving…' : 'Record'}
            </button>
          </>
        }
      >
        <form onSubmit={recordMovement} style={{ display: 'grid', gap: 12 }}>
          <Field label="Direction">
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'in' | 'out' | 'count')}
            >
              <option value="out">Used / taken out</option>
              <option value="in">Restocked</option>
              <option value="count">Physical count</option>
            </select>
          </Field>
          <Field label={direction === 'count' ? 'Counted quantity' : 'Quantity'}>
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              inputMode="numeric"
              placeholder="৫ or 5"
              required
            />
          </Field>
          {direction === 'count' ? (
            <Note kind="info">
              A count compares what you found against what the system expected. Anything
              missing is recorded as a discrepancy rather than silently corrected.
            </Note>
          ) : null}
        </form>
      </Drawer>
    </>
  );
}
