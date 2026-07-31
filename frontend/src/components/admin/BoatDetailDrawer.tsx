'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { Drawer } from './Drawer';
import { Pill } from './Pill';
import { ErrorState } from './ui';

interface BoatDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  safetyFeatures: string | null;
  foodMenu: string | null;
  bankAccount: Record<string, unknown> | null;
  profileCompletePct: number;
  status: string;
  operatingDates: string[];
  createdAt: string;
  decks: {
    id: string;
    name: string;
    position: number;
    cabins: {
      id: string;
      name: string;
      cabinCategoryId: string;
      gridRow: number | null;
      gridCol: number | null;
    }[];
  }[];
  cabinCategories: {
    id: string;
    name: string;
    isAc: boolean;
    baseCapacity: number;
    extendedCapacity: number | null;
    facilities: string | null;
  }[];
  routes: {
    id: string;
    route: { id: string; name: string; region: string | null; active: boolean };
  }[];
}

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'danger' | 'mut'> = {
  live: 'ok',
  pending: 'warn',
  suspended: 'danger',
  draft: 'mut',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Render whatever fields the bank JSON has, masking anything number-like. */
function bankLines(bank: Record<string, unknown>): [string, string][] {
  return Object.entries(bank).map(([key, value]) => {
    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
    const raw = String(value ?? '');
    const masked = /(number|account|iban)/i.test(key) && raw.length > 4
      ? `••${raw.slice(-4)}`
      : raw;
    return [label, masked];
  });
}

export function BoatDetailDrawer({
  boatId,
  onClose,
  onApprove,
  approving,
}: {
  /** null = closed. */
  boatId: string | null;
  onClose: () => void;
  /** Present only when the caller allows approving from the drawer. */
  onApprove?: (boatId: string) => void;
  approving?: boolean;
}) {
  const { data: boat, error, isLoading } = useSWR<BoatDetail>(
    boatId ? `/houseboats/${boatId}/manage` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const checklistMet =
    boat != null && boat.profileCompletePct === 100 && boat.bankAccount != null;

  const footer = (
    <>
      <button className="btn btn-o" onClick={onClose}>Close</button>
      {boat && boat.status === 'pending' && onApprove ? (
        <button
          className="btn btn-ok"
          disabled={!checklistMet || approving}
          title={checklistMet ? undefined : 'Profile must be 100% with a bank account on file'}
          onClick={() => onApprove(boat.id)}
        >
          {approving ? 'Approving…' : 'Approve → live'}
        </button>
      ) : null}
    </>
  );

  const categoryById = new Map(
    (boat?.cabinCategories ?? []).map((c) => [c.id, c]),
  );

  return (
    <Drawer
      open={boatId !== null}
      onClose={onClose}
      wide
      title={boat ? `${boat.name} · boat record` : 'Boat record'}
      footer={footer}
    >
      {error ? (
        <ErrorState error={error} />
      ) : isLoading || !boat ? (
        <p className="t2" style={{ padding: 16 }}>Loading boat record…</p>
      ) : (
        <>
          <div className="dsec">
            <h4>Status</h4>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <Pill tone={STATUS_TONE[boat.status] ?? 'mut'}>{boat.status}</Pill>
              <Pill tone={boat.profileCompletePct === 100 ? 'ok' : 'warn'}>
                profile {boat.profileCompletePct}%
              </Pill>
              <Pill tone={boat.bankAccount ? 'ok' : 'danger'}>
                {boat.bankAccount ? 'bank on file' : 'no bank account'}
              </Pill>
            </div>
            {checklistMet ? (
              <div className="note ok">
                <span className="ic">✓</span>
                <span>Go-live checklist met — profile complete and a bank account is on file.</span>
              </div>
            ) : (
              <div className="note warn">
                <span className="ic">⚠</span>
                <span>
                  Go-live checklist not met —
                  {boat.profileCompletePct < 100 ? ` profile ${boat.profileCompletePct}%` : ''}
                  {boat.bankAccount ? '' : ' · bank account missing'}
                </span>
              </div>
            )}
          </div>

          <div className="dsec">
            <h4>Profile</h4>
            <dl className="kv">
              <dt>Name</dt><dd>{boat.name}</dd>
              <dt>Public URL</dt><dd>/houseboat/{boat.slug}</dd>
              <dt>Status</dt><dd>{boat.status}</dd>
              <dt>Profile complete</dt><dd>{boat.profileCompletePct}%</dd>
              <dt>Created</dt><dd>{formatDate(boat.createdAt)}</dd>
            </dl>
            {boat.description ? (
              <p className="prose" style={{ marginTop: 10 }}><b>Description:</b> {boat.description}</p>
            ) : null}
            {boat.safetyFeatures ? (
              <p className="prose" style={{ marginTop: 8 }}><b>Safety:</b> {boat.safetyFeatures}</p>
            ) : null}
            {boat.foodMenu ? (
              <p className="prose" style={{ marginTop: 8 }}><b>Food menu:</b> {boat.foodMenu}</p>
            ) : null}
          </div>

          <div className="dsec">
            <h4>Bank</h4>
            {boat.bankAccount ? (
              <dl className="kv">
                {bankLines(boat.bankAccount).map(([label, value]) => (
                  <FragmentRow key={label} label={label} value={value} />
                ))}
              </dl>
            ) : (
              <div className="note danger">
                <span className="ic">⚠</span>
                <span>No bank account on file — payouts cannot run and the boat cannot go live.</span>
              </div>
            )}
          </div>

          <div className="dsec">
            <h4>Routes</h4>
            {boat.routes.length ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {boat.routes.map((r) => (
                  <span key={r.id} className="tag">
                    {r.route.name}
                    {r.route.region ? ` · ${r.route.region}` : ''}
                  </span>
                ))}
              </div>
            ) : (
              <p className="t2">No routes linked yet.</p>
            )}
          </div>

          <div className="dsec">
            <h4>Decks &amp; cabins</h4>
            {boat.decks.some((d) => d.cabins.length) ? (
              <table className="mini">
                <thead>
                  <tr><th>Cabin</th><th>Deck</th><th>Category</th><th>AC</th><th>Capacity</th></tr>
                </thead>
                <tbody>
                  {boat.decks.flatMap((deck) =>
                    deck.cabins.map((cabin) => {
                      const cat = categoryById.get(cabin.cabinCategoryId);
                      return (
                        <tr key={cabin.id}>
                          <td className="t1">{cabin.name}</td>
                          <td>{deck.name}</td>
                          <td>{cat?.name ?? '—'}</td>
                          <td>{cat ? (cat.isAc ? 'Yes' : 'No') : '—'}</td>
                          <td>
                            {cat
                              ? `${cat.baseCapacity}${cat.extendedCapacity ? ` (ext ${cat.extendedCapacity})` : ''}`
                              : '—'}
                          </td>
                        </tr>
                      );
                    }),
                  )}
                </tbody>
              </table>
            ) : (
              <p className="t2">No cabins added yet.</p>
            )}
            {boat.cabinCategories.length ? (
              <p className="prose" style={{ marginTop: 8 }}>
                <b>Categories:</b>{' '}
                {boat.cabinCategories
                  .map((c) => `${c.name}${c.facilities ? ` — ${c.facilities}` : ''}`)
                  .join(' · ')}
              </p>
            ) : null}
          </div>

          <div className="dsec">
            <h4>Operating dates</h4>
            {boat.operatingDates.length ? (
              <p className="prose">
                {boat.operatingDates.map((d) => formatDate(d)).join(' · ')}. Only these
                dates generate bookable departures.
              </p>
            ) : (
              <p className="t2">No operating dates set — no departures can be generated.</p>
            )}
          </div>
        </>
      )}
    </Drawer>
  );
}

function FragmentRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}
