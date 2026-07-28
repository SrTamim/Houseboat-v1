'use client';

import { useState } from 'react';
import { PageHead } from '@/components/admin/ui';
import { InvoiceFilters, InvoiceTable } from '@/components/admin/InvoiceTable';
import { InvoiceDrawer } from '@/components/admin/InvoiceDrawer';
import { SAMPLE_INVOICE, type InvoiceRow } from '@/lib/admin/mock';

const rows: InvoiceRow[] = [
  { inv: 'INV-9a11', bk: 'BK-9c02', status: 'Advance Paid', boat: 'Meghduar', date: '21 Jul 2026', trip: 'Completed', method: 'Online', amount: '1,84,000', token: 'sslcz_7f…c204', primary: true },
  { inv: 'INV-88f2', bk: 'BK-88a1', status: 'Due Paid', boat: 'Jol Kolol', date: '20 Jul 2026', trip: 'Completed', method: 'Online', amount: '96,500', token: 'sslcz_2b…9a71', primary: true },
  { inv: 'INV-8410', bk: 'BK-8f3a', status: 'Due Paid', boat: 'Jol Kolol', date: '18 Jul 2026', trip: 'Completed', method: 'Online', amount: '9,162', token: 'sslcz_a0…4d12', primary: true },
  { inv: 'INV-7d55', bk: 'BK-7d10', status: 'Advance Paid', boat: 'Haor Bilash', date: '17 Jul 2026', trip: 'Completed', method: 'Cash', amount: '18,340', token: '— (cash)' },
  { inv: 'INV-7c02', bk: 'BK-7c00', status: 'Due Paid', boat: 'Haor Bilash', date: '16 Jul 2026', trip: 'Completed', method: 'Online', amount: '12,700', token: 'sslcz_11…2f30', primary: true },
  { inv: 'INV-6b44', bk: 'BK-6b40', status: 'Canceled', boat: 'Jol Kolol', date: '14 Jul 2026', trip: 'Canceled', method: 'Online', amount: '7,400', token: 'sslcz_cc…10a4' },
];

export default function VerifyPayments() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHead
        title="Payment verification"
        desc="A deliberate human check against the gateway portal — it catches gateway bugs and fraud. Cash payments are verified by the boat manager, not here."
      />
      <InvoiceFilters statusOptions={['Advance Paid', 'Due Paid', 'Over Paid']} />
      <InvoiceTable rows={rows} actionLabel="View" onAction={() => setOpen(true)} />
      <InvoiceDrawer
        inv={SAMPLE_INVOICE}
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-o" onClick={() => setOpen(false)}>Close</button>
            <button className="btn btn-danger">Flag fraud</button>
            <button className="btn btn-ok">Mark verified</button>
          </>
        }
      />
    </>
  );
}
