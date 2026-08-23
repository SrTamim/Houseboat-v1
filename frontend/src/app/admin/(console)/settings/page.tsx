'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { PageHead, Card, ErrorState, Note } from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';
import { GRID_2, KV, STACK, TD_T2 } from '@/components/admin/styles';

interface SettingsStatus {
  gateway: { provider: string | null; sandbox: boolean; storeConfigured: boolean };
  sms: { configured: boolean; senderId: string | null };
  email: { configured: boolean; from: string | null };
  storage: { configured: boolean; bucket: string | null };
  push: { configured: boolean };
  swaggerEnabled: boolean;
  env: string;
  webOrigin: string | null;
  apiPublicUrl: string | null;
}

function StatusPill({ on, onLabel = 'configured', offLabel = 'not configured' }: {
  on: boolean;
  onLabel?: string;
  offLabel?: string;
}) {
  return <Pill tone={on ? 'ok' : 'warn'}>{on ? onLabel : offLabel}</Pill>;
}

export default function Settings() {
  const { data, error, mutate } = useSWR<SettingsStatus>(
    '/platform/ops/settings',
    fetcher,
    { revalidateOnFocus: false },
  );

  return (
    <>
      <PageHead
        title="Platform settings"
        desc="Live, non-secret status of the runtime configuration. Values are env vars validated at boot — secrets never leave the backend, so editing happens in the deployment environment."
      />
      {error ? (
        <ErrorState error={error} onRetry={() => mutate()} />
      ) : !data ? (
        <Card><p className={TD_T2}>Loading configuration status…</p></Card>
      ) : (
        <div className={STACK}>
          <Card
            title="Payment gateway"
            head={<Pill tone={data.gateway.sandbox ? 'amb' : 'ok'}>{data.gateway.sandbox ? 'sandbox' : 'live'}</Pill>}
          >
            <dl className={KV}>
              <dt>Provider</dt><dd>{data.gateway.provider ?? '—'}</dd>
              <dt>Store credentials</dt>
              <dd><StatusPill on={data.gateway.storeConfigured} onLabel="set" offLabel="missing" /></dd>
            </dl>
          </Card>

          <div className={GRID_2}>
            <Card title="Notifications">
              <dl className={KV}>
                <dt>SMS provider</dt><dd><StatusPill on={data.sms.configured} /></dd>
                <dt>SMS sender ID</dt><dd>{data.sms.senderId ?? '—'}</dd>
                <dt>SMTP</dt><dd><StatusPill on={data.email.configured} /></dd>
                <dt>Email from</dt><dd>{data.email.from ?? '—'}</dd>
              </dl>
            </Card>
            <Card title="Storage & push">
              <dl className={KV}>
                <dt>Object storage (R2/S3)</dt><dd><StatusPill on={data.storage.configured} /></dd>
                <dt>Bucket</dt><dd>{data.storage.bucket ?? '—'}</dd>
                <dt>Web push (VAPID)</dt><dd><StatusPill on={data.push.configured} /></dd>
              </dl>
            </Card>
          </div>

          <Card title="Environment">
            <dl className={KV}>
              <dt>Mode</dt><dd><Pill tone={data.env === 'production' ? 'ok' : 'amb'}>{data.env}</Pill></dd>
              <dt>Web origin</dt><dd>{data.webOrigin ?? '—'}</dd>
              <dt>API public URL</dt><dd>{data.apiPublicUrl ?? '—'}</dd>
              <dt>Swagger docs</dt>
              <dd><Pill tone={data.swaggerEnabled ? 'amb' : 'mut'}>{data.swaggerEnabled ? 'enabled' : 'disabled'}</Pill></dd>
            </dl>
          </Card>

          <Note kind="info" icon="ℹ">
            To change any of these, update the backend environment
            (backend/.env locally; deployment variables in production) and
            restart. Production refuses to boot with missing or default secrets
            — see backend/src/config/validate-env.ts.
          </Note>
        </div>
      )}
    </>
  );
}
