'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useActiveBoat } from '@/lib/owner/boat-context';
import { useOwnerList } from '@/lib/owner/useOwnerList';
import {
  PageHead,
  Card,
  FilterBar,
  Seg,
  Search,
  TableWrap,
  AsyncTable,
  LoadMore,
} from '@/components/owner/ui';
import { InvoiceStatusPill, Pill } from '@/components/owner/Pill';
import { Drawer } from '@/components/owner/Drawer';
import { InvoiceBill } from '@/components/owner/Bill';
import { money, formatDate, maskPhone } from '@/lib/owner/format';

interface OwnerInvoice {
  id: string;
  roomTotal: string;
  gatewayFee: string;
  priceShown: string;
  discountAmount: string;
  displayTotal: string;
  commission: string;
  dueToBoat: string;
  amountPaid: string;
  amountOverpaid: string;
  policySnapshot: Record<string, unknown> | null;
  payoutBatchId: string | null;
  status: string;
  customer: { id: string; name: string | null; phone: string };
  booking: {
    id: string;
    type: string;
    status: string;
    departure: { startDate: string; package: { durationLabel: string | null } };
  };
  payments: {
    id: string;
    amount: string;
    method: string;
    paidAt: string | null;
    verifiedBy: string | null;
    receivedByAccount: { name: string | null } | null;
    verifiedByAccount: { name: string | null } | null;
  }[];
}

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'customer_due', label: 'Due' },
  { value: 'paid', label: 'Paid' },
  { value: 'payment_verified', label: 'Verified' },
  { value: 'in_payout', label: 'In payout' },
  { value: 'bill_cleared', label: 'Cleared' },
];

/** Short reference for an invoice row — the uuid itself is unreadable. */
function invoiceRef(id: string): string {
  return `#${id.slice(-6).toUpperCase()}`;
}

export default function OwnerInvoicesPage() {
  const { boatId } = useActiveBoat();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<OwnerInvoice | null>(null);

  const { items, error, isLoading, isInitialLoading, hasMore, loadMore, mutate } =
    useOwnerList<OwnerInvoice>(`/houseboats/${boatId}/invoices`, { status, q });

  return (
    <>
      <PageHead
        title="Invoices"
        desc={
          <>
            One invoice per booking, moving through{' '}
            <b>customer_due → paid → payment_verified → in_payout → bill_cleared</b>. Once
            an invoice enters a payout batch it locks, so no refund can double-spend it.
          </>
        }
      />

      <FilterBar>
        <Seg options={STATUSES} value={status} onChange={setStatus} />
        <Search placeholder="Guest name or phone…" value={q} onChange={setQ} />
      </FilterBar>

      <Card flush>
        <TableWrap minWidth={840}>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Guest</th>
              <th>Trip</th>
              <th className="num">Room</th>
              <th className="num">Pays</th>
              <th className="num">You get</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <AsyncTable
            isLoading={isInitialLoading}
            error={error}
            isEmpty={items.length === 0}
            onRetry={() => mutate()}
          >
            <tbody>
              {items.map((inv) => (
                <tr key={inv.id}>
                  <td className="t1">{invoiceRef(inv.id)}</td>
                  <td>
                    <div className="t1">{inv.customer.name ?? 'Guest'}</div>
                    <div className="t2">{maskPhone(inv.customer.phone)}</div>
                  </td>
                  <td>
                    <div className="t1">{inv.booking.departure.package.durationLabel ?? '—'}</div>
                    <div className="t2">{formatDate(inv.booking.departure.startDate)}</div>
                  </td>
                  <td className="num">{money(inv.roomTotal)}</td>
                  <td className="num">{money(inv.displayTotal)}</td>
                  <td className="num">{money(inv.dueToBoat)}</td>
                  <td>
                    {inv.payoutBatchId ? (
                      <Pill tone="lock">in payout</Pill>
                    ) : (
                      <InvoiceStatusPill status={inv.status} />
                    )}
                  </td>
                  <td>
                    <div className="rowact">
                      <button className="btn btn-sm btn-o" onClick={() => setOpen(inv)}>
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </AsyncTable>
        </TableWrap>
        <LoadMore hasMore={hasMore} isLoading={isLoading} onClick={loadMore} />
      </Card>

      <Drawer
        open={open !== null}
        title={open ? `Invoice ${invoiceRef(open.id)}` : ''}
        onClose={() => setOpen(null)}
        footer={
          <>
            <button className="btn btn-o" onClick={() => setOpen(null)}>
              Close
            </button>
            {open?.payments.some((p) => p.method === 'cash' && !p.verifiedBy) ? (
              <Link className="btn btn-b" href="/owner/payments">
                Verify cash →
              </Link>
            ) : null}
          </>
        }
      >
        {open ? (
          <div className="stack" style={{ gap: 16 }}>
            <div>
              <InvoiceStatusPill status={open.status} />
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
                Bill breakdown
              </h4>
              <InvoiceBill invoice={open} />
            </div>

            <div>
              <h4
                style={{
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '.05em',
                  color: 'var(--muted)',
                  marginBottom: 8,
                }}
              >
                Payments
              </h4>
              {open.payments.length === 0 ? (
                <div className="note info">
                  <span className="ic">ℹ</span>
                  <span>Nothing received against this invoice yet.</span>
                </div>
              ) : (
                <TableWrap minWidth={0}>
                  <tbody>
                    {open.payments.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <Pill tone={p.method === 'cash' ? 'amb' : 'blue'}>{p.method}</Pill>
                        </td>
                        <td className="num">{money(p.amount)}</td>
                        <td className="t2">
                          {p.verifiedBy
                            ? `verified · ${p.verifiedByAccount?.name ?? ''}`
                            : 'unverified'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              )}
            </div>

            {open.policySnapshot ? (
              <div>
                <h4
                  style={{
                    fontSize: 12,
                    textTransform: 'uppercase',
                    letterSpacing: '.05em',
                    color: 'var(--muted)',
                    marginBottom: 8,
                  }}
                >
                  Policy snapshot
                </h4>
                <div className="note info">
                  <span className="ic">🔒</span>
                  <span>
                    The cancellation policy agreed at checkout is stamped onto this
                    invoice. This is what a dispute cites — later policy edits do not
                    change it.
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
