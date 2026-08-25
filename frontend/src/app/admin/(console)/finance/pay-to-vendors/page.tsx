'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import {
  PageHead,
  Card,
  Note,
  Select,
  Search,
  TableWrap,
  TableSkeleton,
  EmptyState,
  ErrorState,
} from '@/components/admin/ui';
import { PayoutReceiptDrawer } from '@/components/admin/PayoutReceiptDrawer';
import { useAdminList } from '@/lib/admin/useAdminList';
import { apiErrorMessage } from '@/lib/admin/api-error';
import { formatBDT } from '@/lib/admin/money';
import { shortId } from '@/lib/admin/invoices';
import type { ApiInvoice } from '@/lib/admin/invoices';
import { BTN_B, BTN_O, BTN_SM, FILTERBAR, ROWACT, TD_NUM, TD_T1, TD_T2, UNIT } from '@/components/admin/styles';

interface PayableBoat {
  id: string;
  name: string;
  count: number;
}

interface ReceiptRow {
  id: string;
  totalAmount: string;
  paidAt: string | null;
  houseboat: { id: string; name: string };
  paidByAccount: { id: string; name: string | null } | null;
  _count: { invoices: number };
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function PayToVendors() {
  const boats = useSWR<PayableBoat[]>(
    '/platform/finance/payable-boats?stage=pay',
    fetcher,
    { revalidateOnFocus: false },
  );
  const [boatId, setBoatId] = useState('');

  // Approved invoices for the chosen boat (no boat → nothing to build).
  const approved = useAdminList<ApiInvoice>('/platform/finance/invoices', {
    status: 'payout_approved',
    houseboatId: boatId || undefined,
    limit: 100,
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [openReceipt, setOpenReceipt] = useState<string | null>(null);

  // Past receipts (searchable), independent of the boat picker.
  const [receiptQuery, setReceiptQuery] = useState('');
  const receipts = useAdminList<ReceiptRow>('/platform/finance/payout-receipts', {
    q: receiptQuery || undefined,
    limit: 20,
  });

  const boatOptions = useMemo(
    () => [
      { value: '', label: 'Select a boat…' },
      ...(boats.data ?? []).map((b) => ({
        value: b.id,
        label: `${b.name} (${b.count})`,
      })),
    ],
    [boats.data],
  );

  const rows = useMemo(
    () => (boatId ? approved.items : []),
    [boatId, approved.items],
  );
  const selectedTotal = useMemo(
    () =>
      rows
        .filter((inv) => selected.has(inv.id))
        .reduce((sum, inv) => sum + Number(inv.dueToBoat), 0),
    [rows, selected],
  );
  const allSelected = rows.length > 0 && selected.size === rows.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function onBoatChange(id: string) {
    setBoatId(id);
    setSelected(new Set());
    setActionError(null);
  }

  async function pay() {
    if (busy || !boatId || selected.size === 0) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await api.post('/platform/finance/payouts/pay', {
        houseboatId: boatId,
        invoiceIds: [...selected],
      });
      setSelected(new Set());
      await Promise.all([approved.mutate(), boats.mutate(), receipts.mutate()]);
      const receiptId = (res.data as { receiptId?: string })?.receiptId;
      if (receiptId) setOpenReceipt(receiptId);
    } catch (e) {
      setActionError(apiErrorMessage(e, 'Could not record this vendor payment.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="Pay to Vendors"
        desc="Pick a boat, select the approved invoices you're paying, then mark them paid to the vendor. A printable payout receipt is generated for each payment."
      />

      <Card title="Batch payout" style={{ marginBottom: 20 }}>
        <div className={FILTERBAR}>
          <Select options={boatOptions} value={boatId} onChange={onBoatChange} />
          {boatId ? (
            <div className="ml-auto flex items-center gap-3">
              <span className={TD_T2}>
                {selected.size} selected ·{' '}
                <b className="text-ink">
                  <span className={UNIT}>৳</span> {formatBDT(String(selectedTotal))}
                </b>
              </span>
              <button
                className={`${BTN_B} ${BTN_SM}`}
                disabled={busy || selected.size === 0}
                onClick={pay}
              >
                {busy ? 'Paying…' : 'Mark paid to vendor'}
              </button>
            </div>
          ) : null}
        </div>
        {actionError ? (
          <div className="mb-3" role="alert">
            <Note kind="danger" icon="⚠">{actionError}</Note>
          </div>
        ) : null}

        {!boatId ? (
          <EmptyState
            title="Pick a boat to pay"
            desc="Only boats with approved-for-payout invoices are listed above."
          />
        ) : approved.error ? (
          <ErrorState error={approved.error} onRetry={() => approved.mutate()} />
        ) : !approved.isInitialLoading && rows.length === 0 ? (
          <EmptyState
            title="No approved invoices"
            desc="This boat has no invoices approved for payout. Approve some on the Payouts page first."
          />
        ) : (
          <TableWrap minWidth={760}>
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    onChange={toggleAll}
                  />
                </th>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Trip start</th>
                <th className={TD_NUM}>Paid to boat</th>
              </tr>
            </thead>
            {approved.isInitialLoading ? (
              <TableSkeleton rows={5} cols={5} />
            ) : (
              <tbody>
                {rows.map((inv) => (
                  <tr key={inv.id} className="group">
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${shortId(inv.id, 'INV')}`}
                        checked={selected.has(inv.id)}
                        onChange={() => toggle(inv.id)}
                      />
                    </td>
                    <td>
                      <div className={TD_T1}>{shortId(inv.id, 'INV')}</div>
                      <div className={TD_T2}>{shortId(inv.booking.id, 'BK')}</div>
                    </td>
                    <td>
                      <div className={TD_T1}>{inv.customer.name ?? '—'}</div>
                      <div className={TD_T2}>{inv.customer.phone}</div>
                    </td>
                    <td className={TD_T2}>{formatDate(inv.booking.departure.startDate)}</td>
                    <td className={TD_NUM}>
                      <span className={UNIT}>৳</span> {formatBDT(inv.dueToBoat)}
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </TableWrap>
        )}
      </Card>

      <PageHead title="Past receipts" desc="Every vendor payment made, most recent first." />
      <div className={FILTERBAR}>
        <Search
          placeholder="Search by boat name…"
          value={receiptQuery}
          onChange={setReceiptQuery}
        />
      </div>
      <Card flush>
        {receipts.error ? (
          <ErrorState error={receipts.error} onRetry={() => receipts.mutate()} />
        ) : !receipts.isInitialLoading && receipts.items.length === 0 ? (
          <EmptyState
            title={receiptQuery ? 'No receipts match' : 'No payouts yet'}
            desc={
              receiptQuery
                ? 'Try a different boat name.'
                : 'Receipts appear here after you mark invoices paid to a vendor.'
            }
          />
        ) : (
          <>
            <TableWrap minWidth={760}>
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Boat</th>
                  <th className={TD_NUM}>Invoices</th>
                  <th className={TD_NUM}>Total</th>
                  <th>Paid on</th>
                  <th />
                </tr>
              </thead>
              {receipts.isInitialLoading ? (
                <TableSkeleton rows={5} cols={6} />
              ) : (
                <tbody>
                  {receipts.items.map((r) => (
                    <tr key={r.id} className="group">
                      <td className={TD_T1}>{shortId(r.id, 'PR')}</td>
                      <td>{r.houseboat.name}</td>
                      <td className={TD_NUM}>{r._count.invoices}</td>
                      <td className={TD_NUM}>
                        <span className={UNIT}>৳</span> {formatBDT(r.totalAmount)}
                      </td>
                      <td className={TD_T2}>{formatDate(r.paidAt)}</td>
                      <td className={ROWACT}>
                        <button
                          className={`${BTN_O} ${BTN_SM}`}
                          onClick={() => setOpenReceipt(r.id)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </TableWrap>
            {receipts.hasMore ? (
              <div style={{ padding: 12, textAlign: 'center' }}>
                <button className={`${BTN_O} ${BTN_SM}`} onClick={receipts.loadMore}>
                  Load more
                </button>
              </div>
            ) : null}
          </>
        )}
      </Card>

      <PayoutReceiptDrawer
        receiptId={openReceipt}
        onClose={() => setOpenReceipt(null)}
      />
    </>
  );
}
