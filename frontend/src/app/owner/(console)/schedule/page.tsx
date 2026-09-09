'use client';

import { useEffect, useState } from 'react';
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
import { DepartureStatusPill, Pill } from '@/components/owner/Pill';
import { BTN_B, BTN_O, BTN_SM } from '@/components/owner/buttons';
import { Drawer } from '@/components/owner/Drawer';
import { apiErrorMessage, formatDate, weekday } from '@/lib/owner/format';
import { submitOrQueue, isOfflineUnavailable } from '@/lib/owner/submit-or-queue';

interface Departure {
  id: string;
  startDate: string;
  endDate: string | null;
  departureTime: string | null;
  availableCount: number;
  status: string;
  cancelReason: string | null;
  scheduleSlotId: string | null;
  pricingProfileId: string | null;
  package: { id: string; durationLabel: string | null; route: { name: string } };
}

interface TripPackage {
  id: string;
  durationLabel: string | null;
  durationDays: number;
  route: { id: string; name: string };
}

interface PricingProfile {
  id: string;
  name: string;
  isDefault: boolean;
}

interface ScheduleSlot {
  slotNo: number;
  weekdays: number[];
  departureTime: string | null;
  pricingProfileId: string | null;
}

interface Schedule {
  id: string;
  packageId: string;
  active: boolean;
  package?: { durationLabel: string | null; route: { name: string } };
  slots: ScheduleSlot[];
}

const DAYS = [
  { n: 0, label: 'Sun' },
  { n: 1, label: 'Mon' },
  { n: 2, label: 'Tue' },
  { n: 3, label: 'Wed' },
  { n: 4, label: 'Thu' },
  { n: 5, label: 'Fri' },
  { n: 6, label: 'Sat' },
];

const SLOT_COUNT = 7;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function emptySlots(): ScheduleSlot[] {
  return Array.from({ length: SLOT_COUNT }, (_, i) => ({
    slotNo: i + 1,
    weekdays: [],
    departureTime: '07:30',
    pricingProfileId: null,
  }));
}

/** HH:mm from a stored @db.Time value (an ISO datetime on the epoch date). */
function timeHHmm(v: string | null): string {
  if (!v) return '';
  return v.length > 5 ? new Date(v).toISOString().slice(11, 16) : v;
}

