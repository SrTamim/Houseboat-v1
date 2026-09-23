'use client';

import { useEffect, useMemo, useState } from 'react';
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
  Select,
  Field,
  Note,
  TableWrap,
  AsyncTable,
} from '@/components/owner/ui';
import {
  BTN_B,
  BTN_O,
  BTN_OK,
  BTN_SM,
  CHECK,
  LINKLIKE,
  STATEMENT_PRINT,
  STMT_HEAD,
  STMT_META,
  STMT_TOTAL,
} from '@/components/owner/styles';
import { Pill } from '@/components/owner/Pill';
import { Drawer } from '@/components/owner/Drawer';
import { money, formatDate, maskPhone, apiErrorMessage } from '@/lib/owner/format';

interface Staff {
  id: string;
  perTripRate: string | null;
  monthlySalary: string | null;
  account: { name: string | null; phone: string } | null;
}

interface Payroll {
  id: string;
  period: string;
  tripsWorked: number | null;
  baseAmount: string;
  bonus: string;
  deduction: string;
  totalAmount: string;
  paid: boolean;
  paidAt: string | null;
  staffId: string;
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

// The drawer serves two jobs off one bit of state: first-time Calculate, or
// Adjust of an existing record.
type DrawerState =
  | { mode: 'calculate'; staff: Staff }
  | { mode: 'adjust'; staff: Staff; payroll: Payroll }
  | null;

export default function OwnerPayrollPage() {
  const { boatId } = useActiveBoat();
  const now = new Date();
  const years = useMemo(() => yearOptions(), []);
  const [month, setMonth] = useState(now.getUTCMonth() + 1); // 1–12
  const [year, setYear] = useState(now.getUTCFullYear());
  const [search, setSearch] = useState('');
  const period = `${year}-${String(month).padStart(2, '0')}`;

  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [bonus, setBonus] = useState('');
  const [deduction, setDeduction] = useState('');
  const [markUnpaid, setMarkUnpaid] = useState(false);
  const [statementFor, setStatementFor] = useState<Staff | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const staff = useSWR<Staff[]>(`/houseboats/${boatId}/staff`, fetcher, {
    revalidateOnFocus: false,
  });

  // Payroll is stored per staff member, so the page fans out one call each and
  // stitches the month together client-side.
  const [rows, setRows] = useState<Record<string, Payroll[]>>({});
  const [loadingRows, setLoadingRows] = useState(false);

  useEffect(() => {
    const list = staff.data;
    if (!list || list.length === 0) {
      setRows({});
      return;
    }
    let cancelled = false;
    setLoadingRows(true);
    Promise.all(
      list.map((s) =>
        fetcher<Payroll[]>(`/houseboats/${boatId}/staff/${s.id}/payroll`)
          .then((r) => [s.id, r] as const)
          .catch(() => [s.id, [] as Payroll[]] as const),
      ),
    )
      .then((pairs) => {
        if (cancelled) return;
        setRows(Object.fromEntries(pairs));
      })
      .finally(() => {
        if (!cancelled) setLoadingRows(false);
      });
    return () => {
      cancelled = true;
    };
  }, [staff.data, boatId]);

  async function refreshStaffPayroll(staffId: string) {
    const fresh = await fetcher<Payroll[]>(`/houseboats/${boatId}/staff/${staffId}/payroll`);
    setRows((prev) => ({ ...prev, [staffId]: fresh }));
  }

  function openCalculate(s: Staff) {
    setBonus('');
    setDeduction('');
    setMarkUnpaid(false);
    setError(null);
    setDrawer({ mode: 'calculate', staff: s });
  }

  function openAdjust(s: Staff, payroll: Payroll) {
    setBonus(payroll.bonus && Number(payroll.bonus) ? payroll.bonus : '');
    setDeduction(payroll.deduction && Number(payroll.deduction) ? payroll.deduction : '');
    setMarkUnpaid(false);
    setError(null);
    setDrawer({ mode: 'adjust', staff: s, payroll });
  }

  async function submitDrawer(e: React.FormEvent) {
    e.preventDefault();
    if (!drawer || busyId) return;
    const s = drawer.staff;
    setBusyId(s.id);
    setError(null);
    try {
      if (drawer.mode === 'calculate') {
        await api.post(`/houseboats/${boatId}/staff/${s.id}/payroll`, {
          period,
          bonus: bonus ? Number(bonus) : undefined,
          deduction: deduction ? Number(deduction) : undefined,
        });
      } else {
        await api.patch(`/houseboats/${boatId}/payroll/${drawer.payroll.id}`, {
          bonus: bonus ? Number(bonus) : 0,
          deduction: deduction ? Number(deduction) : 0,
          ...(drawer.payroll.paid && markUnpaid ? { paid: false } : {}),
        });
      }
      await refreshStaffPayroll(s.id);
      setDrawer(null);
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          drawer.mode === 'calculate'
            ? 'Could not calculate payroll for this person.'
            : 'Could not adjust this payroll.',
        ),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function markPaid(payroll: Payroll) {
    if (busyId) return;
    setBusyId(payroll.id);
    setError(null);
    try {
      await api.post(`/houseboats/${boatId}/payroll/${payroll.id}/paid`);
      await refreshStaffPayroll(payroll.staffId);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not mark that wage as paid.'));
    } finally {
      setBusyId(null);
    }
  }

  const list = staff.data ?? [];
  const forPeriod = list.map((s) => ({
    staff: s,
    payroll: (rows[s.id] ?? []).find((p) => p.period === period) ?? null,
  }));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return forPeriod;
    return forPeriod.filter(({ staff: s, payroll }) => {
      const basis = s.monthlySalary ? 'salary' : 'per trip';
      const paidState = payroll ? (payroll.paid ? 'paid' : 'unpaid') : 'not run';
      return [s.account?.name, s.account?.phone, basis, paidState].some((v) =>
        v?.toLowerCase().includes(q),
      );
    });
  }, [forPeriod, search]);

