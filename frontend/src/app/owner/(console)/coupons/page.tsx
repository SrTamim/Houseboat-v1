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
  EmptyState,
} from '@/components/owner/ui';
import { BTN_B, BTN_O } from '@/components/owner/buttons';
import { Pill } from '@/components/owner/Pill';
import { Drawer } from '@/components/owner/Drawer';
import { Bill } from '@/components/owner/Bill';
import { money, formatDate, apiErrorMessage } from '@/lib/owner/format';

interface Coupon {
  id: string;
  code: string;
  kind: string;
  value: string;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
  usageCount: number;
  totalDeducted: string;
  maxUses: number | null;
  perUserLimit: number | null;
  minSpend: string | null;
}

const KIND_TONES: Record<string, 'blue' | 'amb' | 'ok'> = {
  percent: 'blue',
  flat: 'amb',
  referral: 'ok',
};

/** True when today falls inside the coupon's date window (open-ended counts). */
function isInWindow(c: Coupon): boolean {
  const now = Date.now();
  if (c.validFrom && new Date(c.validFrom).getTime() > now) return false;
  if (c.validTo && new Date(c.validTo).getTime() < now) return false;
  return true;
}

export default function OwnerCouponsPage() {
  const { boatId } = useActiveBoat();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [kind, setKind] = useState('percent');
  const [value, setValue] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [perUserLimit, setPerUserLimit] = useState('');
  const [minSpend, setMinSpend] = useState('');

  const { data, error: loadError, isLoading, mutate } = useSWR<Coupon[]>(
    `/houseboats/${boatId}/coupons`,
    fetcher,
    { revalidateOnFocus: false },
  );

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !code || !value) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/houseboats/${boatId}/coupons`, {
        code: code.toUpperCase(),
        kind,
        value: Number(value),
        validFrom: validFrom || undefined,
        validTo: validTo || undefined,
        maxUses: maxUses ? Number(maxUses) : undefined,
        perUserLimit: perUserLimit ? Number(perUserLimit) : undefined,
        minSpend: minSpend ? Number(minSpend) : undefined,
      });
      setOpen(false);
      setCode('');
      setValue('');
      setValidFrom('');
      setValidTo('');
      setMaxUses('');
      setPerUserLimit('');
      setMinSpend('');
      await mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create the coupon.'));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(c: Coupon) {
    if (busyId) return;
    setBusyId(c.id);
    setError(null);
    try {
      await api.patch(`/houseboats/${boatId}/coupons/${c.id}/active`, {
        active: !c.isActive,
      });
      await mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update the coupon.'));
    } finally {
      setBusyId(null);
    }
  }

  const rows = data ?? [];

  return (
    <>
      <PageHead
        title="Coupons"
        desc="Your discount, your cost. A coupon comes off what the customer pays, but commission is still calculated on the original room total."
        actions={
          <button className={BTN_B} onClick={() => setOpen(true)}>
            ＋ New coupon
          </button>
        }
      />

      {error && !open ? (
        <Note kind="danger" style={{ marginBottom: 12 }}>
          {error}
        </Note>
      ) : null}

      <Card flush style={{ marginBottom: 20 }}>
        <TableWrap minWidth={1040}>
          <thead>
            <tr>
              <th>Code</th>
              <th>Kind</th>
              <th className="num">Value</th>
              <th className="num">Uses</th>
              <th className="num">Limit</th>
              <th className="num">Min spend</th>
              <th className="num">Deducted</th>
              <th>Valid from</th>
              <th>Valid to</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <AsyncTable
            isLoading={isLoading}
            error={loadError}
            isEmpty={rows.length === 0}
            onRetry={() => mutate()}
            empty={
              <EmptyState
                icon="🏷"
                title="No coupons"
                message="Create one to run an offer on your own boat."
              />
            }
          >
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="t1">{c.code}</td>
                  <td>
                    <Pill tone={KIND_TONES[c.kind] ?? 'mut'}>{c.kind}</Pill>
                  </td>
                  <td className="num" data-label="Value">
                    {c.kind === 'percent' ? `${Number(c.value)}%` : money(c.value)}
                  </td>
                  <td className="num" data-label="Uses">{c.usageCount}</td>
                  <td className="num" data-label="Limit">
                    {c.maxUses != null
                      ? `${c.usageCount}/${c.maxUses}`
                      : '∞'}
                    {c.perUserLimit != null ? ` (${c.perUserLimit}/user)` : ''}
                  </td>
                  <td className="num" data-label="Min spend">
                    {c.minSpend != null && Number(c.minSpend) > 0
                      ? money(c.minSpend)
                      : '—'}
                  </td>
                  <td className="num" data-label="Deducted">{money(c.totalDeducted)}</td>
                  <td className="t2" data-label="Valid from">{c.validFrom ? formatDate(c.validFrom) : 'always'}</td>
                  <td className="t2" data-label="Valid to">{c.validTo ? formatDate(c.validTo) : 'no end'}</td>
                  <td>
                    {!c.isActive ? (
                      <Pill tone="mut">disabled</Pill>
                    ) : (
                      <Pill tone={isInWindow(c) ? 'ok' : 'mut'}>
                        {isInWindow(c) ? 'active' : 'inactive'}
                      </Pill>
                    )}
                  </td>
                  <td>
                    <button
                      className={BTN_O}
                      onClick={() => toggleActive(c)}
                      disabled={busyId === c.id}
                    >
                      {busyId === c.id
                        ? '…'
                        : c.isActive
                          ? 'Deactivate'
                          : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </AsyncTable>
        </TableWrap>
      </Card>

      <Card title="How a coupon lands on the bill" sub="worked example">
        <div className="grid grid-cols-[2fr_1fr] items-start gap-5 max-[1024px]:grid-cols-1">
          <Bill
            rows={[
              { label: 'Room total', hint: 'Your price', value: '10000' },
              { label: 'Coupon MONSOON10 (10%)', value: '1000', negative: true },
              { label: 'Customer pays', value: '9000', total: true },
            ]}
          />
          <div className="flex flex-col gap-5" style={{ gap: 10 }}>
            <Bill
              rows={[
                { label: 'Platform receives', value: '9000', sub: true },
                {
                  label: 'Commission',
                  hint: '5% of the original ৳10,000 — not the discounted price',
                  value: '500',
                  negative: true,
                },
                { label: 'You receive', value: '8500', total: true },
              ]}
            />
            <Note kind="info">
              The coupon applies to the room total, and commission is still 5% of the
              original room total. The discount is entirely yours to absorb.
            </Note>
          </div>
        </div>
      </Card>

      <Drawer
        open={open}
        title="New coupon"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className={BTN_O} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className={BTN_B} onClick={create} disabled={busy || !code || !value}>
              {busy ? 'Creating…' : 'Create coupon'}
            </button>
          </>
        }
      >
        <form onSubmit={create} style={{ display: 'grid', gap: 12 }}>
          {error ? <Note kind="danger">{error}</Note> : null}

          <Field label="Code">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="MONSOON10"
              required
            />
          </Field>

          <Field label="Kind">
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="percent">Percent off</option>
              <option value="flat">Flat amount off</option>
              <option value="referral">Referral</option>
            </select>
          </Field>

          <Field label={kind === 'percent' ? 'Percent' : 'Amount (৳)'}>
            <input
              type="number"
              min={0}
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Valid from">
              <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </Field>
            <Field label="Valid to">
              <input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Max total uses">
              <input
                type="number"
                min={1}
                step="1"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="unlimited"
              />
            </Field>
            <Field label="Uses per customer">
              <input
                type="number"
                min={1}
                step="1"
                value={perUserLimit}
                onChange={(e) => setPerUserLimit(e.target.value)}
                placeholder="unlimited"
              />
            </Field>
          </div>

          <Field label="Minimum room total (৳)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={minSpend}
              onChange={(e) => setMinSpend(e.target.value)}
              placeholder="no minimum"
            />
          </Field>

          <Note kind="warn">
            Leaving the limits blank makes the coupon unlimited and (with no dates) valid
            forever. Set a total-use or per-customer cap so a shared code can’t be redeemed
            without bound — the discount comes out of your earnings.
          </Note>
        </form>
      </Drawer>
    </>
  );
}
