'use client';

import { useState } from 'react';
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
import { Pill, Tag } from '@/components/admin/Pill';
import { Drawer } from '@/components/admin/Drawer';
import { useAdminList } from '@/lib/admin/useAdminList';
import { formatBDT } from '@/lib/admin/money';
import { apiErrorMessage } from '@/lib/admin/api-error';

interface CouponRow {
  id: string;
  code: string;
  kind: 'percent' | 'flat' | 'referral';
  value: string;
  validFrom: string | null;
  validTo: string | null;
  houseboat: { id: string; name: string };
  _count: { bookings: number };
}

interface ModerationBoat {
  id: string;
  name: string;
  status: string;
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function validity(c: CouponRow): { label: string; tone: 'ok' | 'mut' | 'warn' } {
  const now = new Date();
  if (c.validTo && new Date(c.validTo) < now) return { label: 'expired', tone: 'mut' };
  if (c.validFrom && new Date(c.validFrom) > now)
    return { label: 'not started', tone: 'warn' };
  return { label: 'active', tone: 'ok' };
}

const EMPTY_FORM = {
  boatId: '',
  code: '',
  kind: 'percent' as 'percent' | 'flat' | 'referral',
  value: '',
  validFrom: '',
  validTo: '',
};

export default function Coupons() {
  const { items, error, isInitialLoading, hasMore, loadMore, mutate } =
    useAdminList<CouponRow>('/platform/finance/coupons', { limit: 25 });
  const boats = useSWR<ModerationBoat[]>('/platform/houseboats', fetcher, {
    revalidateOnFocus: false,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function clientCheck(): string | null {
    if (!form.boatId) return 'Pick a boat.';
    if (!form.code.trim()) return 'Coupon code is required.';
    const value = Number(form.value);
    if (!Number.isFinite(value) || value <= 0) return 'Value must be a positive number.';
    if (form.kind === 'percent' && value > 100)
      return 'Percent coupon cannot exceed 100.';
    if (form.validFrom && form.validTo && form.validFrom > form.validTo)
      return 'Valid-from must not be after valid-to.';
    return null;
  }

  async function create() {
    if (busy) return;
    const problem = clientCheck();
    if (problem) {
      setFormError(problem);
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await api.post(`/houseboats/${form.boatId}/coupons`, {
        code: form.code.trim(),
        kind: form.kind,
        value: Number(form.value),
        validFrom: form.validFrom || undefined,
        validTo: form.validTo || undefined,
      });
      setOpen(false);
      setForm(EMPTY_FORM);
      await mutate();
    } catch (e) {
      setFormError(apiErrorMessage(e, 'Could not create this coupon.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="Coupons & referrals"
        desc="Coupon codes across all boats. The boat absorbs its own coupon — commission is charged on the original room total, so this view is fraud oversight, not platform cost."
        actions={
          <button className="btn btn-b" onClick={() => { setFormError(null); setOpen(true); }}>
            + New coupon
          </button>
        }
      />
      <Card flush>
        {error ? (
          <ErrorState error={error} onRetry={() => mutate()} />
        ) : !isInitialLoading && items.length === 0 ? (
          <EmptyState
            title="No coupons yet"
            desc="Create one with the button above, or boat owners can add their own."
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Boat</th>
                  <th>Kind</th>
                  <th className="num">Value</th>
                  <th className="num">Uses</th>
                  <th>Valid</th>
                  <th>Status</th>
                </tr>
              </thead>
              {isInitialLoading ? (
                <TableSkeleton rows={4} cols={7} />
              ) : (
                <tbody>
                  {items.map((c) => {
                    const v = validity(c);
                    return (
                      <tr key={c.id}>
                        <td className="t1">{c.code}</td>
                        <td>{c.houseboat.name}</td>
                        <td><Tag>{c.kind}</Tag></td>
                        <td className="num">
                          {c.kind === 'percent' ? (
                            `${c.value}%`
                          ) : (
                            <><span className="u">৳</span> {formatBDT(c.value)}</>
                          )}
                        </td>
                        <td className="num">{c._count.bookings}</td>
                        <td className="t2">
                          {formatDate(c.validFrom) ?? '—'} → {formatDate(c.validTo) ?? '—'}
                        </td>
                        <td><Pill tone={v.tone}>{v.label}</Pill></td>
                      </tr>
                    );
                  })}
                </tbody>
              )}
            </TableWrap>
            {hasMore ? (
              <div style={{ padding: 12, textAlign: 'center' }}>
                <button className="btn btn-o btn-sm" onClick={loadMore}>
                  Load more
                </button>
              </div>
            ) : null}
          </>
        )}
      </Card>
      <Note kind="info" icon="ℹ" style={{ marginTop: 16 }}>
        Coupons never reduce platform commission — the boat absorbs its own
        discount.
      </Note>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="New coupon"
        footer={
          <>
            <button className="btn btn-o" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-b" disabled={busy} onClick={create}>
              {busy ? 'Creating…' : '+ Create coupon'}
            </button>
          </>
        }
      >
        <div className="stack" style={{ gap: 14 }}>
          <div className="form-grid">
            <div className="field">
              <label>Boat</label>
              <select
                className="select"
                value={form.boatId}
                onChange={(e) => setForm({ ...form, boatId: e.target.value })}
              >
                <option value="">Select a boat…</option>
                {(boats.data ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Code</label>
              <input
                placeholder="e.g. MONSOON25"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Kind</label>
              <select
                className="select"
                value={form.kind}
                onChange={(e) =>
                  setForm({ ...form, kind: e.target.value as typeof form.kind })
                }
              >
                <option value="percent">Percent</option>
                <option value="flat">Flat</option>
                <option value="referral">Referral</option>
              </select>
            </div>
            <div className="field">
              <label>{form.kind === 'percent' ? 'Value (%)' : 'Value (৳)'}</label>
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder={form.kind === 'percent' ? 'e.g. 10' : 'e.g. 500'}
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Valid from</label>
              <input
                type="date"
                value={form.validFrom}
                onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Valid to</label>
              <input
                type="date"
                value={form.validTo}
                onChange={(e) => setForm({ ...form, validTo: e.target.value })}
              />
            </div>
          </div>
          {formError ? (
            <div className="note danger" role="alert">
              <span className="ic">⚠</span>
              <span>{formError}</span>
            </div>
          ) : null}
        </div>
      </Drawer>
    </>
  );
}
