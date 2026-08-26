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
  Search,
  Select,
} from '@/components/admin/ui';
import { Pill, Tag } from '@/components/admin/Pill';
import { Drawer } from '@/components/admin/Drawer';
import { useAdminList } from '@/lib/admin/useAdminList';
import { formatBDT } from '@/lib/admin/money';
import { apiErrorMessage } from '@/lib/admin/api-error';
import { BTN_B, BTN_O, BTN_SM, FIELD, FIELD_INPUT, FIELD_LABEL, FILTERBAR, FORM_GRID, SELECT, STACK, TD_NUM, TD_T1, TD_T2, TH_NUM, UNIT } from '@/components/admin/styles';

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

const KIND_OPTIONS = [
  { value: '', label: 'All kinds' },
  { value: 'percent', label: 'Percent' },
  { value: 'flat', label: 'Flat' },
  { value: 'referral', label: 'Referral' },
];

const VALIDITY_OPTIONS = [
  { value: '', label: 'All validity' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'not started', label: 'Not started' },
];

const EMPTY_FORM = {
  boatId: '',
  code: '',
  kind: 'percent' as 'percent' | 'flat' | 'referral',
  value: '',
  validFrom: '',
  validTo: '',
};

export default function Coupons() {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');
  const [validityFilter, setValidityFilter] = useState('');
  const { items, error, isInitialLoading, hasMore, loadMore, mutate } =
    useAdminList<CouponRow>('/platform/finance/coupons', {
      q: query || undefined,
      kind: kind || undefined,
      limit: 25,
    });

  // Validity is derived from dates (not a DB column), so it's filtered on the
  // client over the rows the backend already narrowed by search + kind.
  const rows = validityFilter
    ? items.filter((c) => validity(c).label === validityFilter)
    : items;
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
          <button className={BTN_B} onClick={() => { setFormError(null); setOpen(true); }}>
            + New coupon
          </button>
        }
      />
      <div className={FILTERBAR}>
        <Search
          placeholder="Search code or boat…"
          maxWidth={360}
          value={query}
          onChange={setQuery}
        />
        <Select options={KIND_OPTIONS} value={kind} onChange={setKind} />
        <Select
          options={VALIDITY_OPTIONS}
          value={validityFilter}
          onChange={setValidityFilter}
        />
      </div>
      <Card flush>
        {error ? (
          <ErrorState error={error} onRetry={() => mutate()} />
        ) : !isInitialLoading && rows.length === 0 ? (
          <EmptyState
            title={
              query || kind || validityFilter ? 'No coupons match' : 'No coupons yet'
            }
            desc={
              query || kind || validityFilter
                ? 'Try a different search or filter.'
                : 'Create one with the button above, or boat owners can add their own.'
            }
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Boat</th>
                  <th>Kind</th>
                  <th className={TH_NUM}>Value</th>
                  <th className={TH_NUM}>Uses</th>
                  <th>Valid</th>
                  <th>Status</th>
                </tr>
              </thead>
              {isInitialLoading ? (
                <TableSkeleton rows={4} cols={7} />
              ) : (
                <tbody>
                  {rows.map((c) => {
                    const v = validity(c);
                    return (
                      <tr key={c.id}>
                        <td className={TD_T1}>{c.code}</td>
                        <td>{c.houseboat.name}</td>
                        <td><Tag>{c.kind}</Tag></td>
                        <td className={TD_NUM}>
                          {c.kind === 'percent' ? (
                            `${c.value}%`
                          ) : (
                            <><span className={UNIT}>৳</span> {formatBDT(c.value)}</>
                          )}
                        </td>
                        <td className={TD_NUM}>{c._count.bookings}</td>
                        <td className={TD_T2}>
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
                <button className={`${BTN_O} ${BTN_SM}`} onClick={loadMore}>
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
            <button className={BTN_O} onClick={() => setOpen(false)}>Cancel</button>
            <button className={BTN_B} disabled={busy} onClick={create}>
              {busy ? 'Creating…' : '+ Create coupon'}
            </button>
          </>
        }
      >
        <div className={STACK} style={{ gap: 14 }}>
          <div className={FORM_GRID}>
            <div className={FIELD}>
              <label className={FIELD_LABEL}>Boat</label>
              <select
                className={FIELD_INPUT}
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
            <div className={FIELD}>
              <label className={FIELD_LABEL}>Code</label>
              <input
                className={FIELD_INPUT}
                placeholder="e.g. MONSOON25"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div className={FIELD}>
              <label className={FIELD_LABEL}>Kind</label>
              <select
                className={FIELD_INPUT}
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
            <div className={FIELD}>
              <label className={FIELD_LABEL}>{form.kind === 'percent' ? 'Value (%)' : 'Value (৳)'}</label>
              <input
                className={FIELD_INPUT}
                type="number"
                min={0}
                step="0.01"
                placeholder={form.kind === 'percent' ? 'e.g. 10' : 'e.g. 500'}
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </div>
            <div className={FIELD}>
              <label className={FIELD_LABEL}>Valid from</label>
              <input
                className={FIELD_INPUT}
                type="date"
                value={form.validFrom}
                onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
              />
            </div>
            <div className={FIELD}>
              <label className={FIELD_LABEL}>Valid to</label>
              <input
                className={FIELD_INPUT}
                type="date"
                value={form.validTo}
                onChange={(e) => setForm({ ...form, validTo: e.target.value })}
              />
            </div>
          </div>
          {formError ? (
            <div role="alert"><Note kind="danger" icon="⚠">{formError}</Note></div>
          ) : null}
        </div>
      </Drawer>
    </>
  );
}
