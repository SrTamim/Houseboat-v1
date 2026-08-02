'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { apiErrorMessage, money, formatDate, weekday } from '@/lib/owner/format';

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
  staff: { id: string; account: { name: string | null; phone: string } | null };
}

const PAY_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bkash', label: 'bKash' },
  { value: 'bank', label: 'Bank' },
  { value: 'online', label: 'Online' },
] as const;

const CURRENT_YEAR = new Date().getUTCFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

/** Digits-only phone for a tel: link. */
function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export default function OwnerDeparturePage() {
  const { boatId } = useActiveBoat();
  const [selected, setSelected] = useState<string>('');
  const [date, setDate] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);

  const departures = useSWR<Departure[]>(`/houseboats/${boatId}/departures`, fetcher, {
    revalidateOnFocus: false,
  });

  // Departures narrowed by the date/month/year filter, newest first.
  const filtered = useMemo(() => {
    const all = [...(departures.data ?? [])].sort((a, b) =>
      b.startDate.localeCompare(a.startDate),
    );
    if (date) return all.filter((d) => d.startDate.slice(0, 10) === date);
    if (month) return all.filter((d) => monthOf(d.startDate) === month);
    if (year) return all.filter((d) => d.startDate.slice(0, 4) === year);
    return all;
  }, [departures.data, date, month, year]);

  // Default to the latest departure on load / when the filter changes.
  const activeId =
    selected && filtered.some((d) => d.id === selected)
      ? selected
      : filtered[0]?.id || '';
  const active = (departures.data ?? []).find((d) => d.id === activeId);

  useEffect(() => {
    setSelected('');
  }, [date, month, year]);

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
  const totalCabins = (active?.availableCount ?? 0) + cabinsSold;
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

  async function pay(method: string) {
    const b = payFor;
    if (!b || !b.invoice) return;
    const due =
      Number(b.invoice.displayTotal) - Number(b.invoice.amountPaid);
    if (due <= 0) {
      setPayFor(null);
      return;
    }
    setBusyId(b.id);
    setError(null);
    try {
      await api.post(`/invoices/${b.invoice.id}/payments`, { amount: due, method });
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
            setDate(e.target.value);
            setMonth('');
            setYear('');
          }}
        />
        <input
          type="month"
          aria-label="Month"
          value={month}
          onChange={(e) => {
            setMonth(e.target.value);
            setDate('');
            setYear('');
          }}
        />
        <select
          aria-label="Year"
          value={year}
          onChange={(e) => {
            setYear(e.target.value);
            setDate('');
            setMonth('');
          }}
        >
          <option value="">Any year</option>
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
        <select
          aria-label="Departure"
          value={activeId}
          onChange={(e) => setSelected(e.target.value)}
          disabled={filtered.length === 0}
        >
          {filtered.length === 0 ? <option value="">No departures</option> : null}
          {filtered.map((d) => (
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
              detail={`${active.availableCount} still free`}
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
                  <th>Status</th>
                </tr>
              </thead>
              <AsyncTable
                isLoading={bookings.isInitialLoading}
                error={bookings.error}
                isEmpty={bookings.items.length === 0}
                onRetry={() => bookings.mutate()}
                empty={
                  <div className="state">
                    <div className="ic">🎟️</div>
                    <h4>Nobody booked yet</h4>
                    <p>Sell from the counter or wait for online bookings.</p>
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
                            className="btn btn-sm btn-o"
                            disabled={due <= 0 || busyId === b.id}
                            onClick={() => setPayFor(b)}
                          >
                            Pay
                          </button>
                        </td>
                        <td>
                          <div className="rowact">
                            <button
                              className={`btn btn-sm ${b.checkinStatus === 'checked_in' ? 'btn-b' : 'btn-o'}`}
                              disabled={busyId === b.id}
                              onClick={() => setCheckin(b, 'checked_in')}
                            >
                              Checked in
                            </button>
                            <button
                              className={`btn btn-sm ${b.checkinStatus === 'absent' ? 'btn-b' : 'btn-o'}`}
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

          {payFor ? (
            <Card title={`Record payment · ${payFor.guests[0]?.name ?? 'Guest'}`} style={{ marginTop: 16 }}>
              <p className="t2" style={{ marginBottom: 12 }}>
                Due{' '}
                {money(
                  (
                    Number(payFor.invoice?.displayTotal ?? 0) -
                    Number(payFor.invoice?.amountPaid ?? 0)
                  ).toFixed(2),
                )}
                . How did the guest pay?
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PAY_METHODS.map((m) => (
                  <button
                    key={m.value}
                    className="btn btn-b btn-sm"
                    disabled={busyId === payFor.id}
                    onClick={() => pay(m.value)}
                  >
                    {m.label}
                  </button>
                ))}
                <button
                  className="btn btn-o btn-sm"
                  onClick={() => setPayFor(null)}
                  disabled={busyId === payFor.id}
                >
                  Cancel
                </button>
              </div>
            </Card>
          ) : null}

          <Card title="Crew today" sub="mark anyone who did not turn up" flush style={{ marginTop: 16 }}>
            <TableWrap minWidth={420}>
              <thead>
                <tr>
                  <th>Name</th>
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
                  <div className="state">
                    <div className="ic">⚓</div>
                    <h4>No crew assigned</h4>
                    <p>Crew auto-assign from your default crew when a departure is generated.</p>
                  </div>
                }
              >
                <tbody>
                  {crew.data?.map((c) => (
                    <tr key={c.id}>
                      <td className="t1">{c.staff.account?.name ?? 'Crew'}</td>
                      <td>
                        <Pill tone={c.present ? 'ok' : 'warn'}>
                          {c.present ? 'present' : 'absent'}
                        </Pill>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-o"
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
