'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import {
  PageHead,
  Card,
  Note,
  ErrorState,
} from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';
import { apiErrorMessage } from '@/lib/admin/api-error';
import {
  BTN_B,
  BTN_SM,
  FIELD_INPUT,
  TD_T2,
} from '@/components/admin/styles';

interface SettingRow {
  key: string;
  label: string;
  help: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  group: string;
  isDefault: boolean;
}

interface Health {
  status: 'ok' | 'degraded';
  db: 'up' | 'down';
  redis: 'up' | 'down' | 'disabled';
  time: string;
}

function healthTone(state: string): 'ok' | 'danger' | 'mut' {
  if (state === 'up' || state === 'ok') return 'ok';
  if (state === 'down' || state === 'degraded') return 'danger';
  return 'mut';
}

function SettingField({
  row,
  onSaved,
}: {
  row: SettingRow;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(String(row.value));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const parsed = Number(draft);
  const invalid =
    draft.trim() === '' ||
    !Number.isInteger(parsed) ||
    parsed < row.min ||
    parsed > row.max;
  const dirty = parsed !== row.value;

  async function save() {
    if (busy || invalid || !dirty) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api.put(`/platform/system/settings/${row.key}`, { value: parsed });
      setSaved(true);
      onSaved();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save this setting.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-hair-2 py-4 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[220px] flex-1">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
            {row.label}
            {row.isDefault ? (
              <Pill tone="mut">default</Pill>
            ) : (
              <Pill tone="blue">custom</Pill>
            )}
          </div>
          <p className={`mt-1 max-w-[60ch] ${TD_T2}`}>{row.help}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            className={FIELD_INPUT}
            style={{ width: 92, textAlign: 'right' }}
            inputMode="numeric"
            value={draft}
            aria-label={`${row.label} (${row.unit})`}
            onChange={(e) => {
              setDraft(e.target.value);
              setSaved(false);
            }}
          />
          <span className="w-[64px] text-[12px] text-muted">{row.unit}</span>
          <button
            className={`${BTN_B} ${BTN_SM}`}
            disabled={busy || invalid || !dirty}
            onClick={save}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      {invalid && draft.trim() !== '' ? (
        <p className="mt-2 text-[12px] text-danger">
          Must be a whole number between {row.min} and {row.max} {row.unit}.
        </p>
      ) : null}
      {error ? <p className="mt-2 text-[12px] text-danger">{error}</p> : null}
      {saved && !dirty ? (
        <p className="mt-2 text-[12px] text-ok">Saved.</p>
      ) : null}
    </div>
  );
}

export default function System() {
  const settings = useSWR<SettingRow[]>('/platform/system/settings', fetcher, {
    revalidateOnFocus: false,
  });
  const health = useSWR<Health>('/platform/system/health', fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 30_000,
  });

  const groups = useMemo(() => {
    const map = new Map<string, SettingRow[]>();
    for (const row of settings.data ?? []) {
      const list = map.get(row.group) ?? [];
      list.push(row);
      map.set(row.group, list);
    }
    return [...map.entries()];
  }, [settings.data]);

  return (
    <>
      <PageHead
        title="System & health"
        desc={
          <>
            Operational limits, editable live — a change takes effect on the next
            booking, login, or billing check. Each has safe bounds and every edit
            is written to the audit log. Defaults match the built-in behaviour, so
            an untouched value changes nothing.
          </>
        }
      />

      <Card title="Health" sub={health.data ? `checked ${new Date(health.data.time).toLocaleTimeString('en-GB')}` : undefined}>
        {health.error ? (
          <ErrorState error={health.error} onRetry={() => health.mutate()} />
        ) : !health.data ? (
          <p className={TD_T2}>Checking…</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2.5">
            <Pill tone={healthTone(health.data.status)}>
              {health.data.status === 'ok' ? 'operational' : 'degraded'}
            </Pill>
            <Pill tone={healthTone(health.data.db)}>database {health.data.db}</Pill>
            <Pill tone={healthTone(health.data.redis)}>cache {health.data.redis}</Pill>
          </div>
        )}
      </Card>

      <div className="mt-5">
        {settings.error ? (
          <Card flush>
            <ErrorState error={settings.error} onRetry={() => settings.mutate()} />
          </Card>
        ) : !settings.data ? (
          <Card>
            <p className={TD_T2}>Loading settings…</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map(([group, rows]) => (
              <Card key={group} title={group}>
                {group === 'Booking limits' ? (
                  <div className="mb-2">
                    <Note kind="info" icon="ℹ">
                      These have a hard ceiling of 4 enforced at request validation.
                      You can tighten them below that, not above it.
                    </Note>
                  </div>
                ) : null}
                {rows.map((row) => (
                  <SettingField
                    key={row.key}
                    row={row}
                    onSaved={() => settings.mutate()}
                  />
                ))}
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
