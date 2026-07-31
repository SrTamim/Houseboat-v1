'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import {
  PageHead,
  Card,
  Kpi,
  Kpis,
  FilterBar,
  Seg,
  Field,
  Note,
  TableWrap,
  AsyncTable,
} from '@/components/owner/ui';
import { Pill } from '@/components/owner/Pill';
import { Drawer } from '@/components/owner/Drawer';
import { money, formatDate, apiErrorMessage } from '@/lib/owner/format';

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

function recentPeriods(count: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function periodLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  });
}

export default function OwnerPayrollPage() {
  const { boatId } = useActiveBoat();
  const periods = recentPeriods(3);
  const [period, setPeriod] = useState(periods[0]);
  const [runFor, setRunFor] = useState<Staff | null>(null);
  const [bonus, setBonus] = useState('');
  const [deduction, setDeduction] = useState('');
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

  async function runPayroll(e: React.FormEvent) {
    e.preventDefault();
    if (!runFor || busyId) return;
    setBusyId(runFor.id);
    setError(null);
    try {
      await api.post(`/houseboats/${boatId}/staff/${runFor.id}/payroll`, {
        period,
        bonus: bonus ? Number(bonus) : undefined,
        deduction: deduction ? Number(deduction) : undefined,
      });
      await refreshStaffPayroll(runFor.id);
      setRunFor(null);
      setBonus('');
      setDeduction('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not run payroll for this person.'));
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
  const unpaid = forPeriod.filter((r) => r.payroll && !r.payroll.paid);
  const paid = forPeriod.filter((r) => r.payroll?.paid);
  const total = forPeriod.reduce((s, r) => s + Number(r.payroll?.totalAmount ?? 0), 0);

  return (
    <>
      <PageHead
        title="Payroll"
        desc="Run wages for a month, then track who has actually been handed their money. Both steps are recorded — a run is not a payment."
        actions={
          <FilterBar>
            <Seg
              options={periods.map((p) => ({ value: p, label: periodLabel(p) })).reverse()}
              value={period}
              onChange={setPeriod}
            />
          </FilterBar>
        }
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
          detail={`${forPeriod.filter((r) => r.payroll).length} of ${list.length} run`}
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

      <Card flush>
        <TableWrap minWidth={860}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Basis</th>
              <th>Trips</th>
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
            isEmpty={list.length === 0}
            onRetry={() => staff.mutate()}
            empty={
              <div className="state">
                <div className="ic">💰</div>
                <h4>No crew to pay</h4>
                <p>Add crew before running payroll.</p>
              </div>
            }
          >
            <tbody>
              {forPeriod.map(({ staff: s, payroll }) => (
                <tr key={s.id}>
                  <td className="t1">{s.account?.name ?? 'Crew'}</td>
                  <td>
                    <Pill tone={s.monthlySalary ? 'blue' : 'mut'}>
                      {s.monthlySalary ? 'salary' : 'per trip'}
                    </Pill>
                  </td>
                  <td>{payroll?.tripsWorked ?? '—'}</td>
                  <td className="num">{payroll ? money(payroll.baseAmount) : '—'}</td>
                  <td className="num">{payroll ? money(payroll.bonus) : '—'}</td>
                  <td className={`num${payroll && Number(payroll.deduction) > 0 ? ' neg' : ''}`}>
                    {payroll ? money(payroll.deduction) : '—'}
                  </td>
                  <td className="num">{payroll ? money(payroll.totalAmount) : '—'}</td>
                  <td>
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
                          className="btn btn-sm btn-o"
                          onClick={() => setRunFor(s)}
                          disabled={busyId === s.id}
                        >
                          Run
                        </button>
                      ) : !payroll.paid ? (
                        <button
                          className="btn btn-sm btn-ok"
                          onClick={() => markPaid(payroll)}
                          disabled={busyId === payroll.id}
                        >
                          {busyId === payroll.id ? 'Saving…' : 'Mark paid'}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </AsyncTable>
        </TableWrap>
      </Card>

      <Drawer
        open={runFor !== null}
        title={`Run payroll · ${runFor?.account?.name ?? 'Crew'}`}
        onClose={() => setRunFor(null)}
        footer={
          <>
            <button className="btn btn-o" onClick={() => setRunFor(null)}>
              Cancel
            </button>
            <button className="btn btn-b" onClick={runPayroll} disabled={busyId !== null}>
              {busyId ? 'Running…' : `Run for ${periodLabel(period)}`}
            </button>
          </>
        }
      >
        <form onSubmit={runPayroll} style={{ display: 'grid', gap: 12 }}>
          <Note kind="info">
            The base amount is calculated for you — monthly salary, or the per-trip rate
            times the trips actually worked in {periodLabel(period)}.
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
        </form>
      </Drawer>
    </>
  );
}
