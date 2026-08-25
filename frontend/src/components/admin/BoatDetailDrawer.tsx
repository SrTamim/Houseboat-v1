'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { Drawer } from './Drawer';
import { Pill, Tag } from './Pill';
import { ErrorState, Note } from './ui';
import {
  BTN_O,
  BTN_OK,
  DSEC,
  DSEC_H4,
  KV,
  KV_DD,
  KV_DT,
  MINI,
  MINI_TD,
  MINI_TD_T1,
  MINI_TH,
  PROSE,
  TD_T2,
} from './styles';

/** Per-meal menu stored as JSON on the boat; every field is optional. */
interface FoodMenu {
  breakfast?: string | null;
  brunch?: string | null;
  lunch?: string | null;
  snacks?: string | null;
  dinner?: string | null;
}

interface BoatDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  safetyFeatures: string | null;
  /** Structured per-meal menu (all fields optional). Legacy rows may be a plain string. */
  foodMenu: FoodMenu | string | null;
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

/** Meal order for display; only meals with a value are shown. */
const MEAL_ORDER: (keyof FoodMenu)[] = [
  'breakfast',
  'brunch',
  'lunch',
  'snacks',
  'dinner',
];

/**
 * Turn the structured food menu into [label, text] lines. Tolerates a legacy
 * plain-string value (older rows) by showing it as a single "Menu" line, and
 * returns [] when there's nothing to show.
 */
function foodMenuLines(menu: FoodMenu | string | null): [string, string][] {
  if (!menu) return [];
  if (typeof menu === 'string') {
    return menu.trim() ? [['Menu', menu.trim()]] : [];
  }
  return MEAL_ORDER.flatMap((meal) => {
    const value = menu[meal];
    if (!value || !String(value).trim()) return [];
    const label = meal.charAt(0).toUpperCase() + meal.slice(1);
    return [[label, String(value).trim()] as [string, string]];
  });
}

/**
 * Render whatever fields the bank JSON has. Shown in full: this drawer is the
 * platform admin's payout-verification view, so the account number must be
 * legible (masking it would defeat the check before approving a boat).
 */
