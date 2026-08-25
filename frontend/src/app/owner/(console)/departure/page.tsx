'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import { useOwnerList } from '@/lib/owner/useOwnerList';
import {
  PageHead,
  Card,
  Kpi,
  Kpis,
  FilterBar,
  Note,
  TableWrap,
  AsyncTable,
} from '@/components/owner/ui';
import { Pill, DepartureStatusPill } from '@/components/owner/Pill';
import { BTN_B, BTN_O, BTN_SM, FIELD_BLOCK, FIELD_LABEL } from '@/components/owner/styles';
import { Drawer } from '@/components/owner/Drawer';
import {
  apiErrorMessage,
  money,
  formatDate,
  nextDepartureDate,
  weekday,
} from '@/lib/owner/format';

interface Departure {
  id: string;
  startDate: string;
  endDate: string | null;
  departureTime: string | null;
  availableCount: number;
  status: string;
  package: {
    durationLabel: string | null;
    departureGhat: string | null;
    route: { name: string };
  };
}

interface Booking {
  id: string;
  status: string;
  checkinStatus: string;
  customer: { name: string | null; phone: string };
  guests: { name: string; phone: string | null }[];
  cabins: { id: string; occupancy: number; roomPrice: string; cabin: { id: string; name: string } }[];
  invoice: { id: string; displayTotal: string; amountPaid: string; status: string } | null;
}

interface Crew {
  id: string;
  present: boolean;
  staff: {
    id: string;
    role: { name: string } | null;
    account: { name: string | null; phone: string } | null;
  };
}

const PAY_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bkash', label: 'bKash' },
  { value: 'bank', label: 'Bank' },
  { value: 'online', label: 'Online' },
] as const;

