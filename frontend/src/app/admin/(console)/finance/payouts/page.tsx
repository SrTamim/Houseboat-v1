'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { PageHead, Note, Select } from '@/components/admin/ui';
import { PlatformInvoiceTable } from '@/components/admin/PlatformInvoiceTable';
import { InvoiceDetailDrawer } from '@/components/admin/InvoiceDetailDrawer';
import { useAdminList } from '@/lib/admin/useAdminList';
import { apiErrorMessage } from '@/lib/admin/api-error';
import type { ApiInvoice } from '@/lib/admin/invoices';
import { FILTERBAR } from '@/components/admin/styles';

interface PayableBoat {
  id: string;
  name: string;
  count: number;
}

export default function Payouts() {
  const boats = useSWR<PayableBoat[]>(
    '/platform/finance/payable-boats?stage=approve',
    fetcher,
    { revalidateOnFocus: false },
  );
  const [boatId, setBoatId] = useState('');

  const { items, error, isInitialLoading, hasMore, loadMore, mutate } =
    useAdminList<ApiInvoice>('/platform/finance/invoices', {
      payoutQueue: true,
      houseboatId: boatId || undefined,
      limit: 20,
    });

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const boatOptions = useMemo(
    () => [
      { value: '', label: 'All boats' },
      ...(boats.data ?? []).map((b) => ({
        value: b.id,
        label: `${b.name} (${b.count})`,
      })),
    ],
    [boats.data],
  );

  async function act(invoice: ApiInvoice, kind: 'approve' | 'reject') {
    if (busyId) return;
    setBusyId(invoice.id);
    setActionError(null);
    try {
      await api.post(`/platform/finance/invoices/${invoice.id}/${kind}-payout`);
      await Promise.all([mutate(), boats.mutate()]);
    } catch (e) {
      setActionError(
        apiErrorMessage(e, `Could not ${kind} this invoice for payout.`),
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHead
        title="Payouts"
        desc="Only fully-paid invoices for completed trips appear here. Approve an invoice to queue it for vendor payment, or reject it back to the verify queue. Approved invoices are paid on the Pay to Vendors page."
      />
      <div className={FILTERBAR}>
        <Select options={boatOptions} value={boatId} onChange={setBoatId} />
      </div>
      {actionError ? (
        <div className="mb-3" role="alert">
          <Note kind="danger" icon="⚠">{actionError}</Note>
        </div>
      ) : null}
      <PlatformInvoiceTable
        items={items}
        error={error}
        isLoading={isInitialLoading}
        onRetry={() => mutate()}
        emptyTitle="Nothing to approve"
        emptyDesc="Invoices appear here once a customer has fully paid and the trip has completed."
        onApprove={(inv) => act(inv, 'approve')}
        onReject={(inv) => act(inv, 'reject')}
        actionBusyIdShared={busyId}
        onOpen={(inv) => setOpenId(inv.id)}
        hasMore={hasMore}
        onLoadMore={loadMore}
      />
      <InvoiceDetailDrawer invoiceId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