function bankLines(bank: Record<string, unknown>): [string, string][] {
  return Object.entries(bank).map(([key, value]) => {
    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
    return [label, String(value ?? '')];
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
      <button className={BTN_O} onClick={onClose}>Close</button>
      {boat && boat.status === 'pending' && onApprove ? (
        <button
          className={BTN_OK}
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
        <p className={`p-4 ${TD_T2}`}>Loading boat record…</p>
      ) : (
        <>
          <div className={DSEC}>
            <h4 className={DSEC_H4}>Status</h4>
            <div className="mb-3 flex flex-wrap gap-2">
              <Pill tone={STATUS_TONE[boat.status] ?? 'mut'}>{boat.status}</Pill>
              <Pill tone={boat.profileCompletePct === 100 ? 'ok' : 'warn'}>
                profile {boat.profileCompletePct}%
              </Pill>
              <Pill tone={boat.bankAccount ? 'ok' : 'danger'}>
                {boat.bankAccount ? 'bank on file' : 'no bank account'}
              </Pill>
            </div>
            {checklistMet ? (
              <Note kind="ok" icon="✓">
                Go-live checklist met — profile complete and a bank account is on file.
              </Note>
            ) : (
              <Note kind="warn" icon="⚠">
                Go-live checklist not met —
                {boat.profileCompletePct < 100 ? ` profile ${boat.profileCompletePct}%` : ''}
                {boat.bankAccount ? '' : ' · bank account missing'}
              </Note>
            )}
          </div>

          <div className={DSEC}>
            <h4 className={DSEC_H4}>Profile</h4>
            <dl className={KV}>
              <dt className={KV_DT}>Name</dt><dd className={KV_DD}>{boat.name}</dd>
              <dt className={KV_DT}>Public URL</dt><dd className={KV_DD}>/houseboat/{boat.slug}</dd>
              <dt className={KV_DT}>Status</dt><dd className={KV_DD}>{boat.status}</dd>
              <dt className={KV_DT}>Profile complete</dt><dd className={KV_DD}>{boat.profileCompletePct}%</dd>
              <dt className={KV_DT}>Created</dt><dd className={KV_DD}>{formatDate(boat.createdAt)}</dd>
            </dl>
            {boat.description ? (
              <p className={`mt-2.5 ${PROSE}`}><b>Description:</b> {boat.description}</p>
            ) : null}
            {boat.safetyFeatures ? (
              <p className={`mt-2 ${PROSE}`}><b>Safety:</b> {boat.safetyFeatures}</p>
            ) : null}
            {foodMenuLines(boat.foodMenu).length ? (
              <div className={`mt-2 ${PROSE}`}>
                <b>Food menu:</b>
                <ul className="mt-1 list-disc pl-5">
                  {foodMenuLines(boat.foodMenu).map(([label, text]) => (
                    <li key={label}>
                      <b>{label}:</b> {text}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className={DSEC}>
            <h4 className={DSEC_H4}>Bank</h4>
            {boat.bankAccount ? (
              <dl className={KV}>
                {bankLines(boat.bankAccount).map(([label, value]) => (
                  <FragmentRow key={label} label={label} value={value} />
                ))}
              </dl>
            ) : (
              <Note kind="danger" icon="⚠">
                No bank account on file — payouts cannot run and the boat cannot go live.
              </Note>
            )}
          </div>

          <div className={DSEC}>
            <h4 className={DSEC_H4}>Routes</h4>
            {boat.routes.length ? (
              <div className="flex flex-wrap gap-2">
                {boat.routes.map((r) => (
                  <Tag key={r.id}>
                    {r.route.name}
                    {r.route.region ? ` · ${r.route.region}` : ''}
                  </Tag>
                ))}
              </div>
            ) : (
              <p className={TD_T2}>No routes linked yet.</p>
            )}
          </div>

          <div className={DSEC}>
            <h4 className={DSEC_H4}>Decks &amp; cabins</h4>
            {boat.decks.some((d) => d.cabins.length) ? (
              <table className={MINI}>
                <thead>
                  <tr>
                    <th className={MINI_TH}>Cabin</th>
                    <th className={MINI_TH}>Deck</th>
                    <th className={MINI_TH}>Category</th>
                    <th className={MINI_TH}>AC</th>
                    <th className={MINI_TH}>Capacity</th>
                  </tr>
                </thead>
                <tbody>
                  {boat.decks.flatMap((deck) =>
                    deck.cabins.map((cabin) => {
                      const cat = categoryById.get(cabin.cabinCategoryId);
                      return (
                        <tr key={cabin.id}>
                          <td className={`${MINI_TD} ${MINI_TD_T1}`}>{cabin.name}</td>
                          <td className={MINI_TD}>{deck.name}</td>
                          <td className={MINI_TD}>{cat?.name ?? '—'}</td>
                          <td className={MINI_TD}>{cat ? (cat.isAc ? 'Yes' : 'No') : '—'}</td>
                          <td className={MINI_TD}>
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
              <p className={TD_T2}>No cabins added yet.</p>
            )}
            {boat.cabinCategories.length ? (
              <p className={`mt-2 ${PROSE}`}>
                <b>Categories:</b>{' '}
                {boat.cabinCategories
                  .map((c) => `${c.name}${c.facilities ? ` — ${c.facilities}` : ''}`)
                  .join(' · ')}
              </p>
            ) : null}
          </div>

          <div className={DSEC}>
            <h4 className={DSEC_H4}>Operating dates</h4>
            {boat.operatingDates.length ? (
              <p className={PROSE}>
                {boat.operatingDates.map((d) => formatDate(d)).join(' · ')}. Only these
                dates generate bookable departures.
              </p>
            ) : (
              <p className={TD_T2}>No operating dates set — no departures can be generated.</p>
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
      <dt className={KV_DT}>{label}</dt>
      <dd className={KV_DD}>{value}</dd>
    </>
  );
}
