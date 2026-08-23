'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { PageHead, Note } from '@/components/admin/ui';
import { PlatformInvoiceTable } from '@/components/admin/PlatformInvoiceTable';
import { useAdminList } from '@/lib/admin/useAdminList';
import type { ApiInvoice } from '@/lib/admin/invoices';

export default function VerifyPayments() {
  const { items, error, isInitialLoading, hasMore, loadMore, mutate } =
    useAdminList<ApiInvoice>('/platform/finance/invoices', {
      gatewayPending: true,
      limit: 20,
    });

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function verify(invoice: ApiInvoice) {
    if (busyId) return;
    setBusyId(invoice.id);
    setActionError(null);
    try {
      await api.post(`/invoices/${invoice.id}/verify`);
      await mutate();
    } catch (e) {
      const message =
        (e as { response?: { data?: { message?: unknown } } })?.response?.data
          ?.message;
      setActionError(
        typeof message === 'string' ? message : 'Could not verify this payment.',
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHead
        title="Payment verification"
        desc="Invoices whose payment landed but has not been human-checked against the gateway portal. Verifying moves an invoice to Ready for Payout."
      />
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
        emptyTitle="Nothing to verify"
        emptyDesc="Invoices appear here when a customer payment is recorded and awaits verification."
        actionLabel="Mark verified"
        actionBusyId={busyId}
        onAction={verify}
        hasMore={hasMore}
        onLoadMore={loadMore}
      />
    </>
  );
}
