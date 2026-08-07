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
  designation: string | null;
  nid: string | null;
  emergencyContact: string | null;
  address: string | null;
  status: string;
  perTripRate: string | null;
  monthlySalary: string | null;
  account: { id: string; name: string | null; phone: string } | null;
}

/** null = closed; id present = editing that crew member, else adding. */
type DrawerState = { id?: string } | null;

export default function OwnerCrewPage() {
  const { boatId } = useActiveBoat();
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [editRow, setEditRow] = useState<Staff | null>(null);
  const [leaveFor, setLeaveFor] = useState<Staff | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [nid, setNid] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [address, setAddress] = useState('');
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

  const editing = drawer?.id != null;

  function openAdd() {
    setError(null);
    setEditRow(null);
    setPhone('');
    setDesignation('');
    setNid('');
    setEmergencyContact('');
    setAddress('');
    setPayKind('per_trip');
    setRate('');
    setDrawer({});
  }

  function openEdit(s: Staff) {
    setError(null);
    setEditRow(s);
    setPhone('');
    setDesignation(s.designation ?? '');
    setNid(s.nid ?? '');
    setEmergencyContact(s.emergencyContact ?? '');
    setAddress(s.address ?? '');
    const salaried = s.monthlySalary !== null;
    setPayKind(salaried ? 'salary' : 'per_trip');
    setRate(salaried ? (s.monthlySalary ?? '') : (s.perTripRate ?? ''));
    setDrawer({ id: s.id });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !drawer) return;
    if (!editing && !phone) return;
    setBusy(true);
    setError(null);
    try {
      const rateNum = rate ? Number(rate) : null;
      if (drawer.id) {
        // Pay-type is exclusive: send the active field, null the other so a
        // switch clears it.
        await api.patch(`/houseboats/${boatId}/staff/${drawer.id}`, {
          designation: designation || undefined,
          nid: nid || undefined,
          emergencyContact: emergencyContact || undefined,
          address: address || undefined,
          perTripRate: payKind === 'per_trip' ? rateNum : null,
          monthlySalary: payKind === 'salary' ? rateNum : null,
        });
      } else {
        await api.post(`/houseboats/${boatId}/staff`, {
          phone: toE164(phone),
          designation: designation || undefined,
          nid: nid || undefined,
          emergencyContact: emergencyContact || undefined,
          address: address || undefined,
          perTripRate:
            payKind === 'per_trip' && rate ? Number(rate) : undefined,
          monthlySalary: payKind === 'salary' && rate ? Number(rate) : undefined,
        });
      }
      setDrawer(null);
      await mutate();
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          editing
            ? 'Could not save those changes.'
            : 'Could not add that person. They need an account on this phone number first.',
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: Staff) {
    const name = s.account?.name ?? 'this crew member';
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
    setError(null);
    try {
      await api.delete(`/houseboats/${boatId}/staff/${s.id}`);
      await mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not delete that crew member.'));
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
          <button className="btn btn-b" onClick={openAdd}>
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
        <TableWrap minWidth={880}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Designation</th>
              <th>Status</th>
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
                const onLeave = s.status === 'on_leave';
                return (
                  <tr key={s.id}>
                    <td>
                      <div className="t1">{s.account?.name ?? 'Crew'}</div>
                      <div className="t2">
                        {maskPhone(s.account?.phone)}
                        {s.nid ? ` · NID ••${s.nid.slice(-4)}` : ''}
                      </div>
                    </td>
                    <td className="t2">{s.designation ?? '—'}</td>
                    <td>
                      <Pill tone={onLeave ? 'mut' : 'ok'}>
                        {onLeave ? 'on leave' : 'available'}
                      </Pill>
                    </td>
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
                          onClick={() => openEdit(s)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-o"
                          onClick={() => {
                            setLeaveFor(s);
                            setLeaveState('on_leave');
                          }}
                        >
                          Set leave
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => remove(s)}
                        >
                          Delete
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
        open={drawer !== null}
        title={editing ? 'Edit crew' : 'Add crew'}
        onClose={() => setDrawer(null)}
        footer={
          <>
            <button className="btn btn-o" onClick={() => setDrawer(null)}>
              Cancel
            </button>
            <button
              className="btn btn-b"
              onClick={submit}
              disabled={busy || (!editing && !phone)}
            >
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Add crew'}
            </button>
          </>
        }
      >
        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          {error ? <Note kind="danger">{error}</Note> : null}

          {editing ? (
            <Field label="Name">
              <div className="t1">{editRow?.account?.name ?? 'Crew'}</div>
              <div className="t2">{maskPhone(editRow?.account?.phone)}</div>
            </Field>
          ) : (
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
          )}

          <Field label="Designation">
            <input
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="Sukani, cook, helper…"
            />
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

          <Field label="Address">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
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

          {editing ? (
            <Note kind="info">
              Name and phone come from this person&apos;s account and can&apos;t be changed
              here.
            </Note>
          ) : (
            <Note kind="info">
              The person must already have an account on this phone number. Ask them to
              register first — that keeps one login per person across every boat.
            </Note>
          )}
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
