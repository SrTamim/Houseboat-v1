'use client';

import { useState } from 'react';
import {
  PageHead,
  Card,
  Select,
  Search,
  TableWrap,
  TableSkeleton,
  EmptyState,
  ErrorState,
} from '@/components/admin/ui';
import { InvoiceDetailDrawer } from '@/components/admin/InvoiceDetailDrawer';
import { Pill } from '@/components/admin/Pill';
import { useAdminList } from '@/lib/admin/useAdminList';
import { formatBDT } from '@/lib/admin/money';
import {
  shortId,
  wireStatusLabel,
  wireStatusTone,
  channelLabel,
  channelTone,
  WIRE_STATUS_LABEL,
  type ApiInvoice,
  type InvoiceWireStatus,
} from '@/lib/admin/invoices';
import {
  BTN_O,
  BTN_SM,
  FILTERBAR,
  ROWACT,
  TD_NUM,
  TD_T1,
  TD_T2,
  TH_NUM,
  UNIT,
} from '@/components/admin/styles';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function Money({ value }: { value: string }) {
  return (
    <>
      <span className={UNIT}>৳</span> {formatBDT(value)}
    </>
  );
}

/** Balance = displayTotal − amountPaid (not stored; string decimals). */
function due(inv: ApiInvoice) {
  return String(Number(inv.displayTotal) - Number(inv.amountPaid));
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...(Object.entries(WIRE_STATUS_LABEL) as [InvoiceWireStatus, string][]).map(
    ([value, label]) => ({ value, label }),
  ),
];

export default function BookingInvoice() {
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const { items, error, isInitialLoading, hasMore, loadMore, mutate } =
    useAdminList<ApiInvoice>('/platform/finance/invoices', {
      status: status || undefined,
      q: query || undefined,
      limit: 25,
    });

  return (
    <>
      <PageHead
        title="Booking Invoice"
        desc="Every booking across all boats with full billing detail. Open a row for the complete invoice."
      />

      <div className={FILTERBAR}>
        <Search
          placeholder="Search customer, phone or boat…"
          maxWidth={420}
          value={query}
          onChange={setQuery}
        />
        <Select options={STATUS_OPTIONS} value={status} onChange={setStatus} />
      </div>

      <Card flush>
        {error ? (
          <ErrorState error={error} onRetry={() => mutate()} />
        ) : !isInitialLoading && items.length === 0 ? (
          <EmptyState
            title={status || query ? 'No invoices match' : 'No bookings yet'}
            desc={
              status || query
                ? 'Try a different search or status filter.'
                : 'Booking invoices appear here as customers check out across all boats.'
            }
          />
        ) : (
          <>
            <TableWrap minWidth={1180}>
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Boat · departure</th>
                  <th>Booked</th>
                  <th>Customer</th>
                  <th className={TH_NUM}>Cabins</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Invoice</th>
                  <th className={TH_NUM}>Total</th>
                  <th className={TH_NUM}>Due</th>
                  <th className={TH_NUM}>Commission</th>
                  <th className={TH_NUM}>Pay to boat</th>
                  <th />
                </tr>
              </thead>
              {isInitialLoading ? (
                <TableSkeleton rows={6} cols={13} />
              ) : (
                <tbody>
                  {items.map((inv) => (
                    <tr key={inv.id} className="group">
                      <td>
                        <div className={TD_T1}>{shortId(inv.booking.id, 'BK')}</div>
                        <div className={TD_T2}>{inv.booking.type}</div>
                      </td>
                      <td>
                        <div className={TD_T1}>{inv.houseboat.name}</div>
                        <div className={TD_T2}>
                          {formatDate(inv.booking.departure.startDate)}
                        </div>
                      </td>
                      <td className={TD_T2}>{formatDate(inv.booking.createdAt)}</td>
                      <td>
                        <div className={TD_T1}>{inv.customer.name ?? '—'}</div>
                        <div className={TD_T2}>{inv.customer.phone}</div>
                      </td>
                      <td className={TD_NUM}>{inv.cabinCount || '—'}</td>
                      <td>
                        <Pill tone={wireStatusTone(inv.status)}>
                          {wireStatusLabel(inv.status)}
                        </Pill>
                      </td>
                      <td>
                        <Pill tone={channelTone(inv.booking.channel)}>
                          {channelLabel(inv.booking.channel)}
                        </Pill>
                      </td>
                      <td className={TD_T1}>{shortId(inv.id, 'INV')}</td>
                      <td className={TD_NUM}>
                        <Money value={inv.displayTotal} />
                      </td>
                      <td className={TD_NUM}>
                        <Money value={due(inv)} />
                      </td>
                      <td className={TD_NUM}>
                        <Money value={inv.commission} />
                      </td>
                      <td className={TD_NUM}>
                        <Money value={inv.dueToBoat} />
                      </td>
                      <td className={ROWACT}>
                        <button
                          className={`${BTN_O} ${BTN_SM}`}
                          onClick={() => setOpenId(inv.id)}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
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

      <InvoiceDetailDrawer invoiceId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
