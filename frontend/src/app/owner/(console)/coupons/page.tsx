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
import { Bill } from '@/components/owner/Bill';
import { money, formatDate, apiErrorMessage } from '@/lib/owner/format';

interface Coupon {
  id: string;
  code: string;
  kind: string;
  value: string;
  validFrom: string | null;
  validTo: string | null;
}

const KIND_TONES: Record<string, 'blue' | 'amb' | 'ok'> = {
  percent: 'blue',
  flat: 'amb',
  referral: 'ok',
};

/** A coupon is live when today falls inside its window (open-ended counts). */
function isActive(c: Coupon): boolean {
  const now = Date.now();
  if (c.validFrom && new Date(c.validFrom).getTime() > now) return false;
  if (c.validTo && new Date(c.validTo).getTime() < now) return false;
  return true;
}

export default function OwnerCouponsPage() {
  const { boatId } = useActiveBoat();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [kind, setKind] = useState('percent');
  const [value, setValue] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');

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
      });
      setOpen(false);
      setCode('');
      setValue('');
      setValidFrom('');
      setValidTo('');
      await mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create the coupon.'));
    } finally {
      setBusy(false);
    }
  }

  const rows = data ?? [];

  return (
    <>
      <PageHead
        title="Coupons"
        desc="Your discount, your cost. A coupon comes off what the customer pays, but commission is still calculated on the original room total."
        actions={
          <button className="btn btn-b" onClick={() => setOpen(true)}>
            ＋ New coupon
          </button>
        }
      />

      <Card flush style={{ marginBottom: 20 }}>
        <TableWrap minWidth={680}>
          <thead>
            <tr>
              <th>Code</th>
              <th>Kind</th>
              <th className="num">Value</th>
              <th>Valid from</th>
              <th>Valid to</th>
              <th>Status</th>
            </tr>
          </thead>
          <AsyncTable
            isLoading={isLoading}
            error={loadError}
            isEmpty={rows.length === 0}
            onRetry={() => mutate()}
            empty={
              <div className="state">
                <div className="ic">🏷</div>
                <h4>No coupons</h4>
                <p>Create one to run an offer on your own boat.</p>
              </div>
            }
          >
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="t1">{c.code}</td>
                  <td>
                    <Pill tone={KIND_TONES[c.kind] ?? 'mut'}>{c.kind}</Pill>
                  </td>
                  <td className="num">
                    {c.kind === 'percent' ? `${Number(c.value)}%` : money(c.value)}
                  </td>
                  <td className="t2">{c.validFrom ? formatDate(c.validFrom) : 'always'}</td>
                  <td className="t2">{c.validTo ? formatDate(c.validTo) : 'no end'}</td>
                  <td>
                    <Pill tone={isActive(c) ? 'ok' : 'mut'}>
                      {isActive(c) ? 'active' : 'inactive'}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </AsyncTable>
        </TableWrap>
      </Card>

      <Card title="How a coupon lands on the bill" sub="worked example">
        <div className="grid-2">
          <Bill
            rows={[
              { label: 'Room total', hint: 'Your price', value: '10000' },
              { label: 'Gateway fee (1.8%)', value: '180', sub: true },
              { label: 'Shown to customer', value: '10180', sub: true },
              { label: 'Coupon MONSOON10 (10%)', value: '1018', negative: true },
              { label: 'Customer pays', value: '9162', total: true },
            ]}
          />
          <div className="stack" style={{ gap: 10 }}>
            <Bill
              rows={[
                { label: 'Platform receives', value: '8982', sub: true },
                {
                  label: 'Commission',
                  hint: '5% of the original ৳10,000 — not the discounted price',
                  value: '500',
                  negative: true,
                },
                { label: 'You receive', value: '8482', total: true },
              ]}
            />
            <Note kind="info">
              The coupon applies last, after the gateway fee, and commission is still 5% of
              the original room total. The discount is entirely yours to absorb.
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
            <button className="btn btn-o" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-b" onClick={create} disabled={busy || !code || !value}>
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

          <Note kind="warn">
            Leaving both dates blank makes the coupon valid forever. There is no usage cap,
            so treat an open-ended percent coupon carefully.
          </Note>
        </form>
      </Drawer>
    </>
  );
}
