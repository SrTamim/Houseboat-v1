'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import { useOwnerList } from '@/lib/owner/useOwnerList';
import {
  PageHead,
  Card,
  Kpi,
  Kpis,
  FilterBar,
  Seg,
  Note,
  TableWrap,
  AsyncTable,
  AsyncBlock,
} from '@/components/owner/ui';
import { Pill, DepartureStatusPill } from '@/components/owner/Pill';
import { CabGrid, type CabTile } from '@/components/owner/CabGrid';
import { money, formatDate, maskPhone, weekday } from '@/lib/owner/format';

interface Departure {
  id: string;
  startDate: string;
  endDate: string | null;
  departureTime: string | null;
  availableCount: number;
  status: string;
  package: { durationLabel: string | null; departureGhat: string | null; route: { name: string } };
}

interface BoatDetail {
  decks: { id: string; name: string; cabins: { id: string; name: string; cabinCategoryId: string }[] }[];
  cabinCategories: { id: string; name: string; baseCapacity: number }[];
}

interface Booking {
  id: string;
  status: string;
  customer: { name: string | null; phone: string };
  guests: { name: string; phone: string | null }[];
  cabins: { id: string; occupancy: number; roomPrice: string; cabin: { id: string; name: string } }[];
  invoice: { displayTotal: string; amountPaid: string; status: string } | null;
}

interface Crew {
  id: string;
  present: boolean;
  staff: { id: string; account: { name: string | null; phone: string } | null };
}

