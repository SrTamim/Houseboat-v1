'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import {
  PageHead,
  Card,
  TableWrap,
  TableSkeleton,
  EmptyState,
  ErrorState,
  Note,
} from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';
import { formatBDT } from '@/lib/admin/money';

interface Debtors {
  negativeBalances: {
    id: string;
    platformBalance: string;
    houseboat: { id: string; name: string; status: string };
  }[];
  overdueInvoices: {
    id: string;
    period: string;
    amountDue: string;
    issuedAt: string;
    houseboat: { id: string; name: string; status: string };
  }[];
}

export default function DebtorsPage() {
  const { data, error, isLoading, mutate } = useSWR<Debtors>(
    '/platform/finance/debtors',
    fetcher,
    { revalidateOnFocus: false },
  );

  return (
    <>
      <PageHead
        title="Debtors"
        desc="Boats with a negative platform_balance owe the platform, and overdue subscription invoices are unpaid monthly bills. Debt beyond the fee blocks boat access until settled."
      />
      <Card title="Negative balances" flush style={{ marginBottom: 20 }}>
        {error ? (
          <ErrorState error={error} onRetry={() => mutate()} />
        ) : !isLoading && (data?.negativeBalances.length ?? 0) === 0 ? (
          <EmptyState
            title="No boats in debt"
            desc="Boats appear here when their signed platform balance goes negative."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Boat</th>
                <th>Status</th>
                <th className="num">Balance</th>
              </tr>
            </thead>
            {isLoading ? (
              <TableSkeleton rows={3} cols={3} />
            ) : (
              <tbody>
                {(data?.negativeBalances ?? []).map((d) => (
                  <tr key={d.id}>
                    <td className="t1">{d.houseboat.name}</td>
                    <td>
                      <Pill tone={d.houseboat.status === 'suspended' ? 'danger' : 'ok'}>
                        {d.houseboat.status}
                      </Pill>
                    </td>
                    <td className="num" style={{ color: 'var(--danger)' }}>
                      <span className="u">৳</span> {formatBDT(d.platformBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </TableWrap>
        )}
      </Card>

      <Card title="Overdue subscription invoices" flush>
        {error ? null : !isLoading && (data?.overdueInvoices.length ?? 0) === 0 ? (
          <EmptyState
            title="Nothing overdue"
            desc="Unpaid monthly bills appear here once the overdue job marks them."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Boat</th>
                <th>Period</th>
                <th className="num">Amount due</th>
                <th>Issued</th>
              </tr>
            </thead>
            {isLoading ? (
              <TableSkeleton rows={3} cols={4} />
            ) : (
              <tbody>
                {(data?.overdueInvoices ?? []).map((inv) => (
                  <tr key={inv.id}>
                    <td className="t1">{inv.houseboat.name}</td>
                    <td>{inv.period}</td>
                    <td className="num">
                      <span className="u">৳</span> {formatBDT(inv.amountDue)}
                    </td>
                    <td className="t2">
                      {new Date(inv.issuedAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </TableWrap>
        )}
      </Card>
      <Note kind="danger" icon="▲" style={{ marginTop: 16 }}>
        Denying access blocks all boat operations except paying the outstanding
        bill. It is logged and reversible.
      </Note>
    </>
  );
}
