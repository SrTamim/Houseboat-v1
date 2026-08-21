import { money } from '@/lib/owner/format';

export interface BillRow {
  label: React.ReactNode;
  /** Small grey line under the label — used to show the rule behind a figure. */
  hint?: React.ReactNode;
  value: string | number;
  /** Muted styling for intermediate subtotals. */
  sub?: boolean;
  /** Red, with a leading minus — deductions. */
  negative?: boolean;
  /** Emphasised final line. */
  total?: boolean;
}

/**
 * The invoice waterfall.
 *
 * Order is fixed by the billing rules (plan §1) and every drawer that shows a
 * bill renders it the same way (gateway fee removed platform-wide):
 *   room total → − coupon → customer pays
 *   paid so far → − commission → you receive
 * Amounts arrive as Decimal strings and are never arithmetic'd here.
 */
export function Bill({ rows }: { rows: BillRow[] }) {
  return (
    <div className="text-[13.5px]">
      {rows.map((r, i) => (
        <div
          key={i}
          className={`flex justify-between border-b border-dashed border-hair py-2 last:border-b-0 ${
            r.total
              ? 'mt-1 border-b-0 border-t-2 border-t-hair pt-3'
              : r.sub
                ? 'text-muted'
                : ''
          }`}
        >
          <span className={`font-medium ${r.total ? 'text-[15px] font-semibold text-ink' : 'text-bodytext'}`}>
            {r.label}
            {r.hint ? (
              <span className="block text-[11px] font-medium text-muted">{r.hint}</span>
            ) : null}
          </span>
          <span
            className={`whitespace-nowrap font-display font-semibold tabular-nums ${
              r.total
                ? 'text-[16px] text-blue'
                : r.negative
                  ? 'text-danger'
                  : r.sub
                    ? 'text-muted'
                    : 'text-ink'
            }`}
          >
            {r.negative ? '−' : ''}
            {money(r.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** The standard customer-side breakdown for one invoice. */
export function InvoiceBill({
  invoice,
}: {
  invoice: {
    roomTotal: string;
    discountAmount: string;
    displayTotal: string;
    commission: string;
    dueToBoat: string;
    amountPaid: string;
  };
}) {
  return (
    <>
      <Bill
        rows={[
          { label: 'Room total', hint: 'Your price', value: invoice.roomTotal },
          ...(Number(invoice.discountAmount) > 0
            ? [{ label: 'Coupon', value: invoice.discountAmount, negative: true }]
            : []),
          { label: 'Customer pays', value: invoice.displayTotal, total: true },
        ]}
      />
      <div style={{ height: 18 }} />
      <Bill
        rows={[
          { label: 'Paid so far', value: invoice.amountPaid, sub: true },
          {
            label: 'Commission',
            hint: 'Platform share of the room total',
            value: invoice.commission,
            negative: true,
          },
          { label: 'You receive', value: invoice.dueToBoat, total: true },
        ]}
      />
    </>
  );
}
