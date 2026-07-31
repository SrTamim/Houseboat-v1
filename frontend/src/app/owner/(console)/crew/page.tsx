'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import {
  PageHead,
  Card,
  Field,
  Note,
  TableWrap,
  AsyncTable,
} from '@/components/owner/ui';
import { Pill } from '@/components/owner/Pill';
import { Drawer } from '@/components/owner/Drawer';
import { money, maskPhone, apiErrorMessage, toE164 } from '@/lib/owner/format';

interface Staff {
  id: string;
  nid: string | null;
  emergencyContact: string | null;
  perTripRate: string | null;
  monthlySalary: string | null;
  account: { id: string; name: string | null; phone: string } | null;
  role: { id: string; name: string } | null;
}

export default function OwnerCrewPage() {
  const { boatId } = useActiveBoat();
  const [open, setOpen] = useState(false);
  const [leaveFor, setLeaveFor] = useState<Staff | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [phone, setPhone] = useState('');
  const [nid, setNid] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [payKind, setPayKind] = useState<'per_trip' | 'salary'>('per_trip');
  const [rate, setRate] = useState('');

  const [leaveState, setLeaveState] = useState('on_leave');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data, error: loadError, isLoading, mutate } = useSWR<Staff[]>(
    `/houseboats/${boatId}/staff`,
    fetcher,
    { revalidateOnFocus: false },
  );

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !phone) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/houseboats/${boatId}/staff`, {
        phone: toE164(phone),
        nid: nid || undefined,
        emergencyContact: emergencyContact || undefined,
        perTripRate: payKind === 'per_trip' && rate ? Number(rate) : undefined,
        monthlySalary: payKind === 'salary' && rate ? Number(rate) : undefined,
      });
      setOpen(false);
      setPhone('');
      setNid('');
      setEmergencyContact('');
      setRate('');
      await mutate();
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          'Could not add that person. They need an account on this phone number first.',
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function setLeave(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !leaveFor) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/houseboats/${boatId}/staff/${leaveFor.id}/leave`, {
        state: leaveState,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      setLeaveFor(null);
      setFromDate('');
      setToDate('');
      await mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not record the leave.'));
    } finally {
      setBusy(false);
    }
  }

  const rows = data ?? [];

  return (
    <>
      <PageHead
        title="Crew"
        desc="Who works this boat and how they are paid. A crew member needs their own account first — they are a person on the platform, not a record you own."
        actions={
          <button className="btn btn-b" onClick={() => setOpen(true)}>
            ＋ Add crew
          </button>
        }
      />

      {error ? (
        <Note kind="danger" style={{ marginBottom: 18 }}>
          {error}
        </Note>
      ) : null}

      <Card flush>
        <TableWrap minWidth={780}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Pay</th>
              <th className="num">Rate</th>
              <th>Emergency contact</th>
              <th />
            </tr>
          </thead>
          <AsyncTable
            isLoading={isLoading}
            error={loadError}
            isEmpty={rows.length === 0}
            onRetry={() => mutate()}
            empty={
              <div className="state">
                <div className="ic">⚓</div>
                <h4>No crew yet</h4>
                <p>Add the people who run this boat — sukani, cook, helpers.</p>
              </div>
            }
          >
            <tbody>
              {rows.map((s) => {
                const salaried = s.monthlySalary !== null;
                return (
                  <tr key={s.id}>
                    <td>
                      <div className="t1">{s.account?.name ?? 'Crew'}</div>
                      <div className="t2">
                        {maskPhone(s.account?.phone)}
                        {s.nid ? ` · NID ••${s.nid.slice(-4)}` : ''}
                      </div>
                    </td>
                    <td className="t2">{s.role?.name ?? '—'}</td>
                    <td>
                      <Pill tone={salaried ? 'blue' : 'mut'}>
                        {salaried ? 'salaried' : 'per trip'}
                      </Pill>
                    </td>
                    <td className="num">
                      {salaried
                        ? `${money(s.monthlySalary)}/mo`
                        : s.perTripRate
                          ? `${money(s.perTripRate)}/trip`
                          : '—'}
                    </td>
                    <td className="t2">{s.emergencyContact ?? '—'}</td>
                    <td>
                      <div className="rowact">
                        <button
                          className="btn btn-sm btn-o"
                          onClick={() => {
                            setLeaveFor(s);
                            setLeaveState('on_leave');
                          }}
                        >
                          Set leave
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

      <Note kind="info" style={{ marginTop: 16 }}>
        Per-trip crew are costed against the trips they actually work; salaried crew are a
        monthly cost whether the boat sails or not. That difference is what the profit
        report uses.
      </Note>

      <Drawer
        open={open}
        title="Add crew"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-o" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-b" onClick={addStaff} disabled={busy || !phone}>
              {busy ? 'Adding…' : 'Add crew'}
            </button>
          </>
        }
      >
        <form onSubmit={addStaff} style={{ display: 'grid', gap: 12 }}>
          {error ? <Note kind="danger">{error}</Note> : null}

          <Field label="Phone">
            <div className="with-pre">
              <span className="pre">+880</span>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="1720000000"
                required
              />
            </div>
          </Field>

          <Field label="NID">
            <input value={nid} onChange={(e) => setNid(e.target.value)} />
          </Field>

          <Field label="Emergency contact">
            <input
              value={emergencyContact}
              onChange={(e) => setEmergencyContact(e.target.value)}
              placeholder="+8801799999999"
            />
          </Field>

          <Field label="Paid by">
            <select
              value={payKind}
              onChange={(e) => setPayKind(e.target.value as 'per_trip' | 'salary')}
            >
              <option value="per_trip">Per trip</option>
              <option value="salary">Monthly salary</option>
            </select>
          </Field>

          <Field label={payKind === 'salary' ? 'Monthly salary (৳)' : 'Rate per trip (৳)'}>
            <input
              type="number"
              min={0}
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </Field>

          <Note kind="info">
            The person must already have an account on this phone number. Ask them to
            register first — that keeps one login per person across every boat.
          </Note>
        </form>
      </Drawer>

      <Drawer
        open={leaveFor !== null}
        title={`Leave · ${leaveFor?.account?.name ?? 'Crew'}`}
        onClose={() => setLeaveFor(null)}
        footer={
          <>
            <button className="btn btn-o" onClick={() => setLeaveFor(null)}>
              Cancel
            </button>
            <button className="btn btn-b" onClick={setLeave} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <form onSubmit={setLeave} style={{ display: 'grid', gap: 12 }}>
          <Field label="State">
            <select value={leaveState} onChange={(e) => setLeaveState(e.target.value)}>
              <option value="on_leave">On leave</option>
              <option value="other_duty">Other duty</option>
              <option value="available">Available</option>
            </select>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="From">
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </Field>
            <Field label="To">
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </Field>
          </div>
          <Note kind="info">
            Being on leave is not the same as not being assigned to a trip. Attendance
            shows both separately.
          </Note>
        </form>
      </Drawer>
    </>
  );
}
