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
  Field,
  Note,
  TableWrap,
  AsyncTable,
} from '@/components/owner/ui';
import { Pill } from '@/components/owner/Pill';
import { Drawer } from '@/components/owner/Drawer';
import { money, formatDate, apiErrorMessage, humanize } from '@/lib/owner/format';

interface MaintenanceSummary {
  engineHours: number;
  engineHoursUpdatedAt: string | null;
  tasks: {
    id: string;
    title: string;
    intervalKind: string;
    intervalValue: number | null;
    dueAtHours: number | null;
    dueDate: string | null;
    lastDoneAt: string | null;
    lastDoneHours: number | null;
    status: string;
    dueState: string;
  }[];
  dueCount: number;
  damage: {
    id: string;
    title: string;
    detail: string | null;
    status: string;
    repairCost: string | null;
    reportedAt: string;
    fixedAt: string | null;
  }[];
  openDamageCount: number;
  serviceLogs: {
    id: string;
    serviceDate: string;
    engineHours: number | null;
    cost: string | null;
    note: string | null;
    task: { title: string } | null;
  }[];
  lastServiceAt: string | null;
}

const DUE_TONES: Record<string, 'ok' | 'warn' | 'danger'> = {
  ok: 'ok',
  due_soon: 'warn',
  overdue: 'danger',
};

type DrawerKind = 'task' | 'damage' | 'hours' | null;

