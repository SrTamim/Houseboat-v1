'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import {
  PageHead,
  Card,
  Kpi,
  Kpis,
  FilterBar,
  Search,
  Note,
  TableWrap,
  AsyncTable,
  EmptyState,
} from '@/components/owner/ui';
import { BTN_O, BTN_SM } from '@/components/owner/buttons';
import { Pill } from '@/components/owner/Pill';
import { money, formatDate, maskPhone } from '@/lib/owner/format';

interface GuestsResponse {
  items: {
    accountId: string;
    name: string | null;
    phone: string;
    email: string | null;
    bookings: number;
    cancellations: number;
    lifetimeValue: string;
    lastTrip: string | null;
    openCredit: string;
    isRepeat: boolean;
  }[];
  total: number;
  offset: number;
  limit: number;
  summary: {
    guests: number;
    repeat: number;
    creditHeld: string;
    creditGuests: number;
  };
}

const PAGE = 50;

export default function OwnerGuestsPage() {
  const { boatId } = useActiveBoat();
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [downloading, setDownloading] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<GuestsResponse>(
    `/houseboats/${boatId}/guests?limit=${PAGE}&offset=${offset}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  const rows = data?.items ?? [];
  const s = data?.summary;

  async function downloadCsv() {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await api.get(`/houseboats/${boatId}/guests/export`, {
        params: q ? { q } : {},
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'guests.csv';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <PageHead
        title="Guests"
        desc="Everyone who has booked this boat, built from their bookings — there is no separate contact list to keep up to date."
        actions={
          <button
            className={BTN_O}
            onClick={downloadCsv}
            disabled={downloading || rows.length === 0}
          >
            {downloading ? 'Preparing…' : '⭳ Download CSV'}
          </button>
        }
      />

      <Kpis>
        <Kpi icon="👥" label="Guests" value={s?.guests ?? '—'} detail="Distinct customers" />
        <Kpi
          icon="🔁"
          label="Repeat guests"
          value={s?.repeat ?? '—'}
          detail={s?.guests ? `${Math.round(((s.repeat ?? 0) / s.guests) * 100)}% of guests` : undefined}
        />
        <Kpi
          icon="🎫"
          label="Credit held"
          value={s ? money(s.creditHeld) : '—'}
          detail={s ? `${s.creditGuests} guests` : undefined}
        />
      </Kpis>

      <FilterBar>
        <Search
          placeholder="Search name or phone…"
          value={q}
          onChange={(v) => {
            setQ(v);
            setOffset(0);
          }}
        />
      </FilterBar>

      <Card flush>
        <TableWrap minWidth={820}>
          <thead>
            <tr>
              <th>Guest</th>
              <th>Phone</th>
              <th>Trips</th>
              <th>Last trip</th>
              <th className="num">Lifetime</th>
              <th>Credit</th>
            </tr>
          </thead>
          <AsyncTable
            isLoading={isLoading}
            error={error}
            isEmpty={rows.length === 0}
            onRetry={() => mutate()}
            empty={
              <EmptyState
                icon="👥"
                title="No guests yet"
                message="Anyone who books this boat appears here automatically."
              />
            }
          >
            <tbody>
              {rows.map((g) => (
                <tr key={g.accountId}>
                  <td>
                    <div className="t1">
                      {g.name ?? 'Guest'}{' '}
                      {g.isRepeat ? <span className="tag">repeat</span> : null}
                    </div>
                    {g.cancellations > 0 ? (
                      <div className="t2">{g.cancellations} cancelled</div>
                    ) : null}
                  </td>
                  <td className="t2" data-label="Phone">{maskPhone(g.phone)}</td>
                  <td data-label="Trips">{g.bookings}</td>
                  <td className="t2" data-label="Last trip">{formatDate(g.lastTrip)}</td>
                  <td className="num" data-label="Lifetime">{money(g.lifetimeValue)}</td>
                  <td data-label="Credit">
                    {Number(g.openCredit) > 0 ? (
                      <Pill tone="amb">{money(g.openCredit)}</Pill>
                    ) : (
                      <span className="t2">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </AsyncTable>
        </TableWrap>

        {data && data.total > PAGE ? (
          <div
            style={{
              padding: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span className="t2">
              {offset + 1}–{Math.min(offset + PAGE, data.total)} of {data.total}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className={`${BTN_O} ${BTN_SM}`}
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE))}
              >
                Previous
              </button>
              <button
                className={`${BTN_O} ${BTN_SM}`}
                disabled={offset + PAGE >= data.total}
                onClick={() => setOffset(offset + PAGE)}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </Card>

      <Note kind="info" style={{ marginTop: 16 }}>
        Lifetime value counts money actually received, not billed. Credit is what this
        boat still owes a guest from an overpayment — it is spendable on their next
        booking.
      </Note>
    </>
  );
}
