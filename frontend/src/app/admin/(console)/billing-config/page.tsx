'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import {
  PageHead,
  Card,
  TableWrap,
  TableSkeleton,
  EmptyState,
  ErrorState,
  Note,
} from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';
import { Drawer } from '@/components/admin/Drawer';
import { formatBDT, isNegative } from '@/lib/admin/money';
import { apiErrorMessage } from '@/lib/admin/api-error';

interface BillingConfigRow {
  id: string;
  commissionPct: string | null;
  monthlyFee: string | null;
  platformBalance: string;
  trialEnds: string | null;
  houseboat: { id: string; name: string; status: string };
}

interface ModerationBoat {
  id: string;
  name: string;
  status: string;
}

interface FormState {
  boatId: string;
  boatName: string;
  commissionPct: string;
  monthlyFee: string;
  trialEnds: string;
}

export default function BillingConfig() {
  const configs = useSWR<BillingConfigRow[]>(
    '/platform/finance/billing-configs',
    fetcher,
    { revalidateOnFocus: false },
  );
  const boats = useSWR<ModerationBoat[]>('/platform/houseboats', fetcher, {
    revalidateOnFocus: false,
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const rows = configs.data ?? [];
  const configuredBoatIds = useMemo(
    () => new Set(rows.map((c) => c.houseboat.id)),
    [rows],
  );
  const unconfigured = (boats.data ?? []).filter(
    (b) => !configuredBoatIds.has(b.id),
  );

  function openEditor(boat: { id: string; name: string }, existing?: BillingConfigRow) {
    setFormError(null);
    setForm({
      boatId: boat.id,
      boatName: boat.name,
      commissionPct: existing?.commissionPct ?? '',
      monthlyFee: existing?.monthlyFee ?? '',
      trialEnds: existing?.trialEnds ? existing.trialEnds.slice(0, 10) : '',
    });
  }

  async function save() {
    if (!form || busy) return;
    setBusy(true);
    setFormError(null);
    try {
      await api.put(`/platform/finance/billing-configs/${form.boatId}`, {
        commissionPct: form.commissionPct === '' ? null : Number(form.commissionPct),
        monthlyFee: form.monthlyFee === '' ? null : Number(form.monthlyFee),
        trialEnds: form.trialEnds === '' ? null : form.trialEnds,
      });
      setForm(null);
      await configs.mutate();
    } catch (e) {
      setFormError(apiErrorMessage(e, 'Could not save this billing config.'));
    } finally {
      setBusy(false);
    }
  }

  const field = (
    label: string,
    key: 'commissionPct' | 'monthlyFee',
    placeholder: string,
  ) =>
    form ? (
      <div className="field">
        <label>{label}</label>
        <input
          type="number"
          min={0}
          step="0.01"
          placeholder={placeholder}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      </div>
    ) : null;

  return (
    <>
      <PageHead
        title="Billing config"
        desc="Platform-set, per boat. Commission and monthly fee can both apply. A boat with no config silently defaults commission to 0 — configure each boat as it goes live."
      />
      <Card flush>
        {configs.error ? (
          <ErrorState error={configs.error} onRetry={() => configs.mutate()} />
        ) : !configs.isLoading && rows.length === 0 ? (
          <EmptyState
            title="No billing configs yet"
            desc="Use the section below to set terms for a boat."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Boat</th>
                <th className="num">Commission</th>
                <th className="num">Monthly fee</th>
                <th className="num">Platform balance</th>
                <th>Trial ends</th>
                <th />
              </tr>
            </thead>
            {configs.isLoading ? (
              <TableSkeleton rows={4} cols={6} />
            ) : (
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="t1">{c.houseboat.name}</div>
                      <div className="t2">{c.houseboat.status}</div>
                    </td>
                    <td className="num">
                      {c.commissionPct !== null ? `${c.commissionPct}%` : '—'}
                    </td>
                    <td className="num">
                      {c.monthlyFee !== null ? (
                        <><span className="u">৳</span> {formatBDT(c.monthlyFee)}</>
                      ) : '—'}
                    </td>
                    <td
                      className="num"
                      style={
                        isNegative(c.platformBalance)
                          ? { color: 'var(--danger)' }
                          : undefined
                      }
                    >
                      <span className="u">৳</span> {formatBDT(c.platformBalance)}
                    </td>
                    <td>
                      {c.trialEnds ? (
                        <Pill tone="blue">
                          {new Date(c.trialEnds).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </Pill>
                      ) : (
                        <span className="t2">—</span>
                      )}
                    </td>
                    <td className="rowact">
                      <button
                        className="btn btn-sm btn-o"
                        onClick={() => openEditor(c.houseboat, c)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </TableWrap>
        )}
      </Card>

      <Card
        title="Boats without config"
        sub="commission silently defaults to 0 until configured"
        flush
        style={{ marginTop: 20 }}
      >
        {boats.error ? (
          <ErrorState error={boats.error} onRetry={() => boats.mutate()} />
        ) : !boats.isLoading && unconfigured.length === 0 ? (
          <EmptyState
            title="Every boat has billing terms"
            desc="New boats will appear here until they are configured."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr><th>Boat</th><th>Status</th><th /></tr>
            </thead>
            {boats.isLoading ? (
              <TableSkeleton rows={3} cols={3} />
            ) : (
              <tbody>
                {unconfigured.map((b) => (
                  <tr key={b.id}>
                    <td className="t1">{b.name}</td>
                    <td>
                      <Pill tone={b.status === 'live' ? 'ok' : 'mut'}>{b.status}</Pill>
                    </td>
                    <td className="rowact">
                      <button
                        className="btn btn-sm btn-b"
                        onClick={() => openEditor(b)}
                      >
                        Create config
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </TableWrap>
        )}
      </Card>

      <Note kind="info" icon="ℹ" style={{ marginTop: 16 }}>
        Platform balance is ledger-owned — it moves only through payouts and
        subscription payments, never through this editor.
      </Note>

      <Drawer
        open={form !== null}
        onClose={() => setForm(null)}
        title={form ? `${form.boatName} · billing terms` : ''}
        footer={
          <>
            <button className="btn btn-o" onClick={() => setForm(null)}>Cancel</button>
            <button className="btn btn-b" disabled={busy} onClick={save}>
              {busy ? 'Saving…' : 'Save config'}
            </button>
          </>
        }
      >
        {form ? (
          <div className="stack" style={{ gap: 14 }}>
            <div className="form-grid">
              {field('Commission %', 'commissionPct', 'e.g. 5.0')}
              {field('Monthly fee (৳)', 'monthlyFee', 'e.g. 5000')}
              <div className="field">
                <label>Trial ends</label>
                <input
                  type="date"
                  value={form.trialEnds}
                  onChange={(e) => setForm({ ...form, trialEnds: e.target.value })}
                />
              </div>
            </div>
            <Note kind="info" icon="ℹ">
              Leave a field empty to clear it — &quot;not on commission&quot; and
              &quot;no monthly fee&quot; are valid states.
            </Note>
            {formError ? (
              <div className="note danger" role="alert">
                <span className="ic">⚠</span>
                <span>{formError}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
