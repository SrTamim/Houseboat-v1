'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import {
  PageHead,
  Card,
  FilterBar,
  Select,
  Search,
  Field,
  Note,
  TableWrap,
  AsyncTable,
  EmptyState,
} from '@/components/owner/ui';
import {
  BTN_B,
  BTN_O,
  BTN_SM,
  FIELD_BLOCK,
  FIELD_LABEL,
  STATEMENT_PRINT,
  STMT_HEAD,
  STMT_META,
  STMT_TOTAL,
} from '@/components/owner/styles';
import { Drawer } from '@/components/owner/Drawer';
import { money, formatDate, normalizeDigits, apiErrorMessage } from '@/lib/owner/format';

interface Cost {
  id: string;
  date: string;
  description: string | null;
  amount: string;
  tripId: string | null;
  comment: string | null;
  paidByAccount: { name: string | null } | null;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function OwnerCostsPage() {
  const { boat, boatId } = useActiveBoat();
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth())); // 0–11
  const [year, setYear] = useState(String(now.getFullYear()));
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = now.toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');

  // Edit drawer — null when closed.
  const [editing, setEditing] = useState<Cost | null>(null);
  const [eDate, setEDate] = useState('');
  const [eDescription, setEDescription] = useState('');
  const [eAmount, setEAmount] = useState('');
  const [eComment, setEComment] = useState('');

  // Cost-report drawer for print-to-PDF (same pattern as payroll's statement).
  const [showReport, setShowReport] = useState(false);

  const { data, error: loadError, isLoading, mutate } = useSWR<Cost[]>(
    `/houseboats/${boatId}/costs`,
    fetcher,
    { revalidateOnFocus: false },
  );

  // Year options: every year present in the data, plus the current year, newest first.
  const yearOptions = useMemo(() => {
    const years = new Set<number>([now.getFullYear()]);
    for (const c of data ?? []) {
      const y = new Date(c.date).getFullYear();
      if (Number.isFinite(y)) years.add(y);
    }
    return [...years].sort((a, b) => b - a).map((y) => String(y));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const rows = useMemo(() => {
    const m = Number(month);
    const y = Number(year);
    return (data ?? [])
      .filter((c) => {
        const d = new Date(c.date);
        return d.getMonth() === m && d.getFullYear() === y;
      })
      .filter((c) =>
        q ? (c.description ?? '').toLowerCase().includes(q.toLowerCase()) : true,
      );
  }, [data, month, year, q]);

  const total = rows.reduce((s, c) => s + Number(c.amount), 0);
  const periodLabel = `${MONTHS[Number(month)]} ${year}`;

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
        comment: comment || undefined,
      });
      setDescription('');
      setAmount('');
      setComment('');
      await mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not log that cost.'));
    } finally {
      setBusy(false);
    }
  }

  function openEdit(c: Cost) {
    setEditing(c);
    setEDate(c.date.slice(0, 10));
    setEDescription(c.description ?? '');
    setEAmount(c.amount);
    setEComment(c.comment ?? '');
    setError(null);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !editing || !eAmount) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/houseboats/${boatId}/costs/${editing.id}`, {
        date: eDate,
        description: eDescription || undefined,
        amount: Number(normalizeDigits(eAmount)),
        comment: eComment || undefined,
      });
      setEditing(null);
      await mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save that change.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="Costs"
        desc="One row, faster than a spreadsheet. No forced categories — write what it was for and move on."
        actions={
          <button
            className={BTN_O}
            onClick={() => setShowReport(true)}
            disabled={rows.length === 0}
          >
            ⇩ Download PDF
          </button>
        }
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
            gridTemplateColumns: '1fr 1.4fr 1fr 1.4fr auto',
            gap: 10,
            alignItems: 'end',
          }}
        >
          <div className={FIELD_BLOCK}>
            <label className={FIELD_LABEL}>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className={FIELD_BLOCK}>
            <label className={FIELD_LABEL}>What for</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bazar — fish, vegetables"
            />
          </div>
          <div className={FIELD_BLOCK}>
            <label className={FIELD_LABEL}>Cost ৳</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="৩৫০০ or 3500"
              inputMode="numeric"
              required
            />
          </div>
          <div className={FIELD_BLOCK}>
            <label className={FIELD_LABEL}>Comment</label>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional note"
            />
          </div>
          <button className={BTN_B} type="submit" disabled={busy} style={{ height: 44 }}>
            {busy ? 'Adding…' : '＋ Add'}
          </button>
        </form>
      </Card>

      <FilterBar>
        <Select
          ariaLabel="Month"
          value={month}
          onChange={setMonth}
          options={MONTHS.map((m, i) => ({ value: String(i), label: m }))}
        />
        <Select ariaLabel="Year" value={year} onChange={setYear} options={yearOptions} />
        <Search placeholder="Search description…" value={q} onChange={setQ} />
      </FilterBar>

      <Card flush>
        <TableWrap minWidth={680}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Paid by</th>
              <th>Comment</th>
              <th className="num">Amount</th>
              <th className="num"></th>
            </tr>
          </thead>
          <AsyncTable
            isLoading={isLoading}
            error={loadError}
            isEmpty={rows.length === 0}
            onRetry={() => mutate()}
            empty={
              <EmptyState
                icon="🧾"
                title={`No costs in ${periodLabel}`}
                message="Add fuel, bazar and repairs as they happen — reports read from here."
              />
            }
          >
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="t2">{formatDate(c.date)}</td>
                  <td className="t1">{c.description ?? '—'}</td>
                  <td className="t2">{c.paidByAccount?.name ?? '—'}</td>
                  <td className="t2">{c.comment ?? '—'}</td>
                  <td className="num">{money(c.amount)}</td>
                  <td className="num">
                    <button className={`${BTN_O} ${BTN_SM}`} onClick={() => openEdit(c)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </AsyncTable>
          {rows.length > 0 ? (
            <tfoot>
              <tr>
                <td colSpan={4}>
                  {periodLabel} total · {rows.length} entries
                </td>
                <td className="num">{money(total.toFixed(2))}</td>
                <td className="num"></td>
              </tr>
            </tfoot>
          ) : null}
        </TableWrap>
      </Card>

      {/*
        Cost report for print-to-PDF. Rendered inside a Drawer — the same path
        payroll's statement uses — so it escapes the .content > * entry animation
        (an ancestor transform would trap the print block and blank the page).
      */}
      <Drawer
        open={showReport}
        title="Cost report"
        onClose={() => setShowReport(false)}
        footer={
          <>
            <button className={BTN_O} onClick={() => setShowReport(false)}>
              Close
            </button>
            <button className={BTN_B} onClick={() => window.print()}>
              Download PDF
            </button>
          </>
        }
      >
        <div className={STATEMENT_PRINT}>
          <div className={STMT_HEAD}>
            <h3>Cost Report</h3>
            <div className={STMT_META}>
              <div>
                <strong>{boat.name}</strong>
              </div>
              <div className="t2">{periodLabel}</div>
              <div className="t2">Generated {formatDate(new Date())}</div>
            </div>
          </div>
          <TableWrap minWidth={560}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Paid by</th>
                <th>Comment</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="t1">{formatDate(c.date)}</td>
                  <td>{c.description ?? '—'}</td>
                  <td className="t2">{c.paidByAccount?.name ?? '—'}</td>
                  <td className="t2">{c.comment ?? '—'}</td>
                  <td className="num">{money(c.amount)}</td>
                </tr>
              ))}
              <tr className={STMT_TOTAL}>
                <td colSpan={4} className="t1">
                  Total · {rows.length} entries
                </td>
                <td className="num">{money(total.toFixed(2))}</td>
              </tr>
            </tbody>
          </TableWrap>
        </div>
      </Drawer>

      <Drawer
        open={editing !== null}
        title="Edit cost"
        onClose={() => setEditing(null)}
        footer={
          <>
            <button className={BTN_O} onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button className={BTN_B} onClick={saveEdit} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <form onSubmit={saveEdit} style={{ display: 'grid', gap: 12 }}>
          <Field label="Date">
            <input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} />
          </Field>
          <Field label="What for">
            <input
              value={eDescription}
              onChange={(e) => setEDescription(e.target.value)}
              placeholder="Bazar — fish, vegetables"
            />
          </Field>
          <Field label="Cost ৳">
            <input
              value={eAmount}
              onChange={(e) => setEAmount(e.target.value)}
              inputMode="numeric"
              required
            />
          </Field>
          <Field label="Comment">
            <input
              value={eComment}
              onChange={(e) => setEComment(e.target.value)}
              placeholder="Optional note"
            />
          </Field>
        </form>
      </Drawer>
    </>
  );
}
