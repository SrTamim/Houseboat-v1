'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { Drawer } from './Drawer';
import { ErrorState } from './ui';
import { formatBDT } from '@/lib/admin/money';
import { shortId } from '@/lib/admin/invoices';
import { BTN_B, BTN_O, DSEC, DSEC_H4, KV, KV_DD, KV_DT, MINI, MINI_TD, MINI_TD_T1, MINI_TH, TD_T2, UNIT } from './styles';

interface Receipt {
  id: string;
  totalAmount: string;
  paidAt: string | null;
  status: string;
  bankSnapshot: Record<string, unknown> | null;
  houseboat: { id: string; name: string; slug: string };
  paidByAccount: { id: string; name: string | null } | null;
  invoices: {
    id: string;
    displayTotal: string;
    amountPaid: string;
    dueToBoat: string;
    commission: string;
    customer: { id: string; name: string | null; phone: string };
    booking: { id: string; departure: { startDate: string } };
  }[];
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Render the bank snapshot as labelled lines (full, for the payment record). */
function bankLines(bank: Record<string, unknown>): [string, string][] {
  return Object.entries(bank)
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(([key, value]) => {
      const label = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (c) => c.toUpperCase());
      return [label, String(value)];
    });
}

export function PayoutReceiptDrawer({
  receiptId,
  onClose,
}: {
  receiptId: string | null;
  onClose: () => void;
}) {
  const { data: r, error, isLoading } = useSWR<Receipt>(
    receiptId ? `/platform/finance/payout-receipts/${receiptId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  return (
    <Drawer
      open={receiptId !== null}
      onClose={onClose}
      wide
      title={r ? `Payout receipt · ${shortId(r.id, 'PR')}` : 'Payout receipt'}
      footer={
        <>
          <button className={BTN_O} onClick={onClose}>Close</button>
          {r ? (
            <button className={BTN_B} onClick={() => window.print()}>
              Print / download
            </button>
          ) : null}
        </>
      }
    >
      {error ? (
        <ErrorState error={error} />
      ) : isLoading || !r ? (
        <p className={`p-4 ${TD_T2}`}>Loading receipt…</p>
      ) : (
        // The printable sheet: everything else on the page is hidden by the
        // `.admin-scope .admin-print-root` @media print rule in globals.css.
        <div className="admin-print-root">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[20px] font-bold">Payout receipt</h2>
              <p className={TD_T2}>Houseboat platform — vendor payment record</p>
            </div>
            <div className="text-right">
              <div className="font-semibold">{shortId(r.id, 'PR')}</div>
              <div className={TD_T2}>{formatDate(r.paidAt)}</div>
            </div>
          </div>

          <div className={DSEC}>
            <h4 className={DSEC_H4}>Vendor</h4>
            <dl className={KV}>
              <dt className={KV_DT}>Boat</dt>
              <dd className={KV_DD}>{r.houseboat.name}</dd>
              {r.bankSnapshot
                ? bankLines(r.bankSnapshot).map(([label, value]) => (
                    <FragmentRow key={label} label={label} value={value} />
                  ))
                : null}
            </dl>
          </div>

          <div className={DSEC}>
            <h4 className={DSEC_H4}>Invoices paid</h4>
            <table className={MINI}>
              <thead>
                <tr>
                  <th className={MINI_TH}>Invoice</th>
                  <th className={MINI_TH}>Customer</th>
                  <th className={MINI_TH}>Trip</th>
                  <th className={MINI_TH}>Paid to boat</th>
                </tr>
              </thead>
              <tbody>
                {r.invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className={`${MINI_TD} ${MINI_TD_T1}`}>{shortId(inv.id, 'INV')}</td>
                    <td className={MINI_TD}>{inv.customer.name ?? inv.customer.phone}</td>
                    <td className={MINI_TD}>{formatDate(inv.booking.departure.startDate)}</td>
                    <td className={MINI_TD}>
                      <span className={UNIT}>৳</span> {formatBDT(inv.dueToBoat)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={DSEC}>
            <h4 className={DSEC_H4}>Total</h4>
            <dl className={KV}>
              <dt className={KV_DT}>Invoices</dt>
              <dd className={KV_DD}>{r.invoices.length}</dd>
              <dt className={KV_DT}>Total paid to vendor</dt>
              <dd className={KV_DD}>
                <span className={UNIT}>৳</span> {formatBDT(r.totalAmount)}
              </dd>
              <dt className={KV_DT}>Paid by</dt>
              <dd className={KV_DD}>{r.paidByAccount?.name ?? '—'}</dd>
              <dt className={KV_DT}>Paid on</dt>
              <dd className={KV_DD}>{formatDate(r.paidAt)}</dd>
            </dl>
          </div>
        </div>
      )}
    </Drawer>
  );
}

function FragmentRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className={KV_DT}>{label}</dt>
      <dd className={KV_DD}>{value}</dd>
    </>
  );
}
