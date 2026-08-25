'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useActiveBoat } from '@/lib/owner/boat-context';
import { PageHead, Card, Note, Kv, AsyncBlock } from '@/components/owner/ui';
import { BTN_O, MONEY, MONEY_NEG } from '@/components/owner/styles';
import { Pill } from '@/components/owner/Pill';
import { money, formatDate, apiErrorMessage, humanize } from '@/lib/owner/format';

interface MySettings {
  membershipId: string;
  houseboatId: string;
  notificationPrefs: Record<string, boolean>;
  isExited: boolean;
}

interface BillingStatus {
  locked: boolean;
  platformBalance: string;
  trialEnds: string | null;
}

interface BoatDetail {
  name: string;
  slug: string;
  status: string;
  profileCompletePct: number;
}

/** The events an owner can silence. Adding one here needs no migration. */
const EVENTS: { key: string; label: string; hint: string }[] = [
  { key: 'booking', label: 'New bookings', hint: 'Someone books a cabin on your boat' },
  { key: 'payment_due', label: 'Payments', hint: 'Payments recorded and gateway payments received' },
  { key: 'refund_sent', label: 'Refunds', hint: 'A refund moves through its steps' },
  { key: 'low_stock', label: 'Low stock', hint: 'A consumable drops below its reorder level' },
  { key: 'waitlist_open', label: 'Waitlist', hint: 'A place frees on a full departure' },
];

/** Toggle switch matching the design system's 42×24 pill. */
function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      style={{
        width: 42,
        height: 24,
        borderRadius: 999,
        border: '1px solid var(--hair)',
        background: on ? 'var(--blue)' : 'var(--field)',
        position: 'relative',
        transition: 'background var(--dur) var(--ease)',
        flex: 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left var(--dur) var(--ease)',
          boxShadow: '0 1px 2px rgba(0,0,0,.25)',
        }}
      />
    </button>
  );
}

export default function OwnerSettingsPage() {
  const { boatId, boat } = useActiveBoat();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const settings = useSWR<MySettings>(`/houseboats/${boatId}/my-settings`, fetcher, {
    revalidateOnFocus: false,
  });
  const billing = useSWR<BillingStatus>(`/houseboats/${boatId}/billing-status`, fetcher, {
    revalidateOnFocus: false,
  });
  const boatDetail = useSWR<BoatDetail>(`/houseboats/${boatId}/manage`, fetcher, {
    revalidateOnFocus: false,
  });

  useEffect(() => {
    if (settings.data) setPrefs(settings.data.notificationPrefs ?? {});
  }, [settings.data]);

  async function save(next: Record<string, boolean>) {
    setPrefs(next);
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api.patch(`/houseboats/${boatId}/my-settings`, { notificationPrefs: next });
      setSaved(true);
      await settings.mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save your preferences.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="Settings"
        desc="Your own preferences for this boat, plus the platform terms you are on. Billing terms are set by the platform and shown here read-only."
      />

      {saved ? (
        <Note kind="ok" style={{ marginBottom: 18 }}>
          Preferences saved.
        </Note>
      ) : null}
      {error ? (
        <Note kind="danger" style={{ marginBottom: 18 }}>
          {error}
        </Note>
      ) : null}

      <div className="grid grid-cols-[2fr_1fr] items-start gap-5 max-[1024px]:grid-cols-1">
        <div className="flex flex-col gap-5">
          <Card title="Notification preferences" sub="yours, on this boat">
            <AsyncBlock
              isLoading={settings.isLoading}
              error={settings.error}
              onRetry={() => settings.mutate()}
            >
              <div className="flex flex-col gap-5" style={{ gap: 4 }}>
                {EVENTS.map((ev) => (
                  <div
                    key={ev.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '11px 0',
                      borderBottom: '1px solid var(--hair-2)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{ev.label}</div>
                      <div className="t2">{ev.hint}</div>
                    </div>
                    <Toggle
                      label={ev.label}
                      // Default on: an owner who has never touched this should
                      // still hear about a booking.
                      on={prefs[ev.key] !== false}
                      onChange={(v) => save({ ...prefs, [ev.key]: v })}
                    />
                  </div>
                ))}
              </div>
              {busy ? <div className="t2" style={{ marginTop: 10 }}>Saving…</div> : null}
            </AsyncBlock>
          </Card>

          <Card title="Boat display">
            <Kv
              rows={[
                ['Boat', boatDetail.data?.name ?? boat.name],
                ['Public URL', `/houseboat/${boatDetail.data?.slug ?? ''}`],
                ['Your role', boat.role],
                ['Timezone', 'UTC+6 (BST)'],
                ['Currency', '৳ BDT'],
              ]}
            />
            <Note kind="info" style={{ marginTop: 12 }}>
              Times are stored in UTC and shown in your local zone. The audit trail keeps
              both, so a dispute can always be resolved against server time.
            </Note>
            <Link className={BTN_O} href="/owner/profile" style={{ marginTop: 12 }}>
              Edit boat profile
            </Link>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card title="Billing config" sub="set by the platform">
            <AsyncBlock
              isLoading={billing.isLoading}
              error={billing.error}
              onRetry={() => billing.mutate()}
            >
              <Kv
                rows={[
                  [
                    'Platform balance',
                    <span
                      className={`${MONEY}${Number(billing.data?.platformBalance ?? 0) < 0 ? ` ${MONEY_NEG}` : ''}`}
                      key="b"
                    >
                      {money(billing.data?.platformBalance)}
                    </span>,
                  ],
                  [
                    'Trial ends',
                    billing.data?.trialEnds ? formatDate(billing.data.trialEnds) : '—',
                  ],
                  [
                    'Access',
                    <Pill tone={billing.data?.locked ? 'danger' : 'ok'} key="l">
                      {billing.data?.locked ? 'locked' : 'active'}
                    </Pill>,
                  ],
                ]}
              />
              <Note kind="info" style={{ marginTop: 12 }}>
                🔒 Commission and monthly fee are platform terms — contact the
                platform to change them.
              </Note>
            </AsyncBlock>
          </Card>

          <Card title="Boat status">
            <Kv
              rows={[
                [
                  'Status',
                  <Pill
                    tone={boatDetail.data?.status === 'live' ? 'ok' : 'warn'}
                    key="s"
                  >
                    {humanize(boatDetail.data?.status ?? boat.status)}
                  </Pill>,
                ],
                ['Profile', `${boatDetail.data?.profileCompletePct ?? 0}%`],
              ]}
            />
            <Note kind="warn" style={{ marginTop: 12 }}>
              To pause bookings or take the boat off the platform, contact the platform —
              suspension is not something you can trigger yourself, because live bookings
              have to be honoured or refunded first.
            </Note>
            <Link className={BTN_O} href="/owner/team" style={{ marginTop: 12 }}>
              Manage access
            </Link>
          </Card>
        </div>
      </div>
    </>
  );
}