  const unpaid = filtered.filter((r) => r.payroll && !r.payroll.paid);
  const paid = filtered.filter((r) => r.payroll?.paid);
  const total = filtered.reduce((s, r) => s + Number(r.payroll?.totalAmount ?? 0), 0);

  const drawerStaff = drawer?.staff ?? null;

  return (
    <>
      <PageHead
        title="Payroll"
        desc="Calculate wages for a month, then track who has actually been handed their money. Both steps are recorded — a calculation is not a payment."
      />

      {error ? (
        <Note kind="danger" style={{ marginBottom: 18 }}>
          {error}
        </Note>
      ) : null}

      <Kpis>
        <Kpi
          icon="💰"
          label={`${periodLabel(period)} total`}
          value={money(total.toFixed(2))}
          detail={`${filtered.filter((r) => r.payroll).length} of ${filtered.length} calculated`}
        />
        <Kpi
          icon="⏳"
          label="Unpaid"
          value={unpaid.length}
          alert={unpaid.length > 0}
          detail={money(
            unpaid.reduce((s, r) => s + Number(r.payroll?.totalAmount ?? 0), 0).toFixed(2),
          )}
        />
        <Kpi
          icon="✓"
          label="Paid"
          value={paid.length}
          detail={money(
            paid.reduce((s, r) => s + Number(r.payroll?.totalAmount ?? 0), 0).toFixed(2),
          )}
        />
      </Kpis>

      <FilterBar>
        <Select
          ariaLabel="Month"
          value={String(month)}
          onChange={(v) => setMonth(Number(v))}
          options={MONTHS.map((name, i) => ({ value: String(i + 1), label: name }))}
        />
        <Select
          ariaLabel="Year"
          value={String(year)}
          onChange={(v) => setYear(Number(v))}
          options={years.map((y) => ({ value: String(y), label: String(y) }))}
        />
        <Search
          placeholder="Search name, phone, basis or status…"
          value={search}
          onChange={setSearch}
        />
      </FilterBar>

      <Card title="Crew" sub={periodLabel(period)} flush>
        <TableWrap minWidth={920}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Basis</th>
              <th className="num">Trips</th>
              <th className="num">Base</th>
              <th className="num">Bonus</th>
              <th className="num">Deduct</th>
              <th className="num">Total</th>
              <th>Paid</th>
              <th />
            </tr>
          </thead>
          <AsyncTable
            isLoading={staff.isLoading || loadingRows}
            error={staff.error}
            isEmpty={filtered.length === 0}
            onRetry={() => staff.mutate()}
            empty={
              <div className="px-6 py-11 text-center text-muted">
                <div className="mb-2.5 text-[26px]">{search ? '🔍' : '💰'}</div>
                <h4 className="mb-1.5 text-[15px] text-ink">
                  {search ? 'No crew match your search' : 'No crew to pay'}
                </h4>
                <p className="mx-auto max-w-[46ch] text-[13px] leading-[1.55]">
                  {search
                    ? 'Try a different name, phone, basis or status.'
                    : 'Add crew before calculating payroll.'}
                </p>
              </div>
            }
          >
            <tbody>
              {filtered.map(({ staff: s, payroll }) => (
                <tr key={s.id}>
                  <td className="t1">
                    <button
                      className={LINKLIKE}
                      onClick={() => setStatementFor(s)}
                      title="View salary statement"
                    >
                      {s.account?.name ?? 'Crew'}
                    </button>
                  </td>
                  <td data-label="Basis">
                    <Pill tone={s.monthlySalary ? 'blue' : 'mut'}>
                      {s.monthlySalary ? 'salary' : 'per trip'}
                    </Pill>
                  </td>
                  <td className="num" data-label="Trips">{payroll?.tripsWorked ?? '—'}</td>
                  <td className="num" data-label="Base">{payroll ? money(payroll.baseAmount) : '—'}</td>
                  <td className="num" data-label="Bonus">{payroll ? money(payroll.bonus) : '—'}</td>
                  <td className={`num${payroll && Number(payroll.deduction) > 0 ? ' neg' : ''}`} data-label="Deduct">
                    {payroll ? money(payroll.deduction) : '—'}
                  </td>
                  <td className="num" data-label="Total">{payroll ? money(payroll.totalAmount) : '—'}</td>
                  <td data-label="Paid">
                    {payroll ? (
                      <Pill tone={payroll.paid ? 'ok' : 'warn'}>
                        {payroll.paid ? `paid ${formatDate(payroll.paidAt)}` : 'unpaid'}
                      </Pill>
                    ) : (
                      <Pill tone="mut">not run</Pill>
                    )}
                  </td>
                  <td>
                    <div className="rowact">
                      {!payroll ? (
                        <button
                          className={`${BTN_B} ${BTN_SM}`}
                          onClick={() => openCalculate(s)}
                          disabled={busyId === s.id}
                        >
                          Calculate
                        </button>
                      ) : (
                        <>
                          {!payroll.paid ? (
                            <button
                              className={`${BTN_OK} ${BTN_SM}`}
                              onClick={() => markPaid(payroll)}
                              disabled={busyId === payroll.id}
                            >
                              {busyId === payroll.id ? 'Saving…' : 'Mark as paid'}
                            </button>
                          ) : null}
                          <button
                            className={`${BTN_O} ${BTN_SM}`}
                            onClick={() => openAdjust(s, payroll)}
                            disabled={busyId === payroll.id}
                          >
                            Adjust
                          </button>
                        </>
                      )}
                      <button
                        className={`${BTN_O} ${BTN_SM}`}
                        onClick={() => setStatementFor(s)}
                      >
                        Statement
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </AsyncTable>
        </TableWrap>
      </Card>

      <Drawer
        open={drawer !== null}
        title={
          drawer?.mode === 'adjust'
            ? `Adjust payroll · ${drawerStaff?.account?.name ?? 'Crew'}`
            : `Calculate payroll · ${drawerStaff?.account?.name ?? 'Crew'}`
        }
        onClose={() => setDrawer(null)}
        footer={
          <>
            <button className={BTN_O} onClick={() => setDrawer(null)}>
              Cancel
            </button>
            <button
              className={BTN_B}
              onClick={submitDrawer}
              disabled={busyId !== null}
            >
              {busyId
                ? 'Saving…'
                : drawer?.mode === 'adjust'
                  ? 'Save changes'
                  : `Calculate for ${periodLabel(period)}`}
            </button>
          </>
        }
      >
        <form onSubmit={submitDrawer} style={{ display: 'grid', gap: 12 }}>
          <Note kind="info">
            {drawer?.mode === 'adjust'
              ? 'The base amount is fixed — edit the bonus or deduction and the total is recalculated.'
              : `The base amount is calculated for you — monthly salary, or the per-trip rate times the trips actually worked in ${periodLabel(period)}.`}
          </Note>
          <Field label="Bonus (৳)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={bonus}
              onChange={(e) => setBonus(e.target.value)}
            />
          </Field>
          <Field label="Deduction (৳)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={deduction}
              onChange={(e) => setDeduction(e.target.value)}
            />
          </Field>
          {drawer?.mode === 'adjust' && drawer.payroll.paid ? (
            <label className={CHECK}>
              <input
                type="checkbox"
                checked={markUnpaid}
                onChange={(e) => setMarkUnpaid(e.target.checked)}
              />
              <span>Revert to unpaid (marked paid by mistake)</span>
            </label>
          ) : null}
        </form>
      </Drawer>

      {statementFor ? (
        <StatementDrawer
          staff={statementFor}
          history={rows[statementFor.id] ?? []}
          onClose={() => setStatementFor(null)}
        />
      ) : null}
    </>
  );
}

/**
 * Bank-statement-style salary history for one crew member. "Download PDF" uses
 * the browser's print-to-PDF: the Drawer's Tailwind `print:` classes hide the
 * console chrome and flatten the panel, so Save-as-PDF yields a clean sheet.
 */
function StatementDrawer({
  staff,
  history,
  onClose,
}: {
  staff: Staff;
  history: Payroll[];
  onClose: () => void;
}) {
  // Oldest → newest so the running balance reads like a bank statement.
  const ordered = [...history].sort((a, b) => a.period.localeCompare(b.period));
  let running = 0;
  const lines = ordered.map((p) => {
    running += Number(p.totalAmount);
    return { p, running };
  });
  const totalPaid = ordered
    .filter((p) => p.paid)
    .reduce((s, p) => s + Number(p.totalAmount), 0);

  return (
    <Drawer
      open
      title={`Statement · ${staff.account?.name ?? 'Crew'}`}
      onClose={onClose}
      footer={
        <>
          <button className={BTN_O} onClick={onClose}>
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
          <h3>Salary Statement</h3>
          <div className={STMT_META}>
            <div>
              <strong>{staff.account?.name ?? 'Crew'}</strong>
            </div>
            <div className="t2">{maskPhone(staff.account?.phone)}</div>
            <div className="t2">
              {staff.monthlySalary
                ? `Salary · ${money(staff.monthlySalary)}/mo`
                : `Per trip · ${money(staff.perTripRate)}/trip`}
            </div>
            <div className="t2">Generated {formatDate(new Date())}</div>
          </div>
        </div>

        {ordered.length === 0 ? (
          <Note kind="info">No payroll history yet for this crew member.</Note>
        ) : (
          <TableWrap minWidth={560}>
            <thead>
              <tr>
                <th>Period</th>
                <th className="num">Trips</th>
                <th className="num">Base</th>
                <th className="num">Bonus</th>
                <th className="num">Deduct</th>
                <th className="num">Total</th>
                <th>Status</th>
                <th className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(({ p, running: bal }) => (
                <tr key={p.id}>
                  <td className="t1">{periodLabel(p.period)}</td>
                  <td className="num" data-label="Trips">{p.tripsWorked ?? '—'}</td>
                  <td className="num" data-label="Base">{money(p.baseAmount)}</td>
                  <td className="num" data-label="Bonus">{money(p.bonus)}</td>
                  <td className={`num${Number(p.deduction) > 0 ? ' neg' : ''}`} data-label="Deduct">
                    {money(p.deduction)}
                  </td>
                  <td className="num" data-label="Total">{money(p.totalAmount)}</td>
                  <td data-label="Status">
                    <Pill tone={p.paid ? 'ok' : 'warn'}>
                      {p.paid ? `paid ${formatDate(p.paidAt)}` : 'unpaid'}
                    </Pill>
                  </td>
                  <td className="num" data-label="Balance">{money(bal.toFixed(2))}</td>
                </tr>
              ))}
              <tr className={STMT_TOTAL}>
                <td colSpan={5} className="t1">
                  Total earned
                </td>
                <td className="num">{money(running.toFixed(2))}</td>
                <td className="t2">paid {money(totalPaid.toFixed(2))}</td>
                <td className="num">{money((running - totalPaid).toFixed(2))}</td>
              </tr>
            </tbody>
          </TableWrap>
        )}
      </div>
    </Drawer>
  );
}
