'use client';

import {
  PageHead,
  Card,
  TableWrap,
  TableSkeleton,
  EmptyState,
  ErrorState,
} from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';
import { useAdminList } from '@/lib/admin/useAdminList';
import { formatBDT } from '@/lib/admin/money';
import { shortId } from '@/lib/admin/invoices';

interface RescheduleRow {
  id: string;
  oldPrice: string | null;
  newPrice: string | null;
  reason: string | null;
  changedAt: string;
  booking: {
    id: string;
    customer: { id: string; name: string | null };
  };
  prevDeparture: {
    startDate: string;
    package: { houseboat: { name: string } };
  };
  toDeparture: { startDate: string };
  changedByAccount: { id: string; name: string | null };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });
}

function priceChange(oldP: string | null, newP: string | null) {
  if (oldP === null || newP === null)
    return { label: '—', tone: 'mut' as const };
  const diff = Number(newP) - Number(oldP);
  if (!Number.isFinite(diff) || diff === 0)
    return { label: 'no change', tone: 'mut' as const };
  return diff > 0
    ? { label: 'repriced up', tone: 'warn' as const }
    : { label: 'repriced down', tone: 'ok' as const };
}

export default function Reschedules() {
  const { items, error, isInitialLoading, hasMore, loadMore, mutate } =
    useAdminList<RescheduleRow>('/platform/ops/reschedules', { limit: 25 });

  return (
    <>
      <PageHead
        title="Reschedule oversight"
        desc="Rescheduling reprices at the new date; the advance carries over as credit and the previous trip stays on record. Moving to an Eid date costs Eid prices."
      />
      <Card flush>
        {error ? (
          <ErrorState error={error} onRetry={() => mutate()} />
        ) : !isInitialLoading && items.length === 0 ? (
          <EmptyState
            title="No reschedules yet"
            desc="Every booking date change is recorded here with its old and new price."
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Boat</th>
                  <th>From → to</th>
                  <th className="num">Old price</th>
                  <th className="num">New price</th>
                  <th>Change</th>
                  <th>By</th>
                </tr>
              </thead>
              {isInitialLoading ? (
                <TableSkeleton rows={4} cols={7} />
              ) : (
                <tbody>
                  {items.map((r) => {
                    const change = priceChange(r.oldPrice, r.newPrice);
                    return (
                      <tr key={r.id}>
                        <td>
                          <div className="t1">{shortId(r.booking.id, 'BK')}</div>
                          <div className="t2">
                            {r.booking.customer.name ?? '—'}
                          </div>
                        </td>
                        <td>{r.prevDeparture.package.houseboat.name}</td>
                        <td className="t2">
                          {formatDate(r.prevDeparture.startDate)} →{' '}
                          {formatDate(r.toDeparture.startDate)}
                        </td>
                        <td className="num">
                          {r.oldPrice !== null ? (
                            <><span className="u">৳</span> {formatBDT(r.oldPrice)}</>
                          ) : '—'}
                        </td>
                        <td className="num">
                          {r.newPrice !== null ? (
                            <><span className="u">৳</span> {formatBDT(r.newPrice)}</>
                          ) : '—'}
                        </td>
                        <td><Pill tone={change.tone}>{change.label}</Pill></td>
                        <td className="t2">{r.changedByAccount.name ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              )}
            </TableWrap>
            {hasMore ? (
              <div style={{ padding: 12, textAlign: 'center' }}>
                <button className="btn btn-o btn-sm" onClick={loadMore}>
                  Load more
                </button>
              </div>
            ) : null}
          </>
        )}
      </Card>
    </>
  );
}
