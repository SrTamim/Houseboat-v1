'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { Drawer } from './Drawer';
import { ErrorState } from './ui';
import { formatBDT } from '@/lib/admin/money';
import { shortId } from '@/lib/admin/invoices';
import { PLATFORM } from '@/lib/customer/platform';
import {
  BTN_B,
  BTN_O,
  PINV_BAND_META,
  PINV_CONTACT,
  PINV_FOOT,
  PINV_GRAND,
  PINV_HEAD,
  PINV_ID,
  PINV_ID_CAPTION,
  PINV_ITEMS,
  PINV_LOGO,
  PINV_META,
  PINV_NAME,
  PINV_NAME_ACCENT,
  PINV_NO,
  PINV_PARTIES,
  PINV_PLAT,
  PINV_ROW,
  PINV_STATUS,
  PINV_STATUS_TONE,
  PINV_TAG,
  PINV_TOTALS,
  TD_T2,
  UNIT,
} from './styles';

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
        // The printable sheet. The drawer `<aside>` carries `admin-print-root`,
        // so the @media print rule in globals.css reveals only this branch.
        // The white card makes the fixed-hex text readable on the dark drawer;
        // print drops the card. `[print-color-adjust:exact]` keeps blue on paper.
        <div className="rounded-lg bg-white p-6 text-[#111] [print-color-adjust:exact] print:rounded-none print:bg-transparent print:p-0">
          <div className={PINV_HEAD}>
            <div className={PINV_ID}>
              <span className={PINV_LOGO}>{PLATFORM.mark}</span>
              <div>
                <div className={PINV_NAME}>
                  Haor<span className={PINV_NAME_ACCENT}>Boat</span>
                </div>
                <div className={PINV_CONTACT}>
                  {PLATFORM.address}
                  <br />
                  {PLATFORM.email} · {PLATFORM.site}
                </div>
              </div>
            </div>
            <div className={PINV_BAND_META}>
              <div className={PINV_TAG}>Vendor payout receipt</div>
              <div className={PINV_NO}>{shortId(r.id, 'PR')}</div>
              <div>Issued {formatDate(r.paidAt)}</div>
            </div>
          </div>

          <div className={PINV_PARTIES}>
            <div>
              <h5>From</h5>
              <strong>{PLATFORM.legalName}</strong>
              <div>Paid by {r.paidByAccount?.name ?? '—'}</div>
              {r.paidByAccount ? (
                <div className={PINV_ID_CAPTION}>{shortId(r.paidByAccount.id, 'ACC')}</div>
              ) : null}
            </div>
            <div className={PINV_META}>
              <span
                className={`${PINV_STATUS} ${
                  r.status === 'paid' ? PINV_STATUS_TONE.paid : PINV_STATUS_TONE.pending
                }`}
              >
                {r.status === 'paid' ? 'Paid' : humanizeStatus(r.status)}
              </span>
              <h5>To vendor</h5>
              <strong>{r.houseboat.name}</strong>
              <div className={PINV_ID_CAPTION}>{shortId(r.houseboat.id, 'BOAT')}</div>
              {r.bankSnapshot
                ? bankLines(r.bankSnapshot).map(([label, value]) => (
                    <div key={label}>
                      {label}: {value}
                    </div>
                  ))
                : null}
              <div>Paid on {formatDate(r.paidAt)}</div>
            </div>
          </div>

          <table className={PINV_ITEMS}>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Trip</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {r.invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{shortId(inv.id, 'INV')}</td>
                  <td>{inv.customer.name ?? inv.customer.phone}</td>
                  <td>{formatDate(inv.booking.departure.startDate)}</td>
                  <td className="num">
                    <span className={UNIT}>৳</span> {formatBDT(inv.dueToBoat)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={PINV_TOTALS}>
            <div className={PINV_ROW}>
              <span>Invoices</span>
              <span>{r.invoices.length}</span>
            </div>
            <div className={`${PINV_ROW} ${PINV_GRAND}`}>
              <span>Total paid to vendor</span>
              <span>
                <span className={UNIT}>৳</span> {formatBDT(r.totalAmount)}
              </span>
            </div>
          </div>

          <div className={PINV_FOOT}>
            <span>
              {PLATFORM.legalName} · {PLATFORM.address}
              <br />
              {PLATFORM.email} · {PLATFORM.site}
            </span>
            <span className={PINV_PLAT}>
              {PLATFORM.mark} {PLATFORM.name}
            </span>
          </div>
        </div>
      )}
    </Drawer>
  );
}

/** Title-case a batch status like `pending` → `Pending`. */
function humanizeStatus(status: string) {
  return status.replace(/[_-]/g, ' ').replace(/^./, (c) => c.toUpperCase());
}
