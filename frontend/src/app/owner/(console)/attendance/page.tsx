'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import {
  PageHead,
  Card,
  FilterBar,
  TableWrap,
  AsyncTable,
} from '@/components/owner/ui';
import { Pill } from '@/components/owner/Pill';
import { maskPhone } from '@/lib/owner/format';

interface Row {
  staffId: string;
  name: string | null;
  phone: string | null;
  role: string | null;
  tripsWorked: number;
  leaveDays: number;
}

interface Report {
  period: string;
  crew: Row[];
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Descending years from the current one back to 2023, for the year dropdown. */
function yearOptions(): number[] {
  const now = new Date().getUTCFullYear();
  const out: number[] = [];
  for (let y = now; y >= 2023; y--) out.push(y);
  return out;
}

/** "2026-08" → "Aug 2026". */
function periodLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  });
}

export default function OwnerAttendancePage() {
  const { boatId } = useActiveBoat();
  const now = new Date();
  const years = useMemo(() => yearOptions(), []);
  const [month, setMonth] = useState(now.getUTCMonth() + 1); // 1–12
  const [year, setYear] = useState(now.getUTCFullYear());
  const [search, setSearch] = useState('');
  const period = `${year}-${String(month).padStart(2, '0')}`;

  const report = useSWR<Report>(
    `/houseboats/${boatId}/attendance?period=${period}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const allRows = report.data?.crew ?? [];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter((r) =>
      [r.name, r.role, r.phone].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [allRows, search]);

  return (
    <>
      <PageHead
        title="Attendance"
        desc="Monthly crew record: trips worked and days on leave per person. Presence is marked on the Departures page; this is the report."
      />

      <FilterBar>
        <select
          aria-label="Month"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
        >
          {MONTHS.map((name, i) => (
            <option key={i} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Year"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <input
          type="search"
          aria-label="Search crew"
          placeholder="Search name, role or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </FilterBar>

      <Card title="Crew" sub={periodLabel(period)} flush>
        <TableWrap minWidth={620}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th className="num">Trips worked</th>
              <th className="num">Days on leave</th>
            </tr>
          </thead>
          <AsyncTable
            isLoading={report.isLoading}
            error={report.error}
            isEmpty={rows.length === 0}
            onRetry={() => report.mutate()}
            empty={
              <div className="px-6 py-11 text-center text-muted">
                <div className="mb-2.5 text-[26px]">{search ? '🔍' : '⚓'}</div>
                <h4 className="mb-1.5 text-[15px] text-ink">
                  {search ? 'No crew match your search' : 'No crew on this boat'}
                </h4>
                <p className="mx-auto max-w-[46ch] text-[13px] leading-[1.55]">
                  {search
                    ? 'Try a different name, role or phone.'
                    : 'Add crew, then their monthly record shows up here.'}
                </p>
              </div>
            }
          >
            <tbody>
              {rows.map((r) => (
                <tr key={r.staffId}>
                  <td>
                    <div className="t1">{r.name ?? 'Crew'}</div>
                    <div className="t2">{maskPhone(r.phone ?? undefined)}</div>
                  </td>
                  <td className="t2">{r.role ?? '—'}</td>
                  <td className="num">{r.tripsWorked}</td>
                  <td className="num">
                    {r.leaveDays > 0 ? (
                      <Pill tone="amb">{r.leaveDays}</Pill>
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
    </>
  );
}
