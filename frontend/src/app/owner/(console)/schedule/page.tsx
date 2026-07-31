'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import {
  PageHead,
  Card,
  FilterBar,
  Seg,
  Field,
  Note,
  TableWrap,
  AsyncTable,
} from '@/components/owner/ui';
import { DepartureStatusPill, Pill } from '@/components/owner/Pill';
import { Drawer } from '@/components/owner/Drawer';
import { apiErrorMessage, formatDate, weekday } from '@/lib/owner/format';

interface Departure {
  id: string;
  startDate: string;
  endDate: string | null;
  departureTime: string | null;
  availableCount: number;
  status: string;
  pricingProfileId: string | null;
  package: { id: string; durationLabel: string | null; route: { name: string } };
}

interface TripPackage {
  id: string;
  durationLabel: string | null;
  durationDays: number;
  route: { name: string };
}

interface PricingProfile {
  id: string;
  name: string;
  isDefault: boolean;
}

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'scheduled', label: 'Upcoming' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function OwnerSchedulePage() {
  const { boatId } = useActiveBoat();
  const [filter, setFilter] = useState('scheduled');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [packageId, setPackageId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [departureTime, setDepartureTime] = useState('07:30');
  const [pricingProfileId, setPricingProfileId] = useState('');

  const departures = useSWR<Departure[]>(`/houseboats/${boatId}/departures`, fetcher, {
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

  const rows = (departures.data ?? []).filter((d) => !filter || d.status === filter);
  const counts = (departures.data ?? []).reduce<Record<string, number>>((acc, d) => {
    acc[d.status] = (acc[d.status] ?? 0) + 1;
    return acc;
  }, {});
  const profileName = new Map((profiles.data ?? []).map((p) => [p.id, p.name]));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !packageId || !startDate) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/houseboats/${boatId}/departures`, {
        packageId,
        startDate,
        departureTime: departureTime || undefined,
        pricingProfileId: pricingProfileId || undefined,
      });
      setOpen(false);
      setStartDate('');
      await departures.mutate();
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          'Could not schedule the departure. Check the date is one of your operating dates.',
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="Schedule"
        desc="Departures generated against your packages. A date must be in your operating dates before it can carry a departure."
        actions={
          <button
            className="btn btn-b"
            onClick={() => setOpen(true)}
            disabled={(packages.data?.length ?? 0) === 0}
          >
            ＋ New departure
          </button>
        }
      />

      {(packages.data?.length ?? 0) === 0 && !packages.isLoading ? (
        <Note kind="warn" style={{ marginBottom: 18 }}>
          Create a trip package first — a departure is always a package on a date.
        </Note>
      ) : null}

      <FilterBar>
        <Seg
          options={FILTERS.map((f) => ({
            ...f,
            count: f.value ? counts[f.value] : departures.data?.length,
          }))}
          value={filter}
          onChange={setFilter}
        />
      </FilterBar>

      <Card flush>
        <TableWrap minWidth={820}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Package</th>
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
                <h4>Nothing scheduled</h4>
                <p>Add a departure to make a date bookable.</p>
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

      <Note kind="info" style={{ marginTop: 16 }}>
        Status is time-driven: a departure becomes in progress and then completed on its
        own. A multi-day trip is always booked on its start date.
      </Note>

      <Drawer
        open={open}
        title="New departure"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-o" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-b"
              onClick={create}
              disabled={busy || !packageId || !startDate}
            >
              {busy ? 'Scheduling…' : 'Schedule'}
            </button>
          </>
        }
      >
        <form onSubmit={create} style={{ display: 'grid', gap: 12 }}>
          {error ? <Note kind="danger">{error}</Note> : null}

          <Field label="Package">
            <select value={packageId} onChange={(e) => setPackageId(e.target.value)} required>
              <option value="">Choose a package…</option>
              {packages.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.route.name} · {p.durationLabel ?? `${p.durationDays}d`}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Start date">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </Field>

          <Field label="Departure time">
            <input
              type="time"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
            />
          </Field>

          <Field label="Pricing profile">
            <select
              value={pricingProfileId}
              onChange={(e) => setPricingProfileId(e.target.value)}
            >
              <option value="">Use the date&apos;s profile</option>
              {profiles.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </Field>

          <Note kind="info">
            Leave the profile blank and the price comes from whichever profile covers that
            date — that is how weekend and Eid pricing applies automatically.
          </Note>
        </form>
      </Drawer>
    </>
  );
}
