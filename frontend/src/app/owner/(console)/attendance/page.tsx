'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import {
  PageHead,
  Card,
  FilterBar,
  Seg,
  Note,
  TableWrap,
  AsyncTable,
  AsyncBlock,
} from '@/components/owner/ui';
import { Pill } from '@/components/owner/Pill';
import { apiErrorMessage, formatDate, maskPhone, weekday } from '@/lib/owner/format';

interface Departure {
  id: string;
  startDate: string;
  status: string;
  package: { durationLabel: string | null };
}

interface Staff {
  id: string;
  account: { id: string; name: string | null; phone: string } | null;
  leaves?: { state: string; fromDate: string | null; toDate: string | null }[];
}

interface Crew {
  id: string;
  present: boolean;
  staff: { id: string; account: { name: string | null } | null };
}

export default function OwnerAttendancePage() {
  const { boatId } = useActiveBoat();
  const [selected, setSelected] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const departures = useSWR<Departure[]>(`/houseboats/${boatId}/departures`, fetcher, {
    revalidateOnFocus: false,
  });
  const staff = useSWR<Staff[]>(`/houseboats/${boatId}/staff`, fetcher, {
    revalidateOnFocus: false,
  });

  const relevant = useMemo(
    () =>
      (departures.data ?? []).filter(
        (d) => d.status === 'scheduled' || d.status === 'in_progress',
      ),
    [departures.data],
  );
  const activeId = selected || relevant[0]?.id || '';

  const crew = useSWR<Crew[]>(
    activeId ? `/houseboats/${boatId}/departures/${activeId}/crew` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const assigned = new Map((crew.data ?? []).map((c) => [c.staff.id, c]));

  /** Assign someone to this trip, or flip their presence. */
  async function setPresence(staffId: string, present: boolean) {
    if (!activeId || busyId) return;
    setBusyId(staffId);
    setError(null);
    try {
      await api.post(`/houseboats/${boatId}/departures/${activeId}/crew`, {
        staffId,
        present,
      });
      await crew.mutate();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not update attendance.'));
    } finally {
      setBusyId(null);
    }
  }

  const onLeave = (s: Staff): boolean =>
    Boolean(s.leaves?.some((l) => l.state === 'on_leave' || l.state === 'other_duty'));

  return (
    <>
      <PageHead
        title="Attendance"
        desc="Who is aboard for a given departure. Assigning someone and marking them present are two different things — the manifest needs both."
      />

      {error ? (
        <Note kind="danger" style={{ marginBottom: 18 }}>
          {error}
        </Note>
      ) : null}

      <FilterBar>
        <AsyncBlock
          isLoading={departures.isLoading}
          error={departures.error}
          isEmpty={relevant.length === 0}
          onRetry={() => departures.mutate()}
          empty={<Note kind="info">No upcoming departures to staff.</Note>}
        >
          <Seg
            options={relevant.slice(0, 6).map((d) => ({
              value: d.id,
              label: `${weekday(d.startDate)} ${formatDate(d.startDate).slice(0, 6)} · ${
                d.package.durationLabel ?? 'Trip'
              }`,
            }))}
            value={activeId}
            onChange={setSelected}
          />
        </AsyncBlock>
      </FilterBar>

      <div className="grid-2">
        <Card title="Crew" sub="assign and mark present" flush>
          <TableWrap minWidth={620}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Assigned</th>
                <th>Leave</th>
                <th />
              </tr>
            </thead>
            <AsyncTable
              isLoading={staff.isLoading}
              error={staff.error}
              isEmpty={(staff.data?.length ?? 0) === 0}
              onRetry={() => staff.mutate()}
              empty={
                <div className="state">
                  <div className="ic">⚓</div>
                  <h4>No crew on this boat</h4>
                  <p>Add crew first, then assign them to a departure.</p>
                </div>
              }
            >
              <tbody>
                {staff.data?.map((s) => {
                  const row = assigned.get(s.id);
                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="t1">{s.account?.name ?? 'Crew'}</div>
                        <div className="t2">{maskPhone(s.account?.phone)}</div>
                      </td>
                      <td>
                        {row ? (
                          <Pill tone={row.present ? 'ok' : 'warn'}>
                            {row.present ? 'present' : 'not aboard'}
                          </Pill>
                        ) : (
                          <Pill tone="mut">not assigned</Pill>
                        )}
                      </td>
                      <td>
                        {onLeave(s) ? <Pill tone="amb">on leave</Pill> : <span className="t2">—</span>}
                      </td>
                      <td>
                        <div className="rowact">
                          <button
                            className={`btn btn-sm ${row?.present ? 'btn-o' : 'btn-ok'}`}
                            disabled={!activeId || busyId === s.id}
                            onClick={() => setPresence(s.id, !row?.present)}
                          >
                            {busyId === s.id
                              ? 'Saving…'
                              : row?.present
                                ? 'Mark absent'
                                : 'Mark present'}
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

        <div className="stack">
          <Card title="On this trip" flush>
            <TableWrap minWidth={0}>
              <tbody>
                <tr>
                  <td className="t1">Assigned</td>
                  <td className="num">{crew.data?.length ?? 0}</td>
                </tr>
                <tr>
                  <td className="t1">Present</td>
                  <td className="num">
                    {(crew.data ?? []).filter((c) => c.present).length}
                  </td>
                </tr>
                <tr>
                  <td className="t1">On leave</td>
                  <td className="num">{(staff.data ?? []).filter(onLeave).length}</td>
                </tr>
              </tbody>
            </TableWrap>
          </Card>

          <Card title="Why both states">
            <Note kind="info">
              &quot;Not assigned&quot; means this person was never rostered for the trip.
              &quot;Not aboard&quot; means they were rostered and did not turn up. Payroll
              counts trips worked, so the difference matters at the end of the month.
            </Note>
          </Card>
        </div>
      </div>
    </>
  );
}