/** Digits-only phone for a tel: link. */
function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export default function OwnerDeparturePage() {
  const { boatId } = useActiveBoat();
  const [selected, setSelected] = useState<string>('');
  // Defaults to the next upcoming departure once the list loads (seed effect
  // below), not today — today often has no trip.
  const [date, setDate] = useState('');
  // One-shot: set once the default is seeded or the user picks a date, so the
  // seed never overrides a manual choice.
  const dateSeeded = useRef(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<Booking | null>(null);
  const [payMethod, setPayMethod] = useState<string>(PAY_METHODS[0].value);
  const [payAmount, setPayAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const departures = useSWR<Departure[]>(`/houseboats/${boatId}/departures-list`, fetcher, {
    revalidateOnFocus: false,
  });

  // Seed the date filter to the next upcoming departure the first time the list
  // loads. Runs once (dateSeeded ref) and only while the user hasn't picked, so
  // it never overrides a manual choice. Replaces the old default-to-today, which
  // fell through to the newest PAST departure when today had no trip.
  useEffect(() => {
    if (dateSeeded.current || !departures.data) return;
    dateSeeded.current = true;
    const next = nextDepartureDate(departures.data);
    if (next) setDate(next);
  }, [departures.data]);

  // Rated boat capacity, from the cabin layout. availableCount on the departure
  // dips while cabins are merely held, so it can't be trusted for the "x / total"
  // manifest count — the boat's actual cabin count can.
  const boatLayout = useSWR<{ decks: { cabins: unknown[] }[] }>(
    `/houseboats/${boatId}/manage`,
    fetcher,
    { revalidateOnFocus: false },
  );
  const cabinCount = (boatLayout.data?.decks ?? []).reduce(
    (n, d) => n + d.cabins.length,
    0,
  );

  // All departures, newest first.
  const all = useMemo(
    () =>
      [...(departures.data ?? [])].sort((a, b) =>
        b.startDate.localeCompare(a.startDate),
      ),
    [departures.data],
  );

  // Departures on the picked date. May be empty (e.g. no trip today).
  const filtered = useMemo(
    () => (date ? all.filter((d) => d.startDate.slice(0, 10) === date) : all),
    [all, date],
  );

  // Never leave the manifest blank: when the picked date has no departure,
  // fall back to the latest one so there's always something to work with.
  const pool = filtered.length ? filtered : all;

  const activeId =
    selected && pool.some((d) => d.id === selected)
      ? selected
      : pool[0]?.id || '';
  const active = all.find((d) => d.id === activeId);

  useEffect(() => {
    setSelected('');
  }, [date]);

  // Seed the pay form with the outstanding due whenever a row is picked.
  useEffect(() => {
    if (!payFor) return;
    const due = Math.max(
      0,
      Number(payFor.invoice?.displayTotal ?? 0) -
        Number(payFor.invoice?.amountPaid ?? 0),
    );
    setPayAmount(due.toFixed(2));
    setPayMethod(PAY_METHODS[0].value);
  }, [payFor]);

  const bookings = useOwnerList<Booking>(
    activeId ? `/houseboats/${boatId}/bookings` : null,
    { departureId: activeId, status: 'confirmed' },
  );

  const crew = useSWR<Crew[]>(
    activeId ? `/houseboats/${boatId}/departures/${activeId}/crew` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const cabinsSold = bookings.items.reduce((n, b) => n + b.cabins.length, 0);
  // Rated capacity (guarding a counter oversell), not availableCount + sold —
  // the former is stable, the latter shifts as cabins are held/released.
  const totalCabins = Math.max(cabinCount, cabinsSold);
  const onboard = bookings.items.filter((b) => b.checkinStatus === 'checked_in').length;
  const guests = bookings.items.reduce(
    (n, b) => n + b.cabins.reduce((c, cab) => c + cab.occupancy, 0),
    0,
  );
  const totalDue = bookings.items.reduce(
    (s, b) =>
      s +
      Math.max(
        0,
        Number(b.invoice?.displayTotal ?? 0) - Number(b.invoice?.amountPaid ?? 0),
      ),
    0,
  );
  const crewPresent = (crew.data ?? []).filter((c) => c.present).length;

  async function setCheckin(b: Booking, status: 'checked_in' | 'absent') {
    if (busyId) return;
    setBusyId(b.id);
    setError(null);
    try {
      await api.patch(`/houseboats/${boatId}/bookings/${b.id}/checkin`, { status });
      await bookings.mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update check-in status.'));
    } finally {
      setBusyId(null);
    }
  }

  async function pay() {
    const b = payFor;
    if (!b || !b.invoice) return;
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a payment amount greater than zero.');
      return;
    }
    setBusyId(b.id);
    setError(null);
    try {
      await api.post(`/invoices/${b.invoice.id}/payments`, {
        amount,
        method: payMethod,
      });
      setPayFor(null);
      await bookings.mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not record the payment.'));
    } finally {
      setBusyId(null);
    }
  }

  async function markCrewAbsent(c: Crew) {
    if (busyId) return;
    setBusyId(c.id);
    setError(null);
    try {
      await api.post(`/houseboats/${boatId}/departures/${activeId}/crew`, {
        staffId: c.staff.id,
        present: !c.present,
      });
      await crew.mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update crew attendance.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHead
        title="Departures"
        desc="The manifest for one trip: who is aboard, what is still owed, and which crew turned up."
        actions={active ? <DepartureStatusPill status={active.status} /> : undefined}
      />

      {error ? (
        <Note kind="danger" style={{ marginBottom: 18 }}>
          {error}
        </Note>
      ) : null}

      <FilterBar>
        <input
          type="date"
          aria-label="Departure date"
          value={date}
          onChange={(e) => {
            dateSeeded.current = true;
            setDate(e.target.value);
          }}
        />
        <select
          aria-label="Departure"
          value={activeId}
          onChange={(e) => {
            dateSeeded.current = true;
            setSelected(e.target.value);
          }}
          disabled={pool.length === 0}
        >
          {pool.length === 0 ? <option value="">No departures</option> : null}
          {pool.map((d) => (
            <option key={d.id} value={d.id}>
              {weekday(d.startDate)} {formatDate(d.startDate)} ·{' '}
              {d.package.durationLabel ?? 'Trip'}
            </option>
          ))}
        </select>
      </FilterBar>

      {active ? (
        <>
          <Kpis>
            <Kpi
              icon="🚪"
              label="Cabins sold"
              value={`${cabinsSold} / ${totalCabins}`}
              // Capacity minus confirmed sales — consistent with the value above.
              // (availableCount would dip on live holds and disagree with it.)
              detail={`${totalCabins - cabinsSold} unsold`}
            />
            <Kpi
              icon="✅"
              label="Onboard / booked"
              value={`${onboard} / ${bookings.items.length}`}
              detail={`${guests} guests booked`}
            />
            <Kpi
              icon="⚓"
              label="Crew present"
              value={`${crewPresent} / ${crew.data?.length ?? 0}`}
              alert={Boolean(crew.data?.length && crewPresent < crew.data.length)}
              detail="Marked below"
            />
            <Kpi
              icon="৳"
              label="Total due"
              value={money(totalDue.toFixed(2))}
              alert={totalDue > 0}
              detail="Unpaid across the manifest"
            />
          </Kpis>

          <Card title="Manifest" sub={`${active.package.route.name} · ${formatDate(active.startDate)}`} flush>
            <TableWrap minWidth={920}>
              <thead>
                <tr>
                  <th>Cabin</th>
                  <th>Guest</th>
                  <th>Phone</th>
                  <th>Heads</th>
                  <th className="num">Advance</th>
                  <th className="num">Due</th>
                  <th>Pay</th>
                  <th>Check-in</th>
                </tr>
              </thead>
              <AsyncTable
                isLoading={bookings.isInitialLoading}
                error={bookings.error}
                isEmpty={bookings.items.length === 0}
                onRetry={() => bookings.mutate()}
                empty={
                  <div className="px-6 py-11 text-center text-muted">
                    <div className="mb-2.5 text-[26px]">🎟️</div>
                    <h4 className="mb-1.5 text-[15px] text-ink">Nobody booked yet</h4>
                    <p className="mx-auto max-w-[46ch] text-[13px] leading-[1.55]">
                      Sell from the counter or wait for online bookings.
                    </p>
                  </div>
                }
              >
                <tbody>
                  {bookings.items.map((b) => {
                    const phone = b.guests[0]?.phone ?? b.customer.phone;
                    const paid = Number(b.invoice?.amountPaid ?? 0);
                    const total = Number(b.invoice?.displayTotal ?? 0);
                    const due = Math.max(0, total - paid);
                    return (
                      <tr key={b.id}>
                        <td className="t1">
                          {b.cabins.map((c) => c.cabin.name).join(', ') || '—'}
                        </td>
                        <td>{b.guests[0]?.name ?? b.customer.name ?? 'Guest'}</td>
                        <td className="t2">
                          <a href={telHref(phone)}>{phone}</a>
                        </td>
                        <td>{b.cabins.reduce((n, c) => n + c.occupancy, 0)}</td>
                        <td className="num">{money(paid.toFixed(2))}</td>
                        <td className="num">
                          {due > 0 ? (
                            <Pill tone="warn">{money(due.toFixed(2))}</Pill>
                          ) : (
                            <Pill tone="ok">paid</Pill>
                          )}
                        </td>
                        <td>
                          <button
                            className={`${BTN_O} ${BTN_SM}`}
                            disabled={due <= 0 || busyId === b.id}
                            onClick={() => setPayFor(b)}
                          >
                            Pay
                          </button>
                        </td>
                        <td>
                          <div className="rowact">
                            <button
                              className={`${b.checkinStatus === 'checked_in' ? BTN_B : BTN_O} ${BTN_SM}`}
                              disabled={busyId === b.id}
                              onClick={() => setCheckin(b, 'checked_in')}
                            >
                              Checked in
                            </button>
                            <button
                              className={`${b.checkinStatus === 'absent' ? BTN_B : BTN_O} ${BTN_SM}`}
                              disabled={busyId === b.id}
                              onClick={() => setCheckin(b, 'absent')}
                            >
                              Absent
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </AsyncTable>
            </TableWrap>
          </Card>

          <Drawer
            open={Boolean(payFor)}
            title={`Record payment · ${payFor?.guests[0]?.name ?? 'Guest'}`}
            onClose={() => setPayFor(null)}
            footer={
              payFor ? (
                <>
                  <button
                    className={`${BTN_O} ${BTN_SM}`}
                    onClick={() => setPayFor(null)}
                    disabled={busyId === payFor.id}
                  >
                    Cancel
                  </button>
                  <button
                    className={`${BTN_B} ${BTN_SM}`}
                    onClick={() => pay()}
                    disabled={busyId === payFor.id}
                  >
                    Record payment
                  </button>
                </>
              ) : null
            }
          >
            {payFor ? (
              <>
                <p className="t2" style={{ marginBottom: 16 }}>
                  Due{' '}
                  {money(
                    Math.max(
                      0,
                      Number(payFor.invoice?.displayTotal ?? 0) -
                        Number(payFor.invoice?.amountPaid ?? 0),
                    ).toFixed(2),
                  )}
                  . Enter the amount the guest is paying now — it can be less
                  than the due.
                </p>
                <div className={FIELD_BLOCK} style={{ marginBottom: 14 }}>
                  <label htmlFor="pay-amount" className={FIELD_LABEL}>Amount</label>
                  <input
                    id="pay-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                  />
                </div>
                <div className={FIELD_BLOCK}>
                  <label htmlFor="pay-method" className={FIELD_LABEL}>Payment method</label>
                  <select
                    id="pay-method"
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                  >
                    {PAY_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}
          </Drawer>

          <Card title="Crew today" sub="mark anyone who did not turn up" flush style={{ marginTop: 16 }}>
            <TableWrap minWidth={520}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Designation</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <AsyncTable
                isLoading={crew.isLoading}
                error={crew.error}
                isEmpty={(crew.data?.length ?? 0) === 0}
                onRetry={() => crew.mutate()}
                empty={
                  <div className="px-6 py-11 text-center text-muted">
                    <div className="mb-2.5 text-[26px]">⚓</div>
                    <h4 className="mb-1.5 text-[15px] text-ink">No crew assigned</h4>
                    <p className="mx-auto max-w-[46ch] text-[13px] leading-[1.55]">
                      Crew auto-assign from your default crew when a departure is generated.
                    </p>
                  </div>
                }
              >
                <tbody>
                  {crew.data?.map((c) => (
                    <tr key={c.id}>
                      <td className="t1">{c.staff.account?.name ?? 'Crew'}</td>
                      <td className="t2">{c.staff.role?.name ?? '—'}</td>
                      <td>
                        <Pill tone={c.present ? 'ok' : 'warn'}>
                          {c.present ? 'present' : 'absent'}
                        </Pill>
                      </td>
                      <td>
                        <button
                          className={`${BTN_O} ${BTN_SM}`}
                          disabled={busyId === c.id}
                          onClick={() => markCrewAbsent(c)}
                        >
                          {c.present ? 'Mark absent' : 'Mark present'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </AsyncTable>
            </TableWrap>
          </Card>
        </>
      ) : null}
    </>
  );
}
