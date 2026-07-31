'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import { useOwnerList } from '@/lib/owner/useOwnerList';
import {
  PageHead,
  Card,
  Field,
  Note,
  Seg,
  FilterBar,
  AsyncBlock,
} from '@/components/owner/ui';
import { CabGrid, type CabTile } from '@/components/owner/CabGrid';
import { apiErrorMessage, formatDate, toE164, weekday } from '@/lib/owner/format';

interface Departure {
  id: string;
  startDate: string;
  availableCount: number;
  status: string;
  package: { durationLabel: string | null; route: { name: string } };
}

interface BoatDetail {
  decks: { id: string; name: string; cabins: { id: string; name: string; cabinCategoryId: string }[] }[];
  cabinCategories: { id: string; name: string; baseCapacity: number; extendedCapacity: number | null }[];
}

interface Booking {
  id: string;
  cabins: { cabin: { id: string } }[];
}

interface Selection {
  cabinId: string;
  name: string;
  adults: number;
  children: number;
}

/**
 * Counter sale.
 *
 * The submit rides the ordinary hold → checkout path on the backend, which is
 * what makes double-booking impossible: the partial unique index on active
 * holds rejects a second sale of the same cabin. Nothing here writes bookings
 * directly.
 */
export default function OwnerPosPage() {
  const { boatId } = useActiveBoat();
  const [departureId, setDepartureId] = useState('');
  const [picked, setPicked] = useState<Selection[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [referenceName, setReferenceName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const departures = useSWR<Departure[]>(`/houseboats/${boatId}/departures`, fetcher, {
    revalidateOnFocus: false,
  });
  const boat = useSWR<BoatDetail>(`/houseboats/${boatId}/manage`, fetcher, {
    revalidateOnFocus: false,
  });

  const bookable = useMemo(
    () => (departures.data ?? []).filter((d) => d.status === 'scheduled'),
    [departures.data],
  );
  const activeId = departureId || bookable[0]?.id || '';
  const active = bookable.find((d) => d.id === activeId);

  const taken = useOwnerList<Booking>(
    activeId ? `/houseboats/${boatId}/bookings` : null,
    { departureId: activeId, status: 'confirmed' },
  );

  const tiles: CabTile[] = useMemo(() => {
    const cabins = (boat.data?.decks ?? []).flatMap((d) => d.cabins);
    const categories = new Map((boat.data?.cabinCategories ?? []).map((c) => [c.id, c]));
    const sold = new Set(taken.items.flatMap((b) => b.cabins.map((c) => c.cabin.id)));
    const chosen = new Set(picked.map((p) => p.cabinId));

    return cabins.map((c) => {
      const category = categories.get(c.cabinCategoryId);
      return {
        id: c.id,
        name: c.name,
        caption: category ? `${category.name} · ${category.baseCapacity}p` : null,
        state: sold.has(c.id) ? 'booked' : chosen.has(c.id) ? 'selected' : 'free',
      };
    });
  }, [boat.data, taken.items, picked]);

  function toggle(tile: CabTile) {
    setPicked((prev) => {
      const existing = prev.find((p) => p.cabinId === tile.id);
      if (existing) return prev.filter((p) => p.cabinId !== tile.id);
      return [...prev, { cabinId: tile.id, name: tile.name, adults: 2, children: 0 }];
    });
  }

  function setCount(cabinId: string, key: 'adults' | 'children', value: number) {
    setPicked((prev) =>
      prev.map((p) => (p.cabinId === cabinId ? { ...p, [key]: Math.max(0, value) } : p)),
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || picked.length === 0 || !activeId) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await api.post<{ id: string }>(`/houseboats/${boatId}/pos/bookings`, {
        departureId: activeId,
        customerName,
        customerPhone: toE164(customerPhone),
        cabins: picked.map((p) => ({
          cabinId: p.cabinId,
          adults: p.adults,
          children: p.children || undefined,
        })),
        couponCode: couponCode || undefined,
        referenceName: referenceName || undefined,
      });
      setDone(res.data.id);
      setPicked([]);
      setCustomerName('');
      setCustomerPhone('');
      setCouponCode('');
      setReferenceName('');
      await Promise.all([taken.mutate(), departures.mutate()]);
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          'Could not complete the sale. A cabin may have just been taken — re-check the grid.',
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="Counter sale"
        desc="Sell a cabin to someone standing at the ghat. The guest gets an account on their phone number, and the booking is identical to an online one."
      />

      {done ? (
        <Note kind="ok" style={{ marginBottom: 18 }}>
          Sale complete. Record the cash on the Payments page so it can be verified.
        </Note>
      ) : null}
      {error ? (
        <Note kind="danger" style={{ marginBottom: 18 }}>
          {error}
        </Note>
      ) : null}

      <FilterBar>
        <AsyncBlock
          isLoading={departures.isLoading}
          error={departures.error}
          isEmpty={bookable.length === 0}
          onRetry={() => departures.mutate()}
          empty={<Note kind="warn">No bookable departures. Add one from the schedule.</Note>}
        >
          <Seg
            options={bookable.slice(0, 5).map((d) => ({
              value: d.id,
              label: `${weekday(d.startDate)} ${formatDate(d.startDate).slice(0, 6)}`,
            }))}
            value={activeId}
            onChange={(v) => {
              setDepartureId(v);
              setPicked([]);
            }}
          />
        </AsyncBlock>
      </FilterBar>

      <div className="grid-2">
        <Card
          title="Cabins"
          sub={
            active
              ? `${active.package.durationLabel ?? 'Trip'} · ${formatDate(active.startDate)}`
              : undefined
          }
        >
          <AsyncBlock
            isLoading={boat.isLoading}
            error={boat.error}
            isEmpty={tiles.length === 0}
            onRetry={() => boat.mutate()}
            empty={
              <Note kind="warn">
                This boat has no cabins yet. Add decks and cabins from Boat setup.
              </Note>
            }
          >
            <CabGrid cabins={tiles} onSelect={toggle} />
            <Note kind="info" style={{ marginTop: 14 }}>
              Selecting a cabin does not reserve it. The hold is taken when you complete
              the sale, and the server clock decides who wins if two people sell the same
              cabin at once.
            </Note>
          </AsyncBlock>
        </Card>

        <Card title={`Cart${picked.length ? ` · ${picked.length} cabin(s)` : ''}`}>
          <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
            {picked.length === 0 ? (
              <Note kind="info">Pick a free cabin from the grid to start a sale.</Note>
            ) : (
              picked.map((p) => (
                <div
                  key={p.cabinId}
                  style={{
                    border: '1px solid var(--hair)',
                    borderRadius: 'var(--r)',
                    padding: 12,
                    display: 'grid',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <b>Cabin {p.name}</b>
                    <button
                      type="button"
                      className="btn btn-sm btn-o"
                      onClick={() => toggle({ id: p.cabinId, name: p.name, state: 'selected' })}
                    >
                      Remove
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Field label="Adults">
                      <input
                        type="number"
                        min={1}
                        value={p.adults}
                        onChange={(e) => setCount(p.cabinId, 'adults', Number(e.target.value))}
                      />
                    </Field>
                    <Field label="Children">
                      <input
                        type="number"
                        min={0}
                        value={p.children}
                        onChange={(e) => setCount(p.cabinId, 'children', Number(e.target.value))}
                      />
                    </Field>
                  </div>
                </div>
              ))
            )}

            <Field label="Lead guest name">
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Farhana Akter"
                required
              />
            </Field>

            <Field label="Phone">
              <div className="with-pre">
                <span className="pre">+880</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="1711222290"
                  required
                />
              </div>
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Coupon code">
                <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} />
              </Field>
              <Field label="Reference">
                <input
                  value={referenceName}
                  onChange={(e) => setReferenceName(e.target.value)}
                  placeholder="Who sent them"
                />
              </Field>
            </div>

            <button
              className="btn btn-b"
              type="submit"
              disabled={busy || picked.length === 0}
              style={{ justifyContent: 'center' }}
            >
              {busy ? 'Completing…' : 'Complete sale →'}
            </button>

            <Note kind="warn">
              Cash taken here never touches the gateway, so it is not part of the weekly
              payout. Record and verify it on the Payments page.
            </Note>
          </form>
        </Card>
      </div>
    </>
  );
}
