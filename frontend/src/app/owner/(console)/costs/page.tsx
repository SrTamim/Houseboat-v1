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
  Search,
  Note,
  TableWrap,
  AsyncTable,
} from '@/components/owner/ui';
import { money, formatDate, normalizeDigits, apiErrorMessage } from '@/lib/owner/format';

interface Cost {
  id: string;
  date: string;
  description: string | null;
  amount: string;
  tripId: string | null;
  dueToVendor: string | null;
  paidByAccount: { name: string | null } | null;
}

const DAY_MS = 86_400_000;

const RANGES = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All' },
];

export default function OwnerCostsPage() {
  const { boatId } = useActiveBoat();
  const [range, setRange] = useState('month');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  const { data, error: loadError, isLoading, mutate } = useSWR<Cost[]>(
    `/houseboats/${boatId}/costs`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const rows = useMemo(() => {
    const all = data ?? [];
    const now = Date.now();
    const cutoff =
      range === 'week' ? now - 7 * DAY_MS : range === 'month' ? now - 30 * DAY_MS : 0;
    return all
      .filter((c) => (cutoff ? new Date(c.date).getTime() >= cutoff : true))
      .filter((c) =>
        q ? (c.description ?? '').toLowerCase().includes(q.toLowerCase()) : true,
      );
  }, [data, range, q]);

  const total = rows.reduce((s, c) => s + Number(c.amount), 0);

  async function addCost(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !amount) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/houseboats/${boatId}/costs`, {
        date,
        description: description || undefined,
        // Bangla numerals are accepted at the input layer so nobody has to
        // switch keyboards to log a bazar run.
        amount: Number(normalizeDigits(amount)),
      });
      setDescription('');
      setAmount('');
      await mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not log that cost.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="Costs"
        desc="One row, faster than a spreadsheet. No forced categories — write what it was for and move on."
      />

      {error ? (
        <Note kind="danger" style={{ marginBottom: 18 }}>
          {error}
        </Note>
      ) : null}

      <Card title="Quick add" style={{ marginBottom: 20 }}>
        <form
          onSubmit={addCost}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.4fr 1fr auto',
            gap: 10,
            alignItems: 'end',
          }}
        >
          <div className="field">
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>What for</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bazar — fish, vegetables"
            />
          </div>
          <div className="field">
            <label>Amount ৳</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="৩৫০০ or 3500"
              inputMode="numeric"
              required
            />
          </div>
          <button className="btn btn-b" type="submit" disabled={busy} style={{ height: 44 }}>
            {busy ? 'Adding…' : '＋ Add'}
          </button>
        </form>
      </Card>

      <FilterBar>
        <Seg options={RANGES} value={range} onChange={setRange} />
        <Search placeholder="Search description…" value={q} onChange={setQ} />
      </FilterBar>

      <Card flush>
        <TableWrap minWidth={680}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Paid by</th>
              <th className="num">Vendor due</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <AsyncTable
            isLoading={isLoading}
            error={loadError}
            isEmpty={rows.length === 0}
            onRetry={() => mutate()}
            empty={
              <div className="state">
                <div className="ic">🧾</div>
                <h4>No costs logged</h4>
                <p>Add fuel, bazar and repairs as they happen — reports read from here.</p>
              </div>
            }
          >
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="t2">{formatDate(c.date)}</td>
                  <td className="t1">{c.description ?? '—'}</td>
                  <td className="t2">{c.paidByAccount?.name ?? '—'}</td>
                  <td className="num">{c.dueToVendor ? money(c.dueToVendor) : '—'}</td>
                  <td className="num">{money(c.amount)}</td>
                </tr>
              ))}
            </tbody>
          </AsyncTable>
          {rows.length > 0 ? (
            <tfoot>
              <tr>
                <td colSpan={4}>
                  {RANGES.find((r) => r.value === range)?.label} total · {rows.length} entries
                </td>
                <td className="num">{money(total.toFixed(2))}</td>
              </tr>
            </tfoot>
          ) : null}
        </TableWrap>
      </Card>
    </>
  );
}