export default function OwnerSchedulePage() {
  const { boatId } = useActiveBoat();
  const [packageId, setPackageId] = useState('');
  const [slots, setSlots] = useState<ScheduleSlot[]>(emptySlots());
  const [tripsPerWeek, setTripsPerWeek] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // ── Departures table: month/year filter (defaults to current month) ──
  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getUTCFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getUTCMonth()); // 0..11
  const [showCancelled, setShowCancelled] = useState(false);

  // ── Departure edit drawer ──
  const [editDep, setEditDep] = useState<Departure | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editProfile, setEditProfile] = useState('');
  const [rowBusy, setRowBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [rowSavedOffline, setRowSavedOffline] = useState(false);

  // ── Cancel-departure dialog ──
  const [cancelDep, setCancelDep] = useState<Departure | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const schedule = useSWR<Schedule | null>(`/houseboats/${boatId}/schedule`, fetcher, {
    revalidateOnFocus: false,
  });
  const packages = useSWR<TripPackage[]>(
    `/houseboats/${boatId}/packages?route=active`,
    fetcher,
    { revalidateOnFocus: false },
  );
  const profiles = useSWR<PricingProfile[]>(
    `/houseboats/${boatId}/pricing-profiles?route=active`,
    fetcher,
    { revalidateOnFocus: false },
  );
  const departures = useSWR<Departure[]>(`/houseboats/${boatId}/departures-list`, fetcher, {
    revalidateOnFocus: false,
  });

  // Hydrate the form from the saved schedule when it (or the boat) changes.
  useEffect(() => {
    const s = schedule.data;
    if (!s) {
      setPackageId('');
      setSlots(emptySlots());
      setTripsPerWeek(3);
      return;
    }
    setPackageId(s.packageId);
    const base = emptySlots();
    let maxSlot = 0;
    for (const slot of s.slots) {
      const idx = slot.slotNo - 1;
      if (idx >= 0 && idx < SLOT_COUNT) {
        base[idx] = {
          slotNo: slot.slotNo,
          weekdays: slot.weekdays,
          departureTime: timeHHmm(slot.departureTime) || '07:30',
          pricingProfileId: slot.pricingProfileId,
        };
        if (slot.weekdays.length > 0) maxSlot = Math.max(maxSlot, slot.slotNo);
      }
    }
    setSlots(base);
    setTripsPerWeek(maxSlot || 3);
  }, [schedule.data]);

  function toggleDay(slotIdx: number, day: number) {
    setSlots((prev) =>
      prev.map((s, i) => {
        if (i !== slotIdx) return s;
        const has = s.weekdays.includes(day);
        return {
          ...s,
          weekdays: has
            ? s.weekdays.filter((d) => d !== day)
            : [...s.weekdays, day].sort((a, b) => a - b),
        };
      }),
    );
  }

  function setSlotField(slotIdx: number, patch: Partial<ScheduleSlot>) {
    setSlots((prev) => prev.map((s, i) => (i === slotIdx ? { ...s, ...patch } : s)));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !packageId) return;

    // Every visible trip needs weekdays, a departure time, and a pricing profile.
    const visible = slots.slice(0, tripsPerWeek);
    for (const s of visible) {
      if (s.weekdays.length === 0) {
        setError(`Trip ${s.slotNo}: pick at least one weekday.`);
        return;
      }
      if (!s.departureTime) {
        setError(`Trip ${s.slotNo}: set a departure time.`);
        return;
      }
      if (!s.pricingProfileId) {
        setError(`Trip ${s.slotNo}: choose a pricing profile.`);
        return;
      }
    }

    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const payload = {
        packageId,
        active: true,
        slots: visible.map((s) => ({
          slotNo: s.slotNo,
          weekdays: s.weekdays,
          departureTime: s.departureTime,
          pricingProfileId: s.pricingProfileId,
        })),
      };
      const res = await api.put(`/houseboats/${boatId}/schedule`, payload);
      const generated = (res.data as { generated?: number })?.generated ?? 0;
      setSaved(
        `Schedule saved. ${generated} departure${generated === 1 ? '' : 's'} generated for the next two months.`,
      );
      await Promise.all([schedule.mutate(), departures.mutate()]);
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          'Could not save the schedule. Check the package and your operating dates.',
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  function stepMonth(delta: number) {
    let m = filterMonth + delta;
    let y = filterYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setFilterMonth(m);
    setFilterYear(y);
  }

  function openEditDeparture(d: Departure) {
    setEditDep(d);
    setRowError(null);
    setEditDate(d.startDate.slice(0, 10));
    setEditTime(timeHHmm(d.departureTime));
    setEditProfile(d.pricingProfileId ?? '');
  }

  async function saveDeparture(e: React.FormEvent) {
    e.preventDefault();
    if (rowBusy || !editDep) return;
    setRowBusy(true);
    setRowError(null);
    setRowSavedOffline(false);
    try {
      const newDate = editDate || undefined;
      const body = {
        startDate: newDate,
        departureTime: editTime || undefined,
        pricingProfileId: editProfile || undefined,
      };
      const online = () =>
        api.patch(`/houseboats/${boatId}/departures/${editDep.id}`, body);
      // Only a date change is replayable offline (date_change). If the date is
      // unchanged — a time/profile-only edit — stay online-only; offline it
      // falls through to the normal network error below.
      const dateChanged =
        Boolean(newDate) && newDate !== editDep.startDate.slice(0, 10);
      const res = dateChanged
        ? await submitOrQueue(online, {
            houseboatId: boatId,
            action: 'date_change',
            payload: { departureId: editDep.id, startDate: newDate },
          })
        : ({ status: 'sent' as const, data: await online() });
      if (res.status === 'sent') {
        setEditDep(null);
        await departures.mutate();
      } else {
        // Queued: date captured for replay. Any time/profile change in the same
        // edit is NOT replayed — only the date is.
        setEditDep(null);
        setRowSavedOffline(true);
      }
    } catch (err) {
      setRowError(
        isOfflineUnavailable(err)
          ? (err as Error).message
          : apiErrorMessage(err, 'Could not update the departure.'),
      );
    } finally {
      setRowBusy(false);
    }
  }

  function openCancelDeparture(d: Departure) {
    setCancelDep(d);
    setCancelReason('');
    setRowError(null);
  }

  async function submitCancel(e: React.FormEvent) {
    e.preventDefault();
    if (rowBusy || !cancelDep || !cancelReason.trim()) return;
    setRowBusy(true);
    setRowError(null);
    try {
      await api.delete(`/houseboats/${boatId}/departures/${cancelDep.id}`, {
        data: { reason: cancelReason.trim() },
      });
      setCancelDep(null);
      await departures.mutate();
    } catch (err) {
      setRowError(apiErrorMessage(err, 'Could not cancel the departure.'));
    } finally {
      setRowBusy(false);
    }
  }

  async function reviveDeparture(d: Departure) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/houseboats/${boatId}/departures/${d.id}/revive`);
      await departures.mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not revive the departure.'));
    } finally {
      setBusy(false);
    }
  }

  const profileName = new Map((profiles.data ?? []).map((p) => [p.id, p.name]));

  // Filter to the selected month/year. Every status shows (scheduled,
  // in_progress, completed) so departures that the status cron has already
  // advanced stay visible as history rather than vanishing from the table.
  // Cancelled trips are opt-in via "Show cancelled" in the current/future month;
  // past months always show the full history including cancelled.
  const curYM = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const selYM = filterYear * 12 + filterMonth;
  const isPastMonth = selYM < curYM;
  const rows = (departures.data ?? []).filter((d) => {
    const dt = new Date(d.startDate);
    if (dt.getUTCFullYear() !== filterYear || dt.getUTCMonth() !== filterMonth)
      return false;
    if (isPastMonth) return true;
    if (d.status === 'cancelled') return showCancelled;
    return true;
  });
  const noPackages = (packages.data?.length ?? 0) === 0 && !packages.isLoading;

  return (
    <>
      <PageHead
        title="Schedule"
        desc="Pick your trip and the days it runs each week. Departures for the next two months are generated automatically and topped up daily."
      />

      {saved ? (
        <Note kind="ok" style={{ marginBottom: 18 }}>
          {saved}
        </Note>
      ) : null}
      {error ? (
        <Note kind="danger" style={{ marginBottom: 18 }}>
          {error}
        </Note>
      ) : null}

      {rowSavedOffline ? (
        <Note kind="ok" style={{ marginBottom: 18 }}>
          Date change saved offline — it’ll sync when you’re back online. See Offline sync.
        </Note>
      ) : null}

      {noPackages ? (
        <Note kind="warn" style={{ marginBottom: 18 }}>
          No packages on your active route — create a package for the boat&apos;s route
          first. The schedule generates departures from that route&apos;s package.
        </Note>
      ) : null}

      <form onSubmit={save}>
        <Card title="Weekly trips" sub="each trip is generated on the days you select">
          <div style={{ display: 'grid', gap: 14 }}>
            <Field label="Trip package">
              <select
                value={packageId}
                onChange={(e) => setPackageId(e.target.value)}
                required
              >
                <option value="">Choose a package…</option>
                {(packages.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.route.name} · {p.durationLabel ?? `${p.durationDays}d`}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Trips per week">
              <select
                value={tripsPerWeek}
                onChange={(e) => setTripsPerWeek(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'trip' : 'trips'} per week
                  </option>
                ))}
              </select>
            </Field>

            {slots.slice(0, tripsPerWeek).map((slot, idx) => (
              <div
                key={slot.slotNo}
                style={{
                  border: '1px solid var(--hair)',
                  borderRadius: 12,
                  padding: 14,
                  display: 'grid',
                  gap: 12,
                }}
              >
                <div style={{ fontWeight: 600 }}>Trip {slot.slotNo}</div>
                <div>
                  <div
                    className="t2"
                    style={{ marginBottom: 6 }}
                  >
                    Days <span style={{ color: 'var(--danger)' }}>*</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {DAYS.map((d) => {
                    const on = slot.weekdays.includes(d.n);
                    return (
                      <button
                        type="button"
                        key={d.n}
                        className={`${on ? BTN_B : BTN_O} ${BTN_SM}`}
                        onClick={() => toggleDay(idx, d.n)}
                      >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <Field label="Departure time *">
                    <input
                      type="time"
                      required
                      value={slot.departureTime ?? ''}
                      onChange={(e) => setSlotField(idx, { departureTime: e.target.value })}
                    />
                  </Field>
                  <Field label="Pricing profile *">
                    <select
                      required
                      value={slot.pricingProfileId ?? ''}
                      onChange={(e) =>
                        setSlotField(idx, { pricingProfileId: e.target.value || null })
                      }
                    >
                      <option value="">Choose a pricing profile…</option>
                      {(profiles.data ?? []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.isDefault ? ' (default)' : ''}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
            ))}

            <div>
              <button
                className={BTN_B}
                type="submit"
                disabled={busy || !packageId}
              >
                {busy ? 'Saving & generating…' : 'Save schedule'}
              </button>
            </div>
          </div>
        </Card>
      </form>

      <Note kind="info" style={{ margin: '16px 0' }}>
        Only dates in your operating dates carry a departure — set them on the boat profile
        first. Every trip needs days, a departure time, and a pricing profile. Changing the
        route on your profile starts a fresh schedule.
      </Note>

      <Card
        title="Generated departures"
        sub={`${MONTHS[filterMonth]} ${filterYear}`}
        flush
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 13,
                marginRight: 4,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={showCancelled}
                onChange={(e) => setShowCancelled(e.target.checked)}
              />
              Show cancelled
            </label>
            <button
              type="button"
              className={`${BTN_O} ${BTN_SM}`}
              onClick={() => stepMonth(-1)}
            >
              ‹ Prev
            </button>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
            >
              {[now.getUTCFullYear() - 1, now.getUTCFullYear(), now.getUTCFullYear() + 1].map(
                (y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ),
              )}
            </select>
            <button
              type="button"
              className={`${BTN_O} ${BTN_SM}`}
              onClick={() => stepMonth(1)}
            >
              Next ›
            </button>
          </div>
        }
      >
        <TableWrap minWidth={860}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Trip</th>
              <th>Departs</th>
              <th>Pricing</th>
              <th>Available</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <AsyncTable
            isLoading={departures.isLoading}
            error={departures.error}
            isEmpty={rows.length === 0}
            onRetry={() => departures.mutate()}
            empty={
              <div className="px-6 py-11 text-center text-muted">
                <div className="mb-2.5 text-[26px]">📅</div>
                <h4 className="mb-1.5 text-[15px] text-ink">
                  No departures in {MONTHS[filterMonth]} {filterYear}
                </h4>
                <p className="mx-auto max-w-[46ch] text-[13px] leading-[1.55]">
                  Save a weekly schedule to auto-fill departures, or pick another month.
                </p>
              </div>
            }
          >
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div className="t1">{formatDate(d.startDate)}</div>
                    <div className="t2">{weekday(d.startDate)}</div>
                  </td>
                  <td>
                    <div className="t1">{d.package.durationLabel ?? 'Trip'}</div>
                    <div className="t2">{d.package.route.name}</div>
                  </td>
                  <td className="t2">
                    {d.departureTime
                      ? new Date(d.departureTime).toISOString().slice(11, 16)
                      : '—'}
                    {d.endDate ? ` → ${formatDate(d.endDate)}` : ''}
                  </td>
                  <td>
                    <Pill tone="mut">
                      {d.pricingProfileId
                        ? (profileName.get(d.pricingProfileId) ?? 'profile')
                        : 'default'}
                    </Pill>
                  </td>
                  <td className="t1">{d.availableCount}</td>
                  <td>
                    <DepartureStatusPill status={d.status} />
                    {d.status === 'cancelled' && d.cancelReason ? (
                      <div className="t2" style={{ marginTop: 4, maxWidth: 240 }}>
                        {d.cancelReason}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    {d.status === 'scheduled' ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className={`${BTN_O} ${BTN_SM}`}
                          onClick={() => openEditDeparture(d)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={`${BTN_O} ${BTN_SM}`}
                          onClick={() => openCancelDeparture(d)}
                          disabled={busy}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : d.status === 'cancelled' ? (
                      <button
                        type="button"
                        className={`${BTN_O} ${BTN_SM}`}
                        onClick={() => reviveDeparture(d)}
                        disabled={busy}
                      >
                        Revive
                      </button>
                    ) : (
                      <span className="t2">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </AsyncTable>
        </TableWrap>
      </Card>

      <Drawer
        open={!!editDep}
        title="Edit departure"
        onClose={() => setEditDep(null)}
        footer={
          <>
            <button className={BTN_O} onClick={() => setEditDep(null)}>
              Cancel
            </button>
            <button className={BTN_B} onClick={saveDeparture} disabled={rowBusy}>
              {rowBusy ? 'Saving…' : 'Save changes'}
            </button>
          </>
        }
      >
        <form onSubmit={saveDeparture} style={{ display: 'grid', gap: 12 }}>
          {rowError ? <Note kind="danger">{rowError}</Note> : null}
          <Field label="Date">
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
            />
          </Field>
          <Field label="Departure time">
            <input
              type="time"
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
            />
          </Field>
          <Field label="Pricing profile">
            <select value={editProfile} onChange={(e) => setEditProfile(e.target.value)}>
              <option value="">Use the date&apos;s profile</option>
              {(profiles.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </Field>
          <Note kind="info">
            The date must be one of your operating dates, or the save is rejected.
          </Note>
        </form>
      </Drawer>

      <Drawer
        open={!!cancelDep}
        title="Cancel departure"
        onClose={() => setCancelDep(null)}
        footer={
          <>
            <button className={BTN_O} onClick={() => setCancelDep(null)}>
              Keep it
            </button>
            <button
              className={BTN_B}
              onClick={submitCancel}
              disabled={rowBusy || !cancelReason.trim()}
            >
              {rowBusy ? 'Cancelling…' : 'Cancel departure'}
            </button>
          </>
        }
      >
        <form onSubmit={submitCancel} style={{ display: 'grid', gap: 12 }}>
          {rowError ? <Note kind="danger">{rowError}</Note> : null}
          <Field label="Reason (shown to customers)">
            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Why is this trip cancelled?"
              required
            />
          </Field>
          <Note kind="warn">
            Customers with a booking on this trip will be notified and can request a
            refund. Saving the schedule later will not bring this date back — use Revive.
          </Note>
        </form>
      </Drawer>
    </>
  );
}