export default function OwnerDeparturePage() {
  const { boatId } = useActiveBoat();
  const [selected, setSelected] = useState<string>('');

  const departures = useSWR<Departure[]>(
    `/houseboats/${boatId}/departures`,
    fetcher,
    { revalidateOnFocus: false },
  );
  const boat = useSWR<BoatDetail>(`/houseboats/${boatId}/manage`, fetcher, {
    revalidateOnFocus: false,
  });

  // Default to the next departure that hasn't finished.
  const upcoming = useMemo(() => {
    const all = departures.data ?? [];
    return all.filter((d) => d.status === 'scheduled' || d.status === 'in_progress');
  }, [departures.data]);

  const activeId = selected || upcoming[0]?.id || '';
  const active = (departures.data ?? []).find((d) => d.id === activeId);

  const bookings = useOwnerList<Booking>(
    activeId ? `/houseboats/${boatId}/bookings` : null,
    { departureId: activeId, status: 'confirmed' },
  );

  const crew = useSWR<Crew[]>(
    activeId ? `/houseboats/${boatId}/departures/${activeId}/crew` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  // Map every cabin on the boat to its state on this departure.
  const tiles: CabTile[] = useMemo(() => {
    const allCabins = (boat.data?.decks ?? []).flatMap((d) => d.cabins);
    const categories = new Map(
      (boat.data?.cabinCategories ?? []).map((c) => [c.id, c]),
    );
    const bookedBy = new Map<string, Booking>();
    for (const b of bookings.items) {
      for (const c of b.cabins) bookedBy.set(c.cabin.id, b);
    }

    return allCabins.map((cab) => {
      const booking = bookedBy.get(cab.id);
      const category = categories.get(cab.cabinCategoryId);
      return {
        id: cab.id,
        name: cab.name,
        caption: booking
          ? (booking.guests[0]?.name ?? booking.customer.name ?? 'Guest')
          : (category?.name ?? null),
        price: booking?.cabins.find((c) => c.cabin.id === cab.id)?.roomPrice ?? null,
        state: booking ? 'booked' : 'free',
      };
    });
  }, [boat.data, bookings.items]);

  const guests = bookings.items.reduce(
    (n, b) => n + b.cabins.reduce((c, cab) => c + cab.occupancy, 0),
    0,
  );
  const bookedValue = bookings.items.reduce(
    (s, b) => s + Number(b.invoice?.displayTotal ?? 0),
    0,
  );
  const crewPresent = (crew.data ?? []).filter((c) => c.present).length;

  return (
    <>
      <PageHead
        title="Departures"
        desc="The manifest for one trip: who is aboard, which cabins are sold, and which crew turned up."
        actions={active ? <DepartureStatusPill status={active.status} /> : undefined}
      />

      <FilterBar>
        <AsyncBlock
          isLoading={departures.isLoading}
          error={departures.error}
          isEmpty={upcoming.length === 0}
          onRetry={() => departures.mutate()}
          empty={<Note kind="info">No upcoming departures. Add one from the schedule.</Note>}
        >
          <Seg
            options={upcoming.slice(0, 6).map((d) => ({
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

      {active ? (
        <>
          <Kpis>
            <Kpi
              icon="🚪"
              label="Cabins sold"
              value={`${tiles.filter((t) => t.state === 'booked').length} / ${tiles.length}`}
              detail={`${active.availableCount} still free`}
            />
            <Kpi icon="👥" label="Guests aboard" value={guests} detail="From confirmed bookings" />
            <Kpi
              icon="⚓"
              label="Crew present"
              value={`${crewPresent} / ${crew.data?.length ?? 0}`}
              alert={Boolean(crew.data?.length && crewPresent < crew.data.length)}
              detail="Marked on the attendance page"
            />
            <Kpi
              icon="৳"
              label="Booked value"
              value={money(bookedValue.toFixed(2))}
              detail="What guests pay in total"
            />
          </Kpis>

          <div className="grid-2">
            <div className="stack">
              <Card
                title="Cabins"
                sub={`${active.package.route.name} · ${formatDate(active.startDate)}`}
              >
                <AsyncBlock
                  isLoading={boat.isLoading || bookings.isInitialLoading}
                  error={boat.error ?? bookings.error}
                  isEmpty={tiles.length === 0}
                  onRetry={() => boat.mutate()}
                  empty={
                    <Note kind="warn">
                      This boat has no cabins yet. Add decks and cabins from Boat setup.
                    </Note>
                  }
                >
                  <CabGrid cabins={tiles} />
                </AsyncBlock>
              </Card>

              <Card title="Manifest" sub="confirmed bookings only" flush>
                <TableWrap minWidth={620}>
                  <thead>
                    <tr>
                      <th>Cabin</th>
                      <th>Lead guest</th>
                      <th>Phone</th>
                      <th>Heads</th>
                      <th>Paid</th>
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
                      {bookings.items.map((b) => (
                        <tr key={b.id}>
                          <td className="t1">
                            {b.cabins.map((c) => c.cabin.name).join(', ') || '—'}
                          </td>
                          <td>{b.guests[0]?.name ?? b.customer.name ?? 'Guest'}</td>
                          <td className="t2">
                            {maskPhone(b.guests[0]?.phone ?? b.customer.phone)}
                          </td>
                          <td>{b.cabins.reduce((n, c) => n + c.occupancy, 0)}</td>
                          <td>
                            <Pill
                              tone={
                                Number(b.invoice?.amountPaid ?? 0) >=
                                Number(b.invoice?.displayTotal ?? 0)
                                  ? 'ok'
                                  : 'warn'
                              }
                            >
                              {money(b.invoice?.amountPaid ?? 0)}
                            </Pill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </AsyncTable>
                </TableWrap>
              </Card>
            </div>

            <div className="stack">
              <Card title="Crew today" flush>
                <TableWrap minWidth={0}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Present</th>
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
                        <p>Assign crew from the attendance page.</p>
                      </div>
                    }
                  >
                    <tbody>
                      {crew.data?.map((c) => (
                        <tr key={c.id}>
                          <td className="t1">{c.staff.account?.name ?? 'Crew'}</td>
                          <td>
                            <Pill tone={c.present ? 'ok' : 'warn'}>
                              {c.present ? 'present' : 'not aboard'}
                            </Pill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </AsyncTable>
                </TableWrap>
              </Card>

              <Card title="Trip">
                <Note kind="info">
                  Departure status is time-driven — scheduled becomes in progress and then
                  completed on its own. There is nothing to flip by hand.
                </Note>
              </Card>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
