'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import { PageHead, Card, FilterBar, AsyncBlock } from '@/components/owner/ui';

interface CalendarResponse {
  month: string;
  operatingDates: string[];
  departures: {
    id: string;
    date: string;
    endDate: string | null;
    label: string | null;
    durationDays: number;
    profile: string | null;
    status: string;
    cabinsSold: number;
    cabinsTotal: number;
  }[];
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** YYYY-MM for `offset` months from now. */
function monthKey(offset: number): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + offset);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
}

/** Fill tone for a departure chip, by how full the trip is. */
function fillTone(sold: number, total: number): string {
  if (total === 0) return 'mut';
  const pct = sold / total;
  if (pct >= 0.9) return 'ok';
  if (pct >= 0.4) return 'warn';
  return 'danger';
}

export default function OwnerCalendarPage() {
  const { boatId } = useActiveBoat();
  const [month, setMonth] = useState(() => monthKey(0));

  const { data, error, isLoading, mutate } = useSWR<CalendarResponse>(
    `/houseboats/${boatId}/calendar?month=${month}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const [year, mon] = month.split('-').map(Number);
  const firstDow = new Date(Date.UTC(year, mon - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const todayKey = new Date().toISOString().slice(0, 10);

  const operating = new Set(data?.operatingDates ?? []);
  const byDate = new Map<string, CalendarResponse['departures']>();
  for (const dep of data?.departures ?? []) {
    byDate.set(dep.date, [...(byDate.get(dep.date) ?? []), dep]);
  }

  return (
    <>
      <PageHead
        title="Trip calendar"
        desc={
          <>
            Only dates in your <b>operating dates</b> generate bookable departures.
            Everything else is invisible to customers. Status is time-driven — there is
            nothing to flip by hand.
          </>
        }
        actions={
          <>
            <Link className="btn btn-o" href="/owner/schedule">
              Schedule editor
            </Link>
            <Link className="btn btn-b" href="/owner/profile">
              Edit operating dates
            </Link>
          </>
        }
      />

      <FilterBar>
        <div className="seg">
          {[0, 1, 2].map((offset) => {
            const key = monthKey(offset);
            return (
              <button
                key={key}
                type="button"
                className={`seg-b${key === month ? ' on' : ''}`}
                onClick={() => setMonth(key)}
              >
                {monthLabel(key).split(' ')[0]}
              </button>
            );
          })}
        </div>
        <span className="tag">● 90%+ sold</span>
        <span className="tag">● part sold</span>
        <span className="tag">● nearly empty</span>
        <span className="tag">● not operating</span>
      </FilterBar>

      <Card title={monthLabel(month)} sub={`${data?.departures.length ?? 0} departures`}>
        <AsyncBlock isLoading={isLoading} error={error} onRetry={() => mutate()}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7,1fr)',
              gap: 8,
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '.05em',
              color: 'var(--muted)',
              marginBottom: 8,
            }}
          >
            {DOW.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 8 }}>
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={`pad-${i}`} style={{ minHeight: 92 }} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const key = `${month}-${String(day).padStart(2, '0')}`;
              const trips = byDate.get(key) ?? [];
              const isOperating = operating.has(key);
              const isToday = key === todayKey;

              return (
                <div
                  key={key}
                  style={{
                    minHeight: 92,
                    border: isToday ? '2px solid var(--blue)' : '1px solid var(--hair)',
                    borderRadius: 10,
                    padding: 8,
                    background: isOperating ? 'var(--raise-1)' : 'var(--field)',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 800,
                      color: isToday ? 'var(--blue)' : 'var(--ink)',
                      fontSize: 13,
                    }}
                  >
                    {day}
                    {isToday ? ' · today' : ''}
                  </div>

                  {trips.length > 0 ? (
                    trips.map((t) => {
                      const tone = fillTone(t.cabinsSold, t.cabinsTotal);
                      return (
                        <Link
                          key={t.id}
                          href="/owner/schedule"
                          style={{
                            display: 'block',
                            marginTop: 5,
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 5,
                            background:
                              tone === 'mut'
                                ? 'var(--chip)'
                                : `color-mix(in srgb, var(--${tone}) 13%, transparent)`,
                            color: tone === 'mut' ? 'var(--muted)' : `var(--${tone})`,
                          }}
                        >
                          {t.label ?? `${t.durationDays}d`} · {t.cabinsSold}/{t.cabinsTotal}
                        </Link>
                      );
                    })
                  ) : (
                    <div style={{ marginTop: 5, fontSize: 10, color: 'var(--muted)' }}>
                      {isOperating ? 'no departure' : 'not operating'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </AsyncBlock>
      </Card>
    </>
  );
}
