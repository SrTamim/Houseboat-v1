'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import {
  PageHead,
  Card,
  FilterBar,
  Seg,
  Field,
  Note,
  TableWrap,
  AsyncTable,
  Kv,
} from '@/components/owner/ui';
import { BTN_B, BTN_O, BTN_SM } from '@/components/owner/buttons';
import { Pill } from '@/components/owner/Pill';
import { Drawer } from '@/components/owner/Drawer';
import {
  money,
  formatDate,
  timeLeft,
  maskPhone,
  humanize,
  apiErrorMessage,
} from '@/lib/owner/format';

interface Quote {
  id: string;
  date: string | null;
  groupSize: number | null;
  specialNeeds: string | null;
  quotedPrice: string | null;
  customerReply: string | null;
  status: string;
  expiresAt: string | null;
  customer?: { id: string; name: string | null; phone: string | null };
}

const STATUS_TONES: Record<string, 'amb' | 'blue' | 'ok' | 'mut'> = {
  requested: 'amb',
  sent: 'blue',
  accepted: 'ok',
  expired: 'mut',
};

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'requested', label: 'Requested' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'expired', label: 'Expired' },
];

export default function OwnerQuotesPage() {
  const { boatId } = useActiveBoat();
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState<Quote | null>(null);
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, error: loadError, isLoading, mutate } = useSWR<Quote[]>(
    `/houseboats/${boatId}/quotes`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const rows = (data ?? []).filter((q) => !filter || q.status === filter);
  const counts = (data ?? []).reduce<Record<string, number>>((acc, q) => {
    acc[q.status] = (acc[q.status] ?? 0) + 1;
    return acc;
  }, {});

  // A quote can still be (re)priced only while pending with the customer.
  // Accepted/expired quotes open the same drawer read-only.
  const priceable =
    open ? open.status === 'requested' || open.status === 'sent' : false;

  async function sendQuote(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !open || !price) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/quotes/${open.id}/price`, { quotedPrice: Number(price) });
      setOpen(null);
      setPrice('');
      await mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not send the quote.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="Quote requests"
        desc="Groups asking for a full-boat price. Quote them yourself — a request expires 24 hours after it arrives, or as soon as the date fills."
      />

      <FilterBar>
        <Seg
          options={FILTERS.map((f) => ({
            ...f,
            count: f.value ? counts[f.value] : data?.length,
          }))}
          value={filter}
          onChange={setFilter}
        />
      </FilterBar>

      <Card flush>
        <TableWrap minWidth={860}>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Date</th>
              <th>Group</th>
              <th>Special needs</th>
              <th>Expires</th>
              <th className="num">Quoted</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <AsyncTable
            isLoading={isLoading}
            error={loadError}
            isEmpty={rows.length === 0}
            onRetry={() => mutate()}
            empty={
              <div className="px-6 py-11 text-center text-muted">
                <div className="mb-2.5 text-[26px]">💬</div>
                <h4 className="mb-1.5 text-[15px] text-ink">No quote requests</h4>
                <p className="mx-auto max-w-[46ch] text-[13px] leading-[1.55]">
                  Groups can request a full-boat price from your public boat page.
                </p>
              </div>
            }
          >
            <tbody>
              {rows.map((q) => (
                <tr key={q.id}>
                  <td>
                    <div className="t1">{q.customer?.name ?? 'Guest'}</div>
                    <div className="t2">{maskPhone(q.customer?.phone)}</div>
                  </td>
                  <td className="t2">{formatDate(q.date)}</td>
                  <td>{q.groupSize ?? '—'}</td>
                  <td className="t2">
                    {q.specialNeeds ?? '—'}
                    {q.customerReply ? (
                      <div className="mt-1 text-[12px] text-blue">
                        💬 {q.customerReply}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    {q.expiresAt ? (
                      <Pill tone={timeLeft(q.expiresAt) === 'expired' ? 'mut' : 'warn'}>
                        {timeLeft(q.expiresAt)}
                      </Pill>
                    ) : (
                      <span className="t2">—</span>
                    )}
                  </td>
                  <td className="num">{q.quotedPrice ? money(q.quotedPrice) : '—'}</td>
                  <td>
                    <Pill tone={STATUS_TONES[q.status] ?? 'mut'}>{humanize(q.status)}</Pill>
                  </td>
                  <td>
                    <div className="rowact">
                      <button
                        className={`${BTN_O} ${BTN_SM}`}
                        onClick={() => {
                          setOpen(q);
                          setPrice(q.quotedPrice ?? '');
                          setError(null);
                        }}
                      >
                        {q.status === 'requested' || q.status === 'sent'
                          ? q.quotedPrice
                            ? 'Reprice'
                            : 'Price it'
                          : 'View'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </AsyncTable>
        </TableWrap>
      </Card>

      <Drawer
        open={open !== null}
        title={priceable ? 'Price this quote' : 'Quote details'}
        onClose={() => setOpen(null)}
        footer={
          priceable ? (
            <>
              <button className={BTN_O} onClick={() => setOpen(null)}>
                Cancel
              </button>
              <button className={BTN_B} onClick={sendQuote} disabled={busy || !price}>
                {busy ? 'Sending…' : 'Send quote'}
              </button>
            </>
          ) : (
            <button className={BTN_O} onClick={() => setOpen(null)}>
              Close
            </button>
          )
        }
      >
        {open ? (
          <div className="flex flex-col gap-5" style={{ gap: 16 }}>
            {open.expiresAt ? (
              <div>
                <Pill tone={timeLeft(open.expiresAt) === 'expired' ? 'mut' : 'warn'}>
                  {timeLeft(open.expiresAt)}
                </Pill>
              </div>
            ) : null}

            {error ? <Note kind="danger">{error}</Note> : null}

            <Kv
              rows={[
                ['Customer', open.customer?.name ?? 'Guest'],
                ['Phone', open.customer?.phone ?? '—'],
                ['Date', formatDate(open.date)],
                ['Group size', open.groupSize ?? '—'],
                ['Special needs', open.specialNeeds ?? '—'],
                ['Customer reply', open.customerReply ?? '—'],
                ...(priceable
                  ? []
                  : [['Quoted price', open.quotedPrice ? money(open.quotedPrice) : '—'] as [
                      string,
                      string,
                    ]]),
              ]}
            />

            {priceable ? (
              <>
                <Field label="Quoted price (৳)">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="150000"
                  />
                </Field>

                <Note kind="info">
                  This is a whole-boat price for the whole group — it replaces per-cabin
                  pricing for this booking. Compare it against your group price bands
                  before sending.
                </Note>
              </>
            ) : (
              <Note kind={open.status === 'accepted' ? 'info' : 'danger'}>
                {open.status === 'accepted'
                  ? 'The customer accepted this quote. It can no longer be repriced.'
                  : 'This quote expired before it was accepted.'}
              </Note>
            )}
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
