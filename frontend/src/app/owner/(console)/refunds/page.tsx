'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import {
  PageHead,
  Card,
  Note,
  FilterBar,
  Seg,
  TableWrap,
  AsyncTable,
  Kv,
} from '@/components/owner/ui';
import { BTN, BTN_O, BTN_SM } from '@/components/owner/buttons';
import { Pill } from '@/components/owner/Pill';
import { Drawer } from '@/components/owner/Drawer';
import { InvoiceBill } from '@/components/owner/Bill';
import { money, formatDate, timeLeft, humanize } from '@/lib/owner/format';

interface OwnerRefund {
  id: string;
  amount: string;
  reason: string | null;
  status: string;
  claimDeadline: string | null;
  completedAt: string | null;
  requestedBy: string | null;
  verifiedBy: string | null;
  completedBy: string | null;
  invoiceId: string;
  customer: { name: string | null; phone: string };
  paid: string;
  bookingStatus: string;
  departureDate: string;
  isPos: boolean;
}

/** The full bill waterfall, as returned by the invoices endpoint. */
interface InvoiceDetail {
  id: string;
  roomTotal: string;
  discountAmount: string;
  displayTotal: string;
  commission: string;
  dueToBoat: string;
  amountPaid: string;
}

const STATUS_TONES: Record<string, 'amb' | 'blue' | 'ok'> = {
  requested: 'amb',
  verified: 'blue',
  completed: 'ok',
};

function invoiceRef(id: string): string {
  return `#${id.slice(-6).toUpperCase()}`;
}

const ORIGIN_OPTS = [
  { value: '', label: 'All' },
  { value: 'pos', label: 'POS' },
  { value: 'platform', label: 'Platform' },
];

const STATUS_OPTS = [
  { value: '', label: 'All' },
  { value: 'requested', label: 'Requested' },
  { value: 'verified', label: 'Verified' },
  { value: 'completed', label: 'Completed' },
];

