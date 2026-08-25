'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
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
import { Drawer } from '@/components/admin/Drawer';
import { apiErrorMessage } from '@/lib/admin/api-error';
import {
  BTN_B,
  BTN_O,
  BTN_SM,
  DSEC,
  FIELD,
  FIELD_INPUT,
  FIELD_LABEL,
  FORM_GRID,
  ROWACT,
  TD_T1,
  TD_T2,
} from '@/components/admin/styles';

interface Route {
  id: string;
  name: string;
  region: string | null;
  active: boolean;
  _count: { houseboatRoutes: number };
}

function RouteEditDrawer({
  route,
  onClose,
  onSaved,
}: {
  route: Route | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the inputs each time a different route is opened.
  useEffect(() => {
    setName(route?.name ?? '');
    setRegion(route?.region ?? '');
    setError(null);
  }, [route]);

  async function save() {
    if (!route || busy || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/platform/ops/routes/${route.id}`, {
        name: name.trim(),
        // Empty clears the region (null); the DTO allows null.
        region: region.trim() || null,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save this route.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      open={route !== null}
      onClose={onClose}
      title={route ? `Edit ${route.name}` : 'Edit route'}
      footer={
        <>
          <button className={BTN_O} onClick={onClose}>Cancel</button>
          <button className={BTN_B} disabled={busy || !name.trim()} onClick={save}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <div className={DSEC}>
        <div className={FIELD}>
          <label htmlFor="edit-route-name" className={FIELD_LABEL}>Route name</label>
          <input
            id="edit-route-name"
            className={FIELD_INPUT}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className={`${FIELD} mt-3`}>
          <label htmlFor="edit-route-region" className={FIELD_LABEL}>Region</label>
          <input
            id="edit-route-region"
            className={FIELD_INPUT}
            placeholder="Leave blank to clear"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          />
        </div>
        {error ? (
          <div className="mt-3" role="alert"><Note kind="danger" icon="⚠">{error}</Note></div>
        ) : null}
      </div>
    </Drawer>
  );
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
  const [editing, setEditing] = useState<Route | null>(null);

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
        <form className={FORM_GRID} style={{ marginBottom: 6 }} onSubmit={createRoute}>
          <div className={FIELD}>
            <label htmlFor="route-name" className={FIELD_LABEL}>Route name</label>
            <input
              id="route-name"
              className={FIELD_INPUT}
              placeholder="e.g. Tanguar Haor"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className={FIELD}>
            <label htmlFor="route-region" className={FIELD_LABEL}>Region</label>
            <input
              id="route-region"
              className={FIELD_INPUT}
              placeholder="e.g. Sunamganj"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              className={`${BTN_B} w-full justify-center`}
              type="submit"
              disabled={busy || !name.trim()}
            >
              {busy ? 'Creating…' : 'Create route'}
            </button>
          </div>
        </form>
        {formError ? (
          <div role="alert"><Note kind="danger" icon="⚠">{formError}</Note></div>
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
                  <tr key={r.id} className="group">
                    <td className={TD_T1}>{r.name}</td>
                    <td>{r.region ?? '—'}</td>
                    <td className={TD_T2}>
                      {r._count.houseboatRoutes}{' '}
                      {r._count.houseboatRoutes === 1 ? 'boat' : 'boats'}
                    </td>
                    <td>
                      <Pill tone={r.active ? 'ok' : 'mut'}>
                        {r.active ? 'active' : 'retired'}
                      </Pill>
                    </td>
                    <td>
                      <div className={ROWACT}>
                        <button
                          className={`${BTN_O} ${BTN_SM}`}
                          onClick={() => setEditing(r)}
                        >
                          Edit
                        </button>
                        <button
                          className={`${BTN_O} ${BTN_SM}`}
                          onClick={() => toggleActive(r)}
                        >
                          {r.active ? 'Retire' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </TableWrap>
        )}
      </Card>
      <RouteEditDrawer
        route={editing}
        onClose={() => setEditing(null)}
        onSaved={() => mutate()}
      />
    </>
  );
}
