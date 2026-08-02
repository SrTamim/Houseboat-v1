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
import { apiErrorMessage, formatDate, weekday } from '@/lib/owner/format';

interface Departure {
  id: string;
  startDate: string;
  endDate: string | null;
  departureTime: string | null;
  availableCount: number;
  status: string;
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

const SLOT_COUNT = 3;

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const schedule = useSWR<Schedule | null>(`/houseboats/${boatId}/schedule`, fetcher, {
    revalidateOnFocus: false,
  });
  const packages = useSWR<TripPackage[]>(`/houseboats/${boatId}/packages`, fetcher, {
    revalidateOnFocus: false,
  });
  const profiles = useSWR<PricingProfile[]>(
    `/houseboats/${boatId}/pricing-profiles`,
    fetcher,
    { revalidateOnFocus: false },
  );
  const departures = useSWR<Departure[]>(`/houseboats/${boatId}/departures`, fetcher, {
    revalidateOnFocus: false,
  });

  // Hydrate the form from the saved schedule when it (or the boat) changes.
  useEffect(() => {
    const s = schedule.data;
    if (!s) {
      setPackageId('');
      setSlots(emptySlots());
      return;
    }
    setPackageId(s.packageId);
    const base = emptySlots();
    for (const slot of s.slots) {
      const idx = slot.slotNo - 1;
      if (idx >= 0 && idx < SLOT_COUNT) {
        base[idx] = {
          slotNo: slot.slotNo,
          weekdays: slot.weekdays,
          departureTime: timeHHmm(slot.departureTime) || '07:30',
          pricingProfileId: slot.pricingProfileId,
        };
      }
    }
    setSlots(base);
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
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const payload = {
        packageId,
        active: true,
        slots: slots
          .filter((s) => s.weekdays.length > 0)
          .map((s) => ({
            slotNo: s.slotNo,
            weekdays: s.weekdays,
            departureTime: s.departureTime || undefined,
            pricingProfileId: s.pricingProfileId || undefined,
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

  const profileName = new Map((profiles.data ?? []).map((p) => [p.id, p.name]));
  const rows = (departures.data ?? []).filter((d) => d.status === 'scheduled');
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

      {noPackages ? (
        <Note kind="warn" style={{ marginBottom: 18 }}>
          Create a trip package first — the schedule generates departures from a package
          (its route is the boat&apos;s route).
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

            {slots.map((slot, idx) => (
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
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {DAYS.map((d) => {
                    const on = slot.weekdays.includes(d.n);
                    return (
                      <button
                        type="button"
                        key={d.n}
                        className={`btn btn-sm ${on ? 'btn-b' : 'btn-o'}`}
                        onClick={() => toggleDay(idx, d.n)}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <Field label="Departure time">
                    <input
                      type="time"
                      value={slot.departureTime ?? ''}
                      onChange={(e) => setSlotField(idx, { departureTime: e.target.value })}
                    />
                  </Field>
                  <Field label="Pricing profile">
                    <select
                      value={slot.pricingProfileId ?? ''}
                      onChange={(e) =>
                        setSlotField(idx, { pricingProfileId: e.target.value || null })
                      }
                    >
                      <option value="">Use the date&apos;s profile</option>
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
                className="btn btn-b"
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
        first. A slot with no days selected is ignored. Changing the route on your profile
        starts a fresh schedule.
      </Note>

      <Card title="Generated departures" sub="upcoming" flush>
        <TableWrap minWidth={760}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Trip</th>
              <th>Departs</th>
              <th>Pricing</th>
              <th>Available</th>
              <th>Status</th>
            </tr>
          </thead>
          <AsyncTable
            isLoading={departures.isLoading}
            error={departures.error}
            isEmpty={rows.length === 0}
            onRetry={() => departures.mutate()}
            empty={
              <div className="state">
                <div className="ic">📅</div>
                <h4>Nothing generated yet</h4>
                <p>Save a weekly schedule to auto-fill departures.</p>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </AsyncTable>
        </TableWrap>
      </Card>
    </>
  );
}
