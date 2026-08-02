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
  FilterBar,
  AsyncBlock,
} from '@/components/owner/ui';
import { BoatCabinMap, type MapDeck } from '@/components/owner/BoatCabinMap';
import type { CabState } from '@/components/owner/CabGrid';
import { apiErrorMessage, formatDate, toE164, weekday } from '@/lib/owner/format';

interface Departure {
  id: string;
  startDate: string;
  availableCount: number;
  status: string;
  package: { durationLabel: string | null; route: { name: string } };
}

interface BoatDetail {
  decks: {
    id: string;
    name: string;
    cabins: { id: string; name: string; cabinCategoryId: string }[];
  }[];
  cabinCategories: {
    id: string;
    name: string;
    baseCapacity: number;
    extendedCapacity: number | null;
  }[];
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

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bkash', label: 'bKash' },
  { value: 'bank', label: 'Bank' },
  { value: 'online', label: 'Online' },
] as const;

/** "YYYY-MM" of a date string. */
function monthOf(iso: string): string {
  return iso.slice(0, 7);
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
  const [month, setMonth] = useState('');
  const [departureId, setDepartureId] = useState('');
  const [picked, setPicked] = useState<Selection[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [referenceName, setReferenceName] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const departures = useSWR<Departure[]>(`/houseboats/${boatId}/departures`, fetcher, {
    revalidateOnFocus: false,
  });
  const boat = useSWR<BoatDetail>(`/houseboats/${boatId}/manage`, fetcher, {
    revalidateOnFocus: false,
  });

  // Bookable departures from the schedule, optionally narrowed to a month.
  const bookable = useMemo(() => {
    const all = (departures.data ?? []).filter((d) => d.status === 'scheduled');
    return month ? all.filter((d) => monthOf(d.startDate) === month) : all;
  }, [departures.data, month]);

  const activeId = departureId && bookable.some((d) => d.id === departureId)
    ? departureId
    : bookable[0]?.id || '';
  const active = bookable.find((d) => d.id === activeId);

  const taken = useOwnerList<Booking>(
    activeId ? `/houseboats/${boatId}/bookings` : null,
    { departureId: activeId, status: 'confirmed' },
  );

  // Cabins grouped by deck for the boat-shaped map.
  const decks: MapDeck[] = useMemo(() => {
    const categories = new Map((boat.data?.cabinCategories ?? []).map((c) => [c.id, c]));
    const sold = new Set(taken.items.flatMap((b) => b.cabins.map((c) => c.cabin.id)));
    const chosen = new Set(picked.map((p) => p.cabinId));

    return (boat.data?.decks ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      cabins: d.cabins.map((c) => {
        const category = categories.get(c.cabinCategoryId);
        const state: CabState = sold.has(c.id)
          ? 'booked'
          : chosen.has(c.id)
            ? 'selected'
            : 'free';
        return {
          id: c.id,
          name: c.name,
          caption: category ? `${category.name} · ${category.baseCapacity}p` : null,
          state,
        };
      }),
    }));
  }, [boat.data, taken.items, picked]);

  const hasCabins = decks.some((d) => d.cabins.length > 0);

  function toggle(cabin: { id: string; name: string }) {
    setPicked((prev) => {
      const existing = prev.find((p) => p.cabinId === cabin.id);
      if (existing) return prev.filter((p) => p.cabinId !== cabin.id);
      return [...prev, { cabinId: cabin.id, name: cabin.name, adults: 2, children: 0 }];
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
        specialInstructions: note || undefined,
        paymentMethod,
      });
      setDone(res.data.id);
      setPicked([]);
      setCustomerName('');
      setCustomerPhone('');
      setCouponCode('');
      setReferenceName('');
      setNote('');
      setPaymentMethod('cash');
      await Promise.all([taken.mutate(), departures.mutate()]);
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          'Could not complete the sale. A cabin may have just been taken — re-check the layout.',
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
          Sale complete. Record the payment on the Payments page so it can be verified.
        </Note>
      ) : null}
      {error ? (
        <Note kind="danger" style={{ marginBottom: 18 }}>
          {error}
        </Note>
      ) : null}

      <FilterBar>
        <input
          type="month"
          aria-label="Filter departures by month"
          value={month}
          onChange={(e) => {
            setMonth(e.target.value);
            setDepartureId('');
            setPicked([]);
          }}
        />
        <select
          aria-label="Departure date"
          value={activeId}
          onChange={(e) => {
            setDepartureId(e.target.value);
            setPicked([]);
          }}
          disabled={bookable.length === 0}
        >
          {bookable.length === 0 ? <option value="">No departures</option> : null}
          {bookable.map((d) => (
            <option key={d.id} value={d.id}>
              {weekday(d.startDate)} {formatDate(d.startDate)} · {d.availableCount} free
            </option>
          ))}
        </select>
        {month ? (
          <button
            type="button"
            className="btn btn-sm btn-o"
            onClick={() => {
              setMonth('');
              setDepartureId('');
            }}
          >
            All months
          </button>
        ) : null}
      </FilterBar>

      <AsyncBlock
        isLoading={departures.isLoading}
        error={departures.error}
        isEmpty={bookable.length === 0}
        onRetry={() => departures.mutate()}
        empty={
          <Note kind="warn">
            No bookable departures{month ? ' this month' : ''}. Set a weekly schedule to
            generate them.
          </Note>
        }
      >
        <div className="grid-2">
          <Card
            title="Cabin layout"
            sub={
              active
                ? `${active.package.durationLabel ?? 'Trip'} · ${formatDate(active.startDate)}`
                : undefined
            }
          >
            <AsyncBlock
              isLoading={boat.isLoading}
              error={boat.error}
              isEmpty={!hasCabins}
              onRetry={() => boat.mutate()}
              empty={
                <Note kind="warn">
                  This boat has no cabins yet. Add decks and cabins from Boat setup.
                </Note>
              }
            >
              <BoatCabinMap decks={decks} onSelect={toggle} />
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
                <Note kind="info">Tap a free cabin on the layout to start a sale.</Note>
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
                        onClick={() => toggle({ id: p.cabinId, name: p.name })}
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

              <Field label="Note (customer requirement)">
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Early check-in, halal-only meals, ground-floor cabin…"
                />
              </Field>

              <Field label="Payment method (how the guest pays you)">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      type="button"
                      key={m.value}
                      className={`btn btn-sm ${paymentMethod === m.value ? 'btn-b' : 'btn-o'}`}
                      onClick={() => setPaymentMethod(m.value)}
                    >
                      {m.label}
                    </button>
                  ))}
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
                Payment taken here is your own money, not part of the platform payout.
                Record and verify it on the Payments page.
              </Note>
            </form>
          </Card>
        </div>
      </AsyncBlock>
    </>
  );
}
