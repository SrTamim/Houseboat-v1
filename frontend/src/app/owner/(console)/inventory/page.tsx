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
  EmptyState,
} from '@/components/owner/ui';
import { BTN_B, BTN_O, BTN_SM } from '@/components/owner/buttons';
import { Pill } from '@/components/owner/Pill';
import { Drawer } from '@/components/owner/Drawer';
import { apiErrorMessage, normalizeDigits } from '@/lib/owner/format';
import { submitOrQueue, isOfflineUnavailable } from '@/lib/owner/submit-or-queue';

interface LastCount {
  countedQty: string;
  expectedQty: string | null;
  discrepancy: string | null;
  at: string;
}

interface Item {
  id: string;
  name: string;
  kind: string;
  unit: string | null;
  reorderThreshold: string | null;
  currentQty: string;
  lastCount?: LastCount;
}

export default function OwnerInventoryPage() {
  const { boatId } = useActiveBoat();
  const [addOpen, setAddOpen] = useState(false);
  const [moveFor, setMoveFor] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOffline, setSavedOffline] = useState(false);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<'consumable' | 'durable'>('consumable');
  const [unit, setUnit] = useState('');
  const [reorderThreshold, setReorderThreshold] = useState('');
  const [currentQty, setCurrentQty] = useState('');

  const [direction, setDirection] = useState<'in' | 'out' | 'count'>('out');
  const [qty, setQty] = useState('');
  const [countResult, setCountResult] = useState<{
    discrepancy: number;
    unit: string | null;
  } | null>(null);

  const [consumableSearch, setConsumableSearch] = useState('');
  const [durableSearch, setDurableSearch] = useState('');

  const { data, error: loadError, isLoading, mutate } = useSWR<Item[]>(
    `/houseboats/${boatId}/inventory`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const items = data ?? [];
  const matches = (i: Item, q: string): boolean => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return (
      i.name.toLowerCase().includes(t) ||
      (i.unit ?? '').toLowerCase().includes(t)
    );
  };
  const consumables = items.filter(
    (i) => i.kind === 'consumable' && matches(i, consumableSearch),
  );
  const durables = items.filter(
    (i) => i.kind === 'durable' && matches(i, durableSearch),
  );

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
    setSavedOffline(false);
    try {
      const qtyNum = Number(normalizeDigits(qty));
      const res = await submitOrQueue(
        () =>
          api.post(`/houseboats/${boatId}/inventory/${moveFor.id}/movements`, {
            direction,
            qty: qtyNum,
          }),
        {
          houseboatId: boatId,
          action: 'stock_movement',
          // itemId lives only in the URL online — replay needs it in the payload.
          payload: { itemId: moveFor.id, direction, qty: qtyNum },
        },
      );
      setQty('');
      if (res.status === 'queued') {
        // No server response offline, so a count can't show its discrepancy yet.
        // Close the drawer and let the "saved offline" note stand in for it.
        setMoveFor(null);
        setSavedOffline(true);
      } else if (direction === 'count') {
        // Keep the drawer open to show what the count found.
        const discrepancy = Number(res.data.data?.discrepancy ?? 0);
        setCountResult({ discrepancy, unit: moveFor.unit });
        await mutate();
      } else {
        setMoveFor(null);
        await mutate();
      }
    } catch (err) {
      setError(
        isOfflineUnavailable(err)
          ? (err as Error).message
          : apiErrorMessage(err, 'Could not record the movement.'),
      );
    } finally {
      setBusy(false);
    }
  }

  function closeMovement() {
    setMoveFor(null);
    setCountResult(null);
    setQty('');
  }

  function renderLastCount(lc?: LastCount) {
    if (!lc) return <span className="t2">—</span>;
    const d = Number(lc.discrepancy ?? 0);
    const tone = d > 0 ? 'danger' : d < 0 ? 'warn' : 'ok';
    const label =
      d > 0 ? `${d} short` : d < 0 ? `${Math.abs(d)} over` : 'matched';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="t1">{Number(lc.countedQty)}</span>
        <Pill tone={tone}>{label}</Pill>
        <span className="t2">{new Date(lc.at).toLocaleDateString()}</span>
      </div>
    );
  }

  return (
    <>
      <PageHead
        title="Inventory"
        desc="Consumables warn you when they drop below the reorder level. Durables are counted when you choose — not automatically after every trip."
        actions={
          <button className={BTN_B} onClick={() => setAddOpen(true)}>
            ＋ Add item
          </button>
        }
      />

      {error ? (
        <Note kind="danger" style={{ marginBottom: 18 }}>
          {error}
        </Note>
      ) : null}

      {savedOffline ? (
        <Note kind="ok" style={{ marginBottom: 18 }}>
          Saved offline — it’ll sync when you’re back online. See Offline sync.
        </Note>
      ) : null}

      <Card
        title="Consumables"
        sub="reorder alerts"
        flush
        style={{ marginBottom: 20 }}
        actions={
          <input
            className="min-w-[200px] rounded-[10px] border border-hair bg-raise-2 px-[11px] py-[7px] text-[13px] font-medium text-ink placeholder:text-muted focus:border-ink focus:outline-none"
            type="search"
            value={consumableSearch}
            onChange={(e) => setConsumableSearch(e.target.value)}
            placeholder="Search consumables…"
            aria-label="Search consumables"
          />
        }
      >
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
              consumableSearch.trim() ? (
                <EmptyState
                  icon="🔍"
                  title="No matches"
                  message={`No consumables match “${consumableSearch.trim()}”.`}
                />
              ) : (
                <EmptyState
                  icon="📦"
                  title="No consumables"
                  message="Add rice, gas and fuel so the dashboard can warn you."
                />
              )
            }
          >
            <tbody>
              {consumables.map((i) => (
                <tr key={i.id}>
                  <td className="t1">
                    {i.name}
                    {i.unit ? <span className="t2"> ({i.unit})</span> : null}
                  </td>
                  <td className="num" data-label="On hand">{Number(i.currentQty)}</td>
                  <td className="num" data-label="Reorder at">
                    {i.reorderThreshold ? Number(i.reorderThreshold) : '—'}
                  </td>
                  <td data-label="Status">
                    <Pill tone={isLow(i) ? 'danger' : 'ok'}>
                      {isLow(i) ? 'low — reorder' : 'ok'}
                    </Pill>
                  </td>
                  <td>
                    <div className="rowact">
                      <button
                        className={`${BTN_O} ${BTN_SM}`}
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

      <Card
        title="Durables"
        sub="counted on demand"
        flush
        actions={
          <input
            className="min-w-[200px] rounded-[10px] border border-hair bg-raise-2 px-[11px] py-[7px] text-[13px] font-medium text-ink placeholder:text-muted focus:border-ink focus:outline-none"
            type="search"
            value={durableSearch}
            onChange={(e) => setDurableSearch(e.target.value)}
            placeholder="Search durables…"
            aria-label="Search durables"
          />
        }
      >
        <TableWrap minWidth={720}>
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Expected</th>
              <th>Last count</th>
              <th />
            </tr>
          </thead>
          <AsyncTable
            isLoading={isLoading}
            error={loadError}
            isEmpty={durables.length === 0}
            onRetry={() => mutate()}
            empty={
              durableSearch.trim() ? (
                <EmptyState
                  icon="🔍"
                  title="No matches"
                  message={`No durables match “${durableSearch.trim()}”.`}
                />
              ) : (
                <EmptyState
                  icon="🧯"
                  title="No durables"
                  message="Life jackets, plates, bedding — anything you count rather than consume."
                />
              )
            }
          >
            <tbody>
              {durables.map((i) => (
                <tr key={i.id}>
                  <td className="t1">
                    {i.name}
                    {i.unit ? <span className="t2"> ({i.unit})</span> : null}
                  </td>
                  <td className="num" data-label="Expected">{Number(i.currentQty)}</td>
                  <td data-label="Last count">{renderLastCount(i.lastCount)}</td>
                  <td>
                    <div className="rowact">
                      <button
                        className={`${BTN_O} ${BTN_SM}`}
                        onClick={() => {
                          setCountResult(null);
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
            <button className={BTN_O} onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button className={BTN_B} onClick={addItem} disabled={busy || !name}>
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
        onClose={closeMovement}
        footer={
          countResult ? (
            <button className={BTN_B} onClick={closeMovement}>
              Done
            </button>
          ) : (
            <>
              <button className={BTN_O} onClick={closeMovement}>
                Cancel
              </button>
              <button
                className={BTN_B}
                onClick={recordMovement}
                disabled={busy || !qty}
              >
                {busy ? 'Saving…' : 'Record'}
              </button>
            </>
          )
        }
      >
        {countResult ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <Note
              kind={
                countResult.discrepancy > 0
                  ? 'danger'
                  : countResult.discrepancy < 0
                    ? 'warn'
                    : 'ok'
              }
            >
              {countResult.discrepancy > 0
                ? `${countResult.discrepancy}${countResult.unit ? ` ${countResult.unit}` : ''} missing since the last count.`
                : countResult.discrepancy < 0
                  ? `${Math.abs(countResult.discrepancy)}${countResult.unit ? ` ${countResult.unit}` : ''} more than expected.`
                  : 'Count matched — nothing missing.'}
            </Note>
          </div>
        ) : (
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
        )}
      </Drawer>
    </>
  );
}
