'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import { PageHead, Card, Note, TableWrap, AsyncTable } from '@/components/owner/ui';
import { Pill } from '@/components/owner/Pill';
import { apiErrorMessage, formatDate, maskPhone } from '@/lib/owner/format';

interface WaitlistGroup {
  departureId: string;
  date: string;
  label: string | null;
  cabinsFree: number;
  partySizes: number[];
  entries: {
    id: string;
    name: string | null;
    phone: string;
    partySize: number;
    /** Null = waiting on any cabin of this trip. */
    cabinName?: string | null;
  }[];
}

export default function OwnerWaitlistPage() {
  const { boatId } = useActiveBoat();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const { data, error: loadError, isLoading, mutate } = useSWR<{ items: WaitlistGroup[] }>(
    `/houseboats/${boatId}/waitlist`,
    fetcher,
    { revalidateOnFocus: false },
  );

  async function notify(departureId: string) {
    if (busyId) return;
    setBusyId(departureId);
    setError(null);
    setSent(null);
    try {
      const res = await api.post<{ notified: number }>(
        `/houseboats/${boatId}/waitlist/${departureId}/notify`,
      );
      setSent(`Notified ${res.data.notified} waiting ${res.data.notified === 1 ? 'guest' : 'guests'}.`);
      await mutate();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not notify the waitlist.'));
    } finally {
      setBusyId(null);
    }
  }

  const groups = data?.items ?? [];

  return (
    <>
      <PageHead
        title="Waitlist"
        desc="People waiting for a place on a full departure. Everyone is notified at once when a cabin frees — the link routes through an ordinary hold, so first to book wins."
      />

      {sent ? (
        <Note kind="ok" style={{ marginBottom: 18 }}>
          {sent}
        </Note>
      ) : null}
      {error ? (
        <Note kind="danger" style={{ marginBottom: 18 }}>
          {error}
        </Note>
      ) : null}

      <Card flush>
        <TableWrap minWidth={760}>
          <thead>
            <tr>
              <th>Departure</th>
              <th>Waiting</th>
              <th>Party sizes</th>
              <th>Cabins free</th>
              <th />
            </tr>
          </thead>
          <AsyncTable
            isLoading={isLoading}
            error={loadError}
            isEmpty={groups.length === 0}
            onRetry={() => mutate()}
            empty={
              <div className="state">
                <div className="ic">⏳</div>
                <h4>Nobody waiting</h4>
                <p>
                  Guests join the waitlist from the public boat page when a departure is
                  full.
                </p>
              </div>
            }
          >
            <tbody>
              {groups.map((g) => (
                <tr key={g.departureId}>
                  <td>
                    <div className="t1">{formatDate(g.date)}</div>
                    <div className="t2">{g.label ?? 'Trip'}</div>
                  </td>
                  <td>
                    <div className="t1">{g.entries.length}</div>
                    <div className="t2">
                      {/* Name the cabin when there is one: the same customer can
                          appear on several rows of one trip, and without it those
                          read as duplicate entries. */}
                      {g.entries
                        .slice(0, 2)
                        .map((e) => {
                          const who = e.name ?? maskPhone(e.phone);
                          return e.cabinName ? `${who} (${e.cabinName})` : who;
                        })
                        .join(', ')}
                      {g.entries.length > 2 ? ` +${g.entries.length - 2}` : ''}
                    </div>
                  </td>
                  <td className="t2">{g.partySizes.join(', ')}</td>
                  <td>
                    <Pill tone={g.cabinsFree > 0 ? 'ok' : 'mut'}>
                      {g.cabinsFree > 0 ? `${g.cabinsFree} free` : 'full'}
                    </Pill>
                  </td>
                  <td>
                    <div className="rowact">
                      <button
                        className="btn btn-sm btn-b"
                        disabled={g.cabinsFree < 1 || busyId === g.departureId}
                        title={
                          g.cabinsFree < 1
                            ? 'Nothing is free on this departure yet'
                            : undefined
                        }
                        onClick={() => notify(g.departureId)}
                      >
                        {busyId === g.departureId
                          ? 'Notifying…'
                          : `Notify all ${g.entries.length}`}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </AsyncTable>
        </TableWrap>
      </Card>

      <Note kind="info" style={{ marginTop: 16 }}>
        No queue positions are stored. Hold attempts are rate-limited per cabin, so the
        notification burst cannot be used to hammer the same room.
      </Note>
    </>
  );
}
