'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import {
  PageHead,
  Card,
  Note,
  TableWrap,
  AsyncTable,
} from '@/components/owner/ui';
import { Pill } from '@/components/owner/Pill';
import { money, formatDate, timeLeft, humanize } from '@/lib/owner/format';

interface OwnerRefund {
  id: string;
  amount: string;
  reason: string | null;
  status: string;
  claimDeadline: string | null;
  completedAt: string | null;
  requestedBy: string | null;
  verifiedBy: string | null;
  completedBy: string | null;
  invoiceId: string;
  customer: { name: string | null; phone: string };
  paid: string;
  bookingStatus: string;
  departureDate: string;
}

const STATUS_TONES: Record<string, 'amb' | 'blue' | 'ok'> = {
  requested: 'amb',
  verified: 'blue',
  completed: 'ok',
};

function invoiceRef(id: string): string {
  return `#${id.slice(-6).toUpperCase()}`;
}

export default function OwnerRefundsPage() {
  const { boatId } = useActiveBoat();
  const { data, error, isLoading, mutate } = useSWR<OwnerRefund[]>(
    `/houseboats/${boatId}/refunds`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const rows = data ?? [];
  const open = rows.filter((r) => r.status !== 'completed');

  return (
    <>
      <PageHead
        title="Refunds & reschedules"
        desc={
          <>
            A refund only opens when <b>you cancelled the trip</b>, and only within the
            6-day claim window. Customer cancellations follow your policy template
            instead, and the platform always keeps its commission.
          </>
        }
      />

      <Card title="Refund claims" sub="owner-cancelled trips" flush style={{ marginBottom: 20 }}>
        <TableWrap minWidth={820}>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Guest</th>
              <th className="num">Paid</th>
              <th className="num">Refund</th>
              <th>Deadline</th>
              <th>Status</th>
            </tr>
          </thead>
          <AsyncTable
            isLoading={isLoading}
            error={error}
            isEmpty={rows.length === 0}
            onRetry={() => mutate()}
            empty={
              <div className="state">
                <div className="ic">↩</div>
                <h4>No refunds</h4>
                <p>
                  Nothing has been cancelled from your side. Refunds only appear here when
                  you cancel a departure.
                </p>
              </div>
            }
          >
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="t1">{invoiceRef(r.invoiceId)}</td>
                  <td>
                    <div className="t1">{r.customer.name ?? 'Guest'}</div>
                    <div className="t2">{formatDate(r.departureDate)}</div>
                  </td>
                  <td className="num">{money(r.paid)}</td>
                  <td className="num">{money(r.amount)}</td>
                  <td>
                    {r.claimDeadline ? (
                      <Pill tone={timeLeft(r.claimDeadline) === 'expired' ? 'mut' : 'warn'}>
                        {timeLeft(r.claimDeadline)}
                      </Pill>
                    ) : (
                      <span className="t2">—</span>
                    )}
                  </td>
                  <td>
                    <Pill tone={STATUS_TONES[r.status] ?? 'mut'}>{humanize(r.status)}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </AsyncTable>
        </TableWrap>
      </Card>

      <div className="grid-2">
        <Card title="Refund flow · 3-person separation">
          <div className="stack" style={{ gap: 10 }}>
            <Note kind="info">
              <b>requested_by → verified_by → completed_by</b> must be three different
              people. Finance collects the bank details and makes the transfer — the
              database rejects a completion by whoever verified it.
            </Note>

            {open.length === 0 ? (
              <Note kind="ok">Nothing is mid-flow right now.</Note>
            ) : (
              <TableWrap minWidth={0}>
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Requested</th>
                    <th>Verified</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {open.map((r) => (
                    <tr key={r.id}>
                      <td className="t1">{invoiceRef(r.invoiceId)}</td>
                      <td className="t2">{r.requestedBy ?? '—'}</td>
                      <td className="t2">{r.verifiedBy ?? 'pending'}</td>
                      <td className="t2">{r.completedBy ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </div>
        </Card>

        <Card title="How a reschedule prices">
          <div className="bill">
            <div className="row">
              <span className="lbl">
                Original booking
                <span className="s">priced on its own date</span>
              </span>
              <span className="val">as paid</span>
            </div>
            <div className="row">
              <span className="lbl">
                New date
                <span className="s">repriced at that date&apos;s profile</span>
              </span>
              <span className="val">new price</span>
            </div>
            <div className="row sub">
              <span className="lbl">Advance carried as credit</span>
              <span className="val">amount paid</span>
            </div>
            <div className="row total">
              <span className="lbl">New due</span>
              <span className="val">difference</span>
            </div>
          </div>
          <Note kind="warn" style={{ marginTop: 12 }}>
            A reschedule reprices at the new date — the advance becomes credit, not a
            locked-in price. Moving a trip into a weekend or Eid profile costs the guest
            more.
          </Note>
        </Card>
      </div>
    </>
  );
}
