'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { PageHead, Note } from '@/components/admin/ui';
import { PlatformInvoiceTable } from '@/components/admin/PlatformInvoiceTable';
import { InvoiceDetailDrawer } from '@/components/admin/InvoiceDetailDrawer';
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
  const [openId, setOpenId] = useState<string | null>(null);

  async function verify(invoice: ApiInvoice) {
    if (busyId) return;
    // A refund_requested invoice needs its REFUND verified, not a payment:
    // refund_requested → refund_verified via the refund id carried on the row.
    const isRefund =
      invoice.status === 'refund_requested' && !!invoice.refundId;
    setBusyId(invoice.id);
    setActionError(null);
    try {
      if (isRefund) {
        await api.post(`/refunds/${invoice.refundId}/verify`);
      } else {
        await api.post(`/invoices/${invoice.id}/verify`);
      }
      await mutate();
    } catch (e) {
      const message =
        (e as { response?: { data?: { message?: unknown } } })?.response?.data
          ?.message;
      setActionError(
        typeof message === 'string'
          ? message
          : isRefund
            ? 'Could not verify this refund.'
            : 'Could not verify this payment.',
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHead
        title="Payment verification"
        desc="Gateway payments awaiting a human check against the portal, plus customer refund requests awaiting approval. Verifying a payment moves it to Ready for Payout; verifying a refund sends it to the Refunds page to pay out."
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
        actionLabel={(inv) =>
          inv.status === 'refund_requested' ? 'Verify refund' : 'Mark verified'
        }
        actionBusyId={busyId}
        onAction={verify}
        onOpen={(inv) => setOpenId(inv.id)}
        hasMore={hasMore}
        onLoadMore={loadMore}
      />
      <InvoiceDetailDrawer invoiceId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