export default function OwnerRefundsPage() {
  const { boatId } = useActiveBoat();
  const { data, error, isLoading, mutate } = useSWR<OwnerRefund[]>(
    `/houseboats/${boatId}/refunds`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const [origin, setOrigin] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<OwnerRefund | null>(null);
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);

  const rows = (data ?? []).filter((r) => {
    if (origin === 'pos' && !r.isPos) return false;
    if (origin === 'platform' && r.isPos) return false;
    if (status && r.status !== status) return false;
    return true;
  });

  // Full invoice detail for the drawer bill breakdown. The refund list only
  // carries invoiceId/paid/amount; the waterfall lives on the invoices endpoint.
  const { data: invoicePage } = useSWR<{ items: InvoiceDetail[] }>(
    open ? `/houseboats/${boatId}/invoices?limit=200` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const invoiceDetail =
    invoicePage?.items.find((i) => i.id === open?.invoiceId) ?? null;

  async function settle() {
    if (!open) return;
    setSettling(true);
    setSettleError(null);
    try {
      await api.post(`/refunds/${open.id}/settle-pos`);
      await mutate();
      setOpen(null);
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Could not settle this refund. Try again.';
      setSettleError(msg);
    } finally {
      setSettling(false);
    }
  }

  return (
    <>
      <PageHead
        title="Refunds & reschedules"
        desc={
          <>
            A refund only opens when <b>you cancelled the trip</b>, and only within the
            6-day claim window. Counter-sale (POS) refunds are settled here by you;
            website (platform) refunds are settled by the platform.
          </>
        }
      />

      <FilterBar>
        <Seg options={ORIGIN_OPTS} value={origin} onChange={setOrigin} />
        <Seg options={STATUS_OPTS} value={status} onChange={setStatus} />
      </FilterBar>

      <Card title="Refund claims" sub="owner-cancelled trips" flush style={{ marginBottom: 20 }}>
        <TableWrap minWidth={880}>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Guest</th>
              <th>Origin</th>
              <th className="num">Paid</th>
              <th className="num">Refund</th>
              <th>Deadline</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <AsyncTable
            isLoading={isLoading}
            error={error}
            isEmpty={rows.length === 0}
            onRetry={() => mutate()}
            empty={
              <div className="px-6 py-11 text-center text-muted">
                <div className="mb-2.5 text-[26px]">↩</div>
                <h4 className="mb-1.5 text-[15px] text-ink">No refunds</h4>
                <p className="mx-auto max-w-[46ch] text-[13px] leading-[1.55]">
                  Nothing matches this filter. Refunds only appear here when you cancel a
                  departure.
                </p>
              </div>
            }
          >
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="t1">{invoiceRef(r.invoiceId)}</td>
                  <td>
                    <div className="t1">{r.customer.name ?? 'Guest'}</div>
                    <div className="t2">{formatDate(r.departureDate)}</div>
                  </td>
                  <td>
                    <Pill tone={r.isPos ? 'amb' : 'blue'}>{r.isPos ? 'POS' : 'Platform'}</Pill>
                  </td>
                  <td className="num">{money(r.paid)}</td>
                  <td className="num">{money(r.amount)}</td>
                  <td>
                    {r.claimDeadline ? (
                      <Pill tone={timeLeft(r.claimDeadline) === 'expired' ? 'mut' : 'warn'}>
                        {timeLeft(r.claimDeadline)}
                      </Pill>
                    ) : (
                      <span className="t2">—</span>
                    )}
                  </td>
                  <td>
                    <Pill tone={STATUS_TONES[r.status] ?? 'mut'}>{humanize(r.status)}</Pill>
                  </td>
                  <td>
                    <div className="rowact">
                      <button
                        className={`${BTN_O} ${BTN_SM}`}
                        onClick={() => {
                          setSettleError(null);
                          setOpen(r);
                        }}
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </AsyncTable>
        </TableWrap>
      </Card>

      <Card title="Refund flow · 3-person separation">
        <Note kind="info">
          <b>requested_by → verified_by → completed_by</b> must be three different people
          for a platform refund — finance collects the bank details and makes the
          transfer, and the database rejects a completion by whoever verified it. A
          counter-sale (POS) refund has no finance in the middle, so you settle it in one
          step below.
        </Note>
      </Card>

      <Drawer
        open={open !== null}
        title={open ? `Refund ${invoiceRef(open.invoiceId)}` : 'Refund'}
        onClose={() => setOpen(null)}
        footer={
          <button className={BTN_O} onClick={() => setOpen(null)}>
            Close
          </button>
        }
      >
        {open ? (
          <div className="flex flex-col gap-5" style={{ gap: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Pill tone={STATUS_TONES[open.status] ?? 'mut'}>{humanize(open.status)}</Pill>
              <Pill tone={open.isPos ? 'amb' : 'blue'}>{open.isPos ? 'Counter' : 'Website'}</Pill>
            </div>

            <Kv
              rows={[
                ['Guest', open.customer.name ?? '—'],
                ['Phone', open.customer.phone],
                ['Departure', formatDate(open.departureDate)],
                ['Booking', humanize(open.bookingStatus)],
              ]}
            />

            <div>
              <h4
                style={{
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '.05em',
                  color: 'var(--muted)',
                  marginBottom: 10,
                }}
              >
                Current invoice
              </h4>
              {invoiceDetail ? (
                <InvoiceBill invoice={invoiceDetail} />
              ) : (
                <Kv
                  rows={[
                    ['Paid so far', money(open.paid)],
                    ['Refund amount', money(open.amount)],
                  ]}
                />
              )}
            </div>

            <div>
              <h4
                style={{
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '.05em',
                  color: 'var(--muted)',
                  marginBottom: 10,
                }}
              >
                Refund details
              </h4>
              <Kv
                rows={[
                  ['Refund amount', money(open.amount)],
                  ['Reason', open.reason ?? '—'],
                  [
                    'Claim deadline',
                    open.claimDeadline ? timeLeft(open.claimDeadline) : '—',
                  ],
                  ['Requested by', open.requestedBy ?? '—'],
                  ['Verified by', open.verifiedBy ?? '—'],
                  ['Completed by', open.completedBy ?? '—'],
                ]}
              />
            </div>

            {settleError ? (
              <div className="flex items-start gap-2.5 rounded border border-[color-mix(in_srgb,var(--warn)_20%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-[15px] py-3 text-[13px] font-medium leading-[1.5] text-warn">
                <span className="flex-none text-[15px] leading-[1.3]">⚠</span>
                <span>{settleError}</span>
              </div>
            ) : null}

            {open.status === 'completed' ? (
              <Note kind="ok">This refund is settled.</Note>
            ) : open.isPos ? (
              <button className={BTN} onClick={settle} disabled={settling}>
                {settling ? 'Marking…' : 'Mark as refunded'}
              </button>
            ) : (
              <Note kind="info">
                The platform settles this refund through its own verify-then-complete
                flow. You don&apos;t action it here.
              </Note>
            )}
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
