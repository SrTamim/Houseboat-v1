'use client';

import { useState } from 'react';
import { PageHead, Note } from '@/components/admin/ui';
import { InvoiceFilters, InvoiceTable } from '@/components/admin/InvoiceTable';
import { InvoiceDrawer } from '@/components/admin/InvoiceDrawer';
import { makeInvoice, type InvoiceRow } from '@/lib/admin/mock';

const rows: InvoiceRow[] = [
  { inv: 'INV-8410', bk: 'BK-8f3a', status: 'Ready for Payout', boat: 'Jol Kolol', date: '18 Jul 2026', trip: 'Completed', method: 'Online', amount: '8,482', token: 'sslcz_a0…4d12', primary: true },
  { inv: 'INV-88f2', bk: 'BK-88a1', status: 'Ready for Payout', boat: 'Jol Kolol', date: '20 Jul 2026', trip: 'Completed', method: 'Online', amount: '89,300', token: 'sslcz_2b…9a71', primary: true },
  { inv: 'INV-7c02', bk: 'BK-7c00', status: 'Ready for Payout', boat: 'Haor Bilash', date: '16 Jul 2026', trip: 'Completed', method: 'Online', amount: '11,750', token: 'sslcz_11…2f30', primary: true },
  { inv: 'INV-9a11', bk: 'BK-9c02', status: 'Payout Verified', boat: 'Meghduar', date: '21 Jul 2026', trip: 'Completed', method: 'Online', amount: '1,74,800', token: 'sslcz_7f…c204' },
  { inv: 'INV-6f20', bk: 'BK-6f20', status: 'Paid to Boat', boat: 'Haor Bilash', date: '10 Jul 2026', trip: 'Completed', method: 'Online', amount: '16,900', token: 'sslcz_dd…5510' },
];

const invoice = makeInvoice({
  status: 'Ready for Payout',
  lock: true,
  meta: { batch: 'PB-0192 · prepared by Nusrat J.' },
});

export default function Payouts() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHead
        title="Payouts"
        desc={<>Invoices with <b>Ready for Payout</b>. Verify each, then batch per boat — the preparer must not be the approver, and a boat with no bank account cannot be paid.</>}
        actions={
          <>
            <button className="btn btn-o">Batch view</button>
            <button className="btn btn-b">+ Prepare batch</button>
          </>
        }
      />
      <InvoiceFilters statusOptions={['Ready for Payout', 'Payout Verified', 'Paid to Boat']} />
      <InvoiceTable rows={rows} actionLabel="Verify" onAction={() => setOpen(true)} />
      <Note kind="warn" icon="⚑" style={{ marginTop: 16 }}>
        <b>Meghduar</b> has no bank account on file — its verified invoices cannot enter a payout batch until one is added. <b>Bhela</b>&apos;s batch total is negative (owes the platform); settle it in <a href="/admin/debtors" style={{ color: 'inherit', textDecoration: 'underline' }}>Debtors</a>.
      </Note>
      <InvoiceDrawer
        inv={invoice}
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-o" onClick={() => setOpen(false)}>Close</button>
            <button className="btn btn-danger">Pull from batch</button>
            <button className="btn btn-ok">Verify payout</button>
          </>
        }
      />
    </>
  );
}
