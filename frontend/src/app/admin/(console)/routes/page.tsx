'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import {
  PageHead,
  Card,
  TableWrap,
  TableSkeleton,
  EmptyState,
  ErrorState,
} from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';

interface Route {
  id: string;
  name: string;
  region: string | null;
  active: boolean;
  _count: { houseboatRoutes: number };
}

export default function Routes() {
  const { data, error, isLoading, mutate } = useSWR<Route[]>(
    '/platform/ops/routes',
    fetcher,
    { revalidateOnFocus: false },
  );

  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function createRoute(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    setFormError(null);
    try {
      await api.post('/routes', {
        name: name.trim(),
        region: region.trim() || undefined,
      });
      setName('');
      setRegion('');
      await mutate();
    } catch {
      setFormError('Could not create that route.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(route: Route) {
    // No optimistic update: the server is the authority on this state and a
    // row that snaps back is worse than a brief wait.
    try {
      await api.patch(`/platform/ops/routes/${route.id}/active`, {
        active: !route.active,
      });
      await mutate();
    } catch {
      await mutate();
    }
  }

  const routes = data ?? [];

  return (
    <>
      <PageHead
        title="Routes"
        desc="Platform-curated. Owners pick from these — they cannot create routes. Retire a route to hide it from new boats without deleting history."
      />
      <Card>
        <form className="form-grid" style={{ marginBottom: 6 }} onSubmit={createRoute}>
          <div className="field">
            <label htmlFor="route-name">Route name</label>
            <input
              id="route-name"
              placeholder="e.g. Tanguar Haor"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="route-region">Region</label>
            <input
              id="route-region"
              placeholder="e.g. Sunamganj"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              className="btn btn-b btn-block"
              style={{ width: '100%', justifyContent: 'center' }}
              type="submit"
              disabled={busy || !name.trim()}
            >
              {busy ? 'Creating…' : 'Create route'}
            </button>
          </div>
        </form>
        {formError ? (
          <div className="note danger" role="alert">
            <span className="ic">⚠</span>
            <span>{formError}</span>
          </div>
        ) : null}
      </Card>
      <Card flush style={{ marginTop: 20 }}>
        {error ? (
          <ErrorState error={error} onRetry={() => mutate()} />
        ) : !isLoading && routes.length === 0 ? (
          <EmptyState
            title="No routes yet"
            desc="Create the first platform route above — owners can't add their own."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Route</th>
                <th>Region</th>
                <th>Boats</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            {isLoading ? (
              <TableSkeleton rows={5} cols={5} />
            ) : (
              <tbody>
                {routes.map((r) => (
                  <tr key={r.id}>
                    <td className="t1">{r.name}</td>
                    <td>{r.region ?? '—'}</td>
                    <td className="t2">
                      {r._count.houseboatRoutes}{' '}
                      {r._count.houseboatRoutes === 1 ? 'boat' : 'boats'}
                    </td>
                    <td>
                      <Pill tone={r.active ? 'ok' : 'mut'}>
                        {r.active ? 'active' : 'retired'}
                      </Pill>
                    </td>
                    <td className="rowact">
                      <button
                        className="btn btn-sm btn-o"
                        onClick={() => toggleActive(r)}
                      >
                        {r.active ? 'Retire' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </TableWrap>
        )}
      </Card>
    </>
  );
}
