'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { money } from '@/lib/owner/format';
import type {
  BoatDetail,
  Departure,
  DepartureCabins,
  GroupBand,
  Quote,
} from '@/lib/customer/types';

interface Cabin {
  id: string;
  name: string;
  deck: string;
  isAc: boolean;
  capacity: number;
}

interface Pax {
  adults: number;
  children: number;
  childAges: number[];
}

/** sessionStorage key the checkout page reads to restore the selection. */
const SELECTION_KEY = 'hb-selection';

export interface StoredSelection {
  slug: string;
  boatName: string;
  departureId: string;
  kind: 'cabin' | 'group';
  cabins: { cabinId: string; cabinName: string; adults: number; children: number; childAges: number[] }[];
  groupHeadcount?: number;
  displayTotal: string;
}

export function BoatBooking({
  slug,
  boat,
  departures,
  bands,
  initialAvailability,
  isSignedIn,
}: {
  slug: string;
  boat: BoatDetail;
  departures: Departure[];
  bands: GroupBand[];
  initialAvailability: DepartureCabins | null;
  isSignedIn: boolean;
}) {
  const router = useRouter();
  const departure = departures[0] ?? null;

  const cabins: Cabin[] = useMemo(
    () =>
      boat.decks.flatMap((d) =>
        d.cabins.map((c) => ({
          id: c.id,
          name: c.name,
          deck: d.name,
          isAc: c.category.isAc,
          capacity: c.category.baseCapacity,
        })),
      ),
    [boat],
  );

  // cabinId → availability state (seeded from server, refreshed if needed).
  const availByCabin = useMemo(() => {
    const m = new Map<string, { state: string; spare: number }>();
    initialAvailability?.cabins.forEach((c) =>
      m.set(c.cabinId, { state: c.state, spare: c.spare }),
    );
    return m;
  }, [initialAvailability]);

  const [pax, setPax] = useState<Record<string, Pax>>({});
  const [group, setGroup] = useState<{ bandId: string; headcount: number } | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);

  const selectedCabins = useMemo(
    () =>
      cabins.filter((c) => {
        const p = pax[c.id];
        return p && p.adults + p.children > 0;
      }),
    [cabins, pax],
  );

  // Debounced server quote whenever the (cabin) selection changes. The server is
  // the single source of truth for price — no client-side NIGHTS/fee/child math.
  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (group || selectedCabins.length === 0 || !departure) {
      setQuote(null);
      return;
    }
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    quoteTimer.current = setTimeout(async () => {
      setQuoting(true);
      try {
        const body = {
          departureId: departure.id,
          cabins: selectedCabins.map((c) => ({
            cabinId: c.id,
            adults: pax[c.id].adults,
            children: pax[c.id].children,
            childAges: pax[c.id].childAges.slice(0, pax[c.id].children),
          })),
        };
        const { data } = await api.post<Quote>('/booking/quote', body);
        setQuote(data);
      } catch {
        setQuote(null);
      } finally {
        setQuoting(false);
      }
    }, 350);
    return () => {
      if (quoteTimer.current) clearTimeout(quoteTimer.current);
    };
  }, [selectedCabins, pax, group, departure]);

  const setCabinPax = (cabinId: string, next: Partial<Pax>) => {
    setGroup(null); // picking a cabin clears any group selection
    setPax((prev) => {
      const cur = prev[cabinId] ?? { adults: 0, children: 0, childAges: [] };
      const merged = { ...cur, ...next };
      // keep childAges array length in step with children count
      if (merged.children < merged.childAges.length) {
        merged.childAges = merged.childAges.slice(0, merged.children);
      }
      return { ...prev, [cabinId]: merged };
    });
  };

  const pickGroup = (band: GroupBand) => {
    setPax({}); // group buyout clears cabin picks
    setGroup({ bandId: band.id, headcount: band.minPeople });
  };

  const groupBand = bands.find((b) => b.id === group?.bandId) ?? null;

  const reserve = () => {
    if (!departure) return;
    let selection: StoredSelection;
    if (group && groupBand) {
      selection = {
        slug,
        boatName: boat.name,
        departureId: departure.id,
        kind: 'group',
        cabins: [],
        groupHeadcount: group.headcount,
        displayTotal: groupBand.totalPrice,
      };
    } else {
      if (!quote) return;
      selection = {
        slug,
        boatName: boat.name,
        departureId: departure.id,
        kind: 'cabin',
        cabins: selectedCabins.map((c) => ({
          cabinId: c.id,
          cabinName: c.name,
          adults: pax[c.id].adults,
          children: pax[c.id].children,
          childAges: pax[c.id].childAges.slice(0, pax[c.id].children),
        })),
        displayTotal: quote.displayTotal,
      };
    }
    try {
      sessionStorage.setItem(SELECTION_KEY, JSON.stringify(selection));
    } catch {}
    // Checkout enforces auth server-side; send signed-out users through the
    // login wall with a return to /checkout, selection preserved in storage.
    router.push('/checkout');
  };

  const ready = group ? !!groupBand : selectedCabins.length > 0 && !!quote;
  const totalLabel = group
    ? groupBand
      ? `৳ ${money(groupBand.totalPrice)}`
      : '—'
    : quote
      ? `৳ ${money(quote.displayTotal)}`
      : '—';

  return (
    <div className="dbody">
      <div>
        {/* CABINS */}
        <div className="dsec">
          <h2>Choose your cabins</h2>
          <p style={{ marginBottom: 16 }}>
            Add adults / children to a cabin to select it. Price is{' '}
            <b>per person</b>. Pick as many cabins as you like — the summary
            totals them all from the live server price.
          </p>
          <div className="agenote" style={{ marginBottom: 16 }}>
            ℹ️ Child fares follow this boat’s age policy · infants under 1 free.
          </div>
          <div id="cabinList">
            {cabins.map((c) => {
              const av = availByCabin.get(c.id);
              const booked = av?.state === 'booked';
              const openSeat = av?.state === 'open_seat';
              const cap = openSeat ? av!.spare : c.capacity;
              const p = pax[c.id] ?? { adults: 0, children: 0, childAges: [] };
              const used = p.adults + p.children;
              const canInc = used < cap && !group;
              return (
                <div
                  className={`cabin${used > 0 ? ' sel' : ''}${booked ? ' full' : ''}`}
                  key={c.id}
                >
                  <div className="cinfo">
                    <div className="cn">
                      {c.name}{' '}
                      {booked ? (
                        <span className="avail-tag no">⛔ Fully booked</span>
                      ) : openSeat ? (
                        <span className="avail-tag seat">🪑 {av!.spare} spare</span>
                      ) : (
                        <span className="avail-tag ok">✓ Available</span>
                      )}
                    </div>
                    <div className="cfac">
                      <span>👥 up to {cap}</span>
                      <span>{c.isAc ? '❄️ AC' : '🌀 Non-AC'}</span>
                      <span>📍 {c.deck}</span>
                    </div>
                  </div>
                  <div className="cright">
                    {booked ? (
                      <>
                        <div className="soldout">⛔ Fully booked</div>
                      </>
                    ) : (
                      <div className="ccount">
                        <div className="crow">
                          <span className="clbl">Adult</span>
                          <Stepper
                            value={p.adults}
                            canInc={canInc}
                            onDec={() =>
                              setCabinPax(c.id, { adults: Math.max(0, p.adults - 1) })
                            }
                            onInc={() => setCabinPax(c.id, { adults: p.adults + 1 })}
                          />
                        </div>
                        <div className="crow">
                          <span className="clbl">
                            Child<small> age 1–5</small>
                          </span>
                          <Stepper
                            value={p.children}
                            canInc={canInc}
                            onDec={() =>
                              setCabinPax(c.id, {
                                children: Math.max(0, p.children - 1),
                              })
                            }
                            onInc={() =>
                              setCabinPax(c.id, { children: p.children + 1 })
                            }
                          />
                        </div>
                        {p.children > 0 ? (
                          <div className="crow" style={{ flexWrap: 'wrap', gap: 6 }}>
                            {Array.from({ length: p.children }).map((_, i) => (
                              <input
                                key={i}
                                className="select"
                                type="number"
                                min={1}
                                max={5}
                                placeholder={`Child ${i + 1} age`}
                                value={p.childAges[i] ?? ''}
                                onChange={(e) => {
                                  const ages = [...p.childAges];
                                  ages[i] = Number(e.target.value);
                                  setCabinPax(c.id, { childAges: ages });
                                }}
                                style={{ width: 92 }}
                                aria-label={`Child ${i + 1} age`}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* GROUP BUYOUT */}
        {bands.length > 0 ? (
          <div className="dsec">
            <h2>👥 Book the whole boat (group)</h2>
            <p style={{ marginBottom: 16 }}>
              Buy out the entire houseboat at a flat group rate. Pick a size band
              and enter your headcount — one payment, no per-cabin split.
              Selecting a group clears any picked cabins.
            </p>
            <div className="bands">
              {bands.map((b) => (
                <button
                  key={b.id}
                  className={`band${group?.bandId === b.id ? ' on' : ''}`}
                  onClick={() => pickGroup(b)}
                >
                  <div className="bsz">
                    {b.minPeople}–{b.maxPeople} guests
                  </div>
                  <div className="bpr">
                    ৳ {money(b.totalPrice)}
                    <small>whole boat</small>
                  </div>
                </button>
              ))}
            </div>
            {group && groupBand ? (
              <div className="gbook">
                <div className="crow">
                  <span className="clbl">
                    Headcount<small> {groupBand.minPeople}–{groupBand.maxPeople}</small>
                  </span>
                  <Stepper
                    value={group.headcount}
                    canInc={group.headcount < groupBand.maxPeople}
                    onDec={() =>
                      setGroup({
                        ...group,
                        headcount: Math.max(groupBand.minPeople, group.headcount - 1),
                      })
                    }
                    onInc={() =>
                      setGroup({
                        ...group,
                        headcount: Math.min(groupBand.maxPeople, group.headcount + 1),
                      })
                    }
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* STICKY SUMMARY */}
      <aside className="book">
        <div className="dsec" style={{ position: 'sticky', top: 96 }}>
          <h2>Your booking</h2>
          {!departure ? (
            <div className="empty">No upcoming departures for this boat.</div>
          ) : (
            <>
              <div className="lines" id="summaryLines">
                {group && groupBand ? (
                  <>
                    <div className="brow">
                      <span>
                        Full boat · {group.headcount} guests
                      </span>
                      <b>৳ {money(groupBand.totalPrice)}</b>
                    </div>
                    <div className="brow total">
                      <span>Group total</span>
                      <span>৳ {money(groupBand.totalPrice)}</span>
                    </div>
                  </>
                ) : selectedCabins.length === 0 ? (
                  <div className="empty">
                    Add guests to a cabin — or pick a group band.
                  </div>
                ) : quote ? (
                  <>
                    {quote.perCabin.map((pc) => {
                      const cabin = cabins.find((c) => c.id === pc.cabinId);
                      return (
                        <div className="brow" key={pc.cabinId}>
                          <span>
                            {cabin?.name} ({pc.adults}A
                            {pc.children ? ` + ${pc.children}C` : ''})
                          </span>
                          <b>৳ {money(pc.roomPrice)}</b>
                        </div>
                      );
                    })}
                    {Number(quote.discountAmount) > 0 ? (
                      <div className="brow muted">
                        <span>Discount</span>
                        <span>− ৳ {money(quote.discountAmount)}</span>
                      </div>
                    ) : null}
                    <div className="brow total">
                      <span>Total</span>
                      <span>৳ {money(quote.displayTotal)}</span>
                    </div>
                  </>
                ) : (
                  <div className="empty">{quoting ? 'Pricing…' : 'Add guests to price.'}</div>
                )}
              </div>

              <button
                className="btn btn-b btn-block btn-lg"
                style={{ marginTop: 16 }}
                disabled={!ready}
                onClick={reserve}
              >
                {ready ? `Reserve · ${totalLabel}` : 'Select cabins'}
              </button>
              {!isSignedIn ? (
                <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10, textAlign: 'center' }}>
                  You’ll sign in at checkout to confirm.
                </p>
              ) : null}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function Stepper({
  value,
  canInc,
  onInc,
  onDec,
}: {
  value: number;
  canInc: boolean;
  onInc: () => void;
  onDec: () => void;
}) {
  return (
    <div className="stepper">
      <button className="dec" disabled={value <= 0} aria-label="Remove" onClick={onDec}>
        −
      </button>
      <span className="qv">{value}</span>
      <button className="inc" disabled={!canInc} aria-label="Add" onClick={onInc}>
        +
      </button>
    </div>
  );
}