export default function OwnerMaintenancePage() {
  const { boatId } = useActiveBoat();
  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [intervalKind, setIntervalKind] = useState('engine_hours');
  const [intervalValue, setIntervalValue] = useState('100');
  const [dueAtHours, setDueAtHours] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [damageTitle, setDamageTitle] = useState('');
  const [damageDetail, setDamageDetail] = useState('');
  const [hours, setHours] = useState('');

  const { data, error: loadError, isLoading, mutate } = useSWR<MaintenanceSummary>(
    `/houseboats/${boatId}/maintenance`,
    fetcher,
    { revalidateOnFocus: false },
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busyId) return;
    setBusyId('form');
    setError(null);
    try {
      if (drawer === 'task') {
        await api.post(`/houseboats/${boatId}/maintenance/tasks`, {
          title,
          intervalKind,
          intervalValue: intervalValue ? Number(intervalValue) : undefined,
          dueAtHours:
            intervalKind === 'engine_hours' && dueAtHours ? Number(dueAtHours) : undefined,
          dueDate: intervalKind === 'calendar' && dueDate ? dueDate : undefined,
        });
        setTitle('');
        setDueAtHours('');
        setDueDate('');
      } else if (drawer === 'damage') {
        await api.post(`/houseboats/${boatId}/maintenance/damage`, {
          title: damageTitle,
          detail: damageDetail || undefined,
        });
        setDamageTitle('');
        setDamageDetail('');
      } else if (drawer === 'hours') {
        await api.post(`/houseboats/${boatId}/maintenance/engine-hours`, {
          hours: Number(hours),
        });
        setHours('');
      }
      setDrawer(null);
      await mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save that.'));
    } finally {
      setBusyId(null);
    }
  }

  async function completeTask(taskId: string) {
    if (busyId) return;
    setBusyId(taskId);
    setError(null);
    try {
      await api.post(`/houseboats/${boatId}/maintenance/tasks/${taskId}/complete`, {});
      await mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not mark that serviced.'));
    } finally {
      setBusyId(null);
    }
  }

  async function fixDamage(damageId: string) {
    if (busyId) return;
    setBusyId(damageId);
    setError(null);
    try {
      await api.patch(`/houseboats/${boatId}/maintenance/damage/${damageId}`, {
        status: 'fixed',
      });
      await mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not close that damage entry.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHead
        title="Maintenance"
        desc="The service schedule and damage log for the boat itself. Due-ness is worked out from the current meter reading, so it never goes stale."
        actions={
          <>
            <button className="btn btn-o" onClick={() => setDrawer('hours')}>
              Log engine hours
            </button>
            <button className="btn btn-o" onClick={() => setDrawer('damage')}>
              ＋ Report damage
            </button>
            <button className="btn btn-b" onClick={() => setDrawer('task')}>
              ＋ Service task
            </button>
          </>
        }
      />

      {error ? (
        <Note kind="danger" style={{ marginBottom: 18 }}>
          {error}
        </Note>
      ) : null}

      <Kpis>
        <Kpi
          icon="⚙"
          label="Engine hours"
          value={data?.engineHours ?? '—'}
          detail={
            data?.engineHoursUpdatedAt
              ? `Read ${formatDate(data.engineHoursUpdatedAt)}`
              : 'Never logged'
          }
        />
        <Kpi
          icon="🛠"
          label="Service due"
          value={data?.dueCount ?? '—'}
          alert={Boolean(data?.dueCount)}
          detail="Overdue or due soon"
        />
        <Kpi
          icon="⚠"
          label="Open damage"
          value={data?.openDamageCount ?? '—'}
          alert={Boolean(data?.openDamageCount)}
          detail="Reported, not yet fixed"
        />
        <Kpi
          icon="📅"
          label="Last service"
          value={data?.lastServiceAt ? formatDate(data.lastServiceAt) : '—'}
          detail="From the service log"
        />
      </Kpis>

      <div className="grid-2">
        <div className="stack">
          <Card title="Service schedule" flush>
            <TableWrap minWidth={680}>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Interval</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <AsyncTable
                isLoading={isLoading}
                error={loadError}
                isEmpty={(data?.tasks.length ?? 0) === 0}
                onRetry={() => mutate()}
                empty={
                  <div className="state">
                    <div className="ic">🛠</div>
                    <h4>No service tasks</h4>
                    <p>Add the recurring jobs — oil change, hull inspection.</p>
                  </div>
                }
              >
                <tbody>
                  {data?.tasks.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <div className="t1">{t.title}</div>
                        <div className="t2">
                          {t.lastDoneAt ? `Last done ${formatDate(t.lastDoneAt)}` : 'Never done'}
                        </div>
                      </td>
                      <td className="t2">
                        {t.intervalKind === 'engine_hours'
                          ? `every ${t.intervalValue ?? '—'}h`
                          : t.intervalKind === 'calendar'
                            ? `every ${t.intervalValue ?? '—'} days`
                            : 'per trip'}
                      </td>
                      <td className="t2">
                        {t.dueAtHours !== null
                          ? `${t.dueAtHours}h`
                          : t.dueDate
                            ? formatDate(t.dueDate)
                            : '—'}
                      </td>
                      <td>
                        <Pill tone={DUE_TONES[t.dueState] ?? 'mut'}>
                          {humanize(t.dueState)}
                        </Pill>
                      </td>
                      <td>
                        <div className="rowact">
                          <button
                            className="btn btn-sm btn-ok"
                            onClick={() => completeTask(t.id)}
                            disabled={busyId === t.id}
                          >
                            {busyId === t.id ? 'Saving…' : 'Mark serviced'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </AsyncTable>
            </TableWrap>
          </Card>

          <Card title="Damage log" flush>
            <TableWrap minWidth={620}>
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>Reported</th>
                  <th className="num">Repair cost</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <AsyncTable
                isLoading={isLoading}
                error={loadError}
                isEmpty={(data?.damage.length ?? 0) === 0}
                onRetry={() => mutate()}
                empty={
                  <div className="state">
                    <div className="ic">✓</div>
                    <h4>Nothing broken</h4>
                    <p>Report damage as crew find it so nothing is forgotten at the ghat.</p>
                  </div>
                }
              >
                <tbody>
                  {data?.damage.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <div className="t1">{d.title}</div>
                        {d.detail ? <div className="t2">{d.detail}</div> : null}
                      </td>
                      <td className="t2">{formatDate(d.reportedAt)}</td>
                      <td className="num">{d.repairCost ? money(d.repairCost) : '—'}</td>
                      <td>
                        <Pill tone={d.status === 'open' ? 'danger' : 'ok'}>{d.status}</Pill>
                      </td>
                      <td>
                        <div className="rowact">
                          {d.status === 'open' ? (
                            <button
                              className="btn btn-sm btn-ok"
                              onClick={() => fixDamage(d.id)}
                              disabled={busyId === d.id}
                            >
                              {busyId === d.id ? 'Saving…' : 'Mark fixed'}
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
        </div>

        <Card title="Service history" flush>
          <TableWrap minWidth={0}>
            <thead>
              <tr>
                <th>Date</th>
                <th>What</th>
                <th className="num">Cost</th>
              </tr>
            </thead>
            <AsyncTable
              isLoading={isLoading}
              error={loadError}
              isEmpty={(data?.serviceLogs.length ?? 0) === 0}
              onRetry={() => mutate()}
              empty={
                <div className="state">
                  <div className="ic">📜</div>
                  <h4>No history</h4>
                  <p>Completed services are recorded here.</p>
                </div>
              }
            >
              <tbody>
                {data?.serviceLogs.map((l) => (
                  <tr key={l.id}>
                    <td className="t2">{formatDate(l.serviceDate)}</td>
                    <td>
                      <div className="t1">{l.task?.title ?? 'Ad-hoc service'}</div>
                      {l.engineHours ? <div className="t2">at {l.engineHours}h</div> : null}
                    </td>
                    <td className="num">{l.cost ? money(l.cost) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </AsyncTable>
          </TableWrap>
        </Card>
      </div>

      <Drawer
        open={drawer !== null}
        title={
          drawer === 'task'
            ? 'New service task'
            : drawer === 'damage'
              ? 'Report damage'
              : 'Log engine hours'
        }
        onClose={() => setDrawer(null)}
        footer={
          <>
            <button className="btn btn-o" onClick={() => setDrawer(null)}>
              Cancel
            </button>
            <button className="btn btn-b" onClick={submit} disabled={busyId !== null}>
              {busyId ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          {error ? <Note kind="danger">{error}</Note> : null}

          {drawer === 'task' ? (
            <>
              <Field label="Task">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Engine oil change"
                  required
                />
              </Field>
              <Field label="Recurs by">
                <select value={intervalKind} onChange={(e) => setIntervalKind(e.target.value)}>
                  <option value="engine_hours">Engine hours</option>
                  <option value="calendar">Calendar days</option>
                  <option value="per_trip">Every trip</option>
                </select>
              </Field>
              {intervalKind !== 'per_trip' ? (
                <Field label={intervalKind === 'engine_hours' ? 'Every (hours)' : 'Every (days)'}>
                  <input
                    type="number"
                    min={1}
                    value={intervalValue}
                    onChange={(e) => setIntervalValue(e.target.value)}
                  />
                </Field>
              ) : null}
              {intervalKind === 'engine_hours' ? (
                <Field label="Next due at (hours)">
                  <input
                    type="number"
                    min={0}
                    value={dueAtHours}
                    onChange={(e) => setDueAtHours(e.target.value)}
                    placeholder={String((data?.engineHours ?? 0) + Number(intervalValue || 0))}
                    required
                  />
                </Field>
              ) : null}
              {intervalKind === 'calendar' ? (
                <Field label="Next due on">
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                  />
                </Field>
              ) : null}
            </>
          ) : null}

          {drawer === 'damage' ? (
            <>
              <Field label="What is wrong">
                <input
                  value={damageTitle}
                  onChange={(e) => setDamageTitle(e.target.value)}
                  placeholder="Railing loose on upper deck"
                  required
                />
              </Field>
              <Field label="Detail">
                <textarea
                  rows={3}
                  value={damageDetail}
                  onChange={(e) => setDamageDetail(e.target.value)}
                />
              </Field>
            </>
          ) : null}

          {drawer === 'hours' ? (
            <>
              <Field label="Meter reading (hours)">
                <input
                  type="number"
                  min={data?.engineHours ?? 0}
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder={String(data?.engineHours ?? 0)}
                  required
                />
              </Field>
              <Note kind="info">
                Current reading is {data?.engineHours ?? 0}h. A meter only counts up, so a
                lower number is rejected — it would un-due every hours-based task.
              </Note>
            </>
          ) : null}
        </form>
      </Drawer>
    </>
  );
}
