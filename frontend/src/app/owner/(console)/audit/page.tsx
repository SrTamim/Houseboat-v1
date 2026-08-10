'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import {
  PageHead,
  Card,
  FilterBar,
  Search,
  Select,
  Field,
  Note,
  TableWrap,
  AsyncTable,
} from '@/components/owner/ui';
import { Pill } from '@/components/owner/Pill';
import { formatDateTime, humanize } from '@/lib/owner/format';

interface AuditRow {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  deviceTime: string | null;
  serverTime: string;
  syncedOffline: boolean;
  actor: { id: string; name: string | null; phone: string } | null;
}

interface AuditPage {
  items: AuditRow[];
  nextCursor: string | null;
}

/**
 * Every action a boat-scoped audit row can carry. Static so the filter offers
 * the full vocabulary regardless of what this boat has recorded so far.
 * Platform-only actions (platform_*, billing_config_upsert, houseboat_approve /
 * _status_change / _create) never land on a boat and are omitted.
 */
const OWNER_AUDIT_ACTIONS: string[] = [
  'account_login',
  'account_login_failed',
  'account_logout',
  'account_register',
  'account_token_refresh',
  'booking_create',
  'group_booking_create',
  'booking_reschedule',
  'booking_cancel',
  'booking_checkin',
  'open_seat_join',
  'waitlist_notified',
  'pos_sale',
  'departure_cancel',
  'schedule_save',
  'pricing_profile_create',
  'quote_request',
  'quote_price',
  'quote_accept',
  'mark_paid',
  'gateway_payment',
  'payment_verify',
  'payout_prepare',
  'payout_approve',
  'payout_paid',
  'refund_request',
  'refund_verify',
  'refund_complete',
  'refund_settle_pos',
  'owner_distribution',
  'subscription_issue',
  'subscription_pay',
  'coupon_create',
  'coupon_set_active',
  'member_add',
  'member_exit',
  'member_update',
  'role_change',
  'staff_delete',
  'payroll_run',
  'payroll_paid',
  'payroll_adjust',
  'cost_add',
  'cost_edit',
  'low_stock',
  'houseboat_update',
  'deck_update',
  'deck_delete',
  'category_update',
  'category_delete',
  'cabin_update',
  'cabin_delete',
  'media_add_image',
  'media_add_video',
  'media_remove',
  'maintenance_request_created',
  'maintenance_request_updated',
  'maintenance_request_commented',
  'notification_resend',
  'sync_conflict',
];

/** datetime-local value ("2026-08-08T14:30") → ISO 8601 for the API. */
function toIso(local: string): string {
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

export default function OwnerAuditPage() {
  const { boatId } = useActiveBoat();
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [accumulated, setAccumulated] = useState<AuditRow[]>([]);

  // Any filter change invalidates the cursor minted under the old filters.
  const resetPaging = () => {
    setCursor(null);
    setAccumulated([]);
  };

  const fromIso = from ? toIso(from) : '';
  const toIsoVal = to ? toIso(to) : '';

  const key =
    `/houseboats/${boatId}/audit?limit=50` +
    (action ? `&action=${encodeURIComponent(action)}` : '') +
    (search ? `&search=${encodeURIComponent(search)}` : '') +
    (fromIso ? `&from=${encodeURIComponent(fromIso)}` : '') +
    (toIsoVal ? `&to=${encodeURIComponent(toIsoVal)}` : '') +
    (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');

  const { data, error, isLoading, mutate } = useSWR<AuditPage>(key, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const rows = cursor ? [...accumulated, ...(data?.items ?? [])] : (data?.items ?? []);

  return (
    <>
      <PageHead
        title="Audit log"
        desc="Every change to bookings, money and settings, with who made it and from where. The trail is append-only — nothing here can be edited or deleted, including by us."
      />

      <FilterBar>
        <Search
          placeholder="Search actor or action…"
          value={search}
          onChange={(v) => {
            setSearch(v);
            resetPaging();
          }}
        />
        <Select
          ariaLabel="Filter by action"
          options={[
            { value: '', label: 'All actions' },
            ...OWNER_AUDIT_ACTIONS.map((a) => ({ value: a, label: humanize(a) })),
          ]}
          value={action}
          onChange={(v) => {
            setAction(v);
            resetPaging();
          }}
        />
        <Field label="From">
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              resetPaging();
            }}
          />
        </Field>
        <Field label="To">
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              resetPaging();
            }}
          />
        </Field>
        {(search || action || from || to) && (
          <button
            className="btn btn-o btn-sm"
            onClick={() => {
              setSearch('');
              setAction('');
              setFrom('');
              setTo('');
              resetPaging();
            }}
          >
            Clear
          </button>
        )}
      </FilterBar>

      <Card flush>
        <TableWrap minWidth={720}>
          <thead>
            <tr>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Server time</th>
              <th>Source</th>
            </tr>
          </thead>
          <AsyncTable
            isLoading={isLoading && !cursor}
            error={error}
            isEmpty={rows.length === 0}
            onRetry={() => mutate()}
            empty={
              <div className="state">
                <div className="ic">📜</div>
                <h4>Nothing recorded</h4>
                <p>Actions appear here as you and your team work.</p>
              </div>
            }
          >
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.serverTime}-${r.id}`}>
                  <td className="t1">{r.actor?.name ?? r.actor?.phone ?? 'system'}</td>
                  <td>
                    <Pill tone="mut">{humanize(r.action)}</Pill>
                  </td>
                  <td className="t2">{r.entityType ? humanize(r.entityType) : '—'}</td>
                  <td className="t2">{formatDateTime(r.serverTime)}</td>
                  <td>
                    <Pill tone={r.syncedOffline ? 'amb' : 'blue'}>
                      {r.syncedOffline ? 'offline replay' : 'online'}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </AsyncTable>

          {data?.nextCursor ? (
            <tfoot>
              <tr>
                <td colSpan={5} style={{ textAlign: 'center' }}>
                  <button
                    className="btn btn-o btn-sm"
                    disabled={isLoading}
                    onClick={() => {
                      setAccumulated(rows);
                      setCursor(data.nextCursor);
                    }}
                  >
                    {isLoading ? 'Loading…' : 'Load more'}
                  </button>
                </td>
              </tr>
            </tfoot>
          ) : null}
        </TableWrap>
      </Card>

      <Note kind="warn" style={{ marginTop: 16 }}>
        Server time is the authoritative timestamp — it is stamped here, not on the device,
        and it is what a dispute cites. An action taken offline keeps its device clock until
        it syncs, and then shows as an offline replay above.
      </Note>
    </>
  );
}
