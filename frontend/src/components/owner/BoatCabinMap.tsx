'use client';

import { money } from '@/lib/owner/format';
import type { CabState } from './CabGrid';

export interface MapCabin {
  id: string;
  name: string;
  /** Category name, or the guest's name once booked. */
  caption?: string | null;
  price?: string | number | null;
  state: CabState;
}

export interface MapDeck {
  id: string;
  name: string;
  cabins: MapCabin[];
}

const STATUS_WORD: Record<CabState, string> = {
  free: 'free',
  held: 'held',
  booked: 'sold',
  spare: 'spare',
  selected: 'picked',
};

// Hull shell (was .bhull) — the --hull local var, gradient fill, thick rounded
// border shaped like a boat, inset top highlight (dark override via dark:), the
// bow triangle (::before) and the keel shadow (::after).
const HULL =
  'relative isolate rounded-[120px_120px_20px_20px/72px_72px_20px_20px] border-[2.5px] border-[var(--hull)] px-4 pb-6 pt-[42px] ' +
  '[background:linear-gradient(180deg,color-mix(in_srgb,var(--blue)_7%,var(--raise-1)),var(--raise-1)_30%)] ' +
  '[box-shadow:inset_0_2px_0_rgba(255,255,255,0.4)] dark:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.06)] ' +
  // bow triangle
  "before:absolute before:-top-[22px] before:left-1/2 before:-translate-x-1/2 before:border-x-[11px] before:border-b-[22px] before:border-x-transparent before:border-b-[var(--hull)] before:content-[''] " +
  // keel
  "after:absolute after:-bottom-[9px] after:-left-0.5 after:-right-0.5 after:-z-[1] after:h-3.5 after:rounded-b-[40%] after:opacity-60 after:[background:linear-gradient(180deg,var(--hull),transparent)] after:content-['']";

// Deck label (was .bhull-deck + ::after hairline).
const DECK =
  "mb-2 mt-4 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-blue first:mt-1 after:h-px after:flex-1 after:bg-hair after:content-['']";

// Cabin cell base (was .mcab). Border WIDTH + layout only — the border COLOUR
// and fill come from MCAB_STATE (incl. `free`), so a colored state can't be
// overridden by a base `border-hair`/`bg-field` at equal Tailwind specificity.
const MCAB_BASE =
  'relative flex min-h-[58px] w-full flex-col items-stretch justify-center gap-[3px] rounded-lg border-2 px-1.5 py-[11px] text-center font-[inherit] text-[inherit] transition-all [transition-duration:160ms]';

// Interactive (free/selected) get the hover lift + pointer.
const MCAB_HOVER = 'cursor-pointer hover:-translate-y-0.5 hover:border-blue';

// Per-state box (was .mcab.<state>). `selected` also gets the ✓ badge via a
// before pseudo (was .mcab.selected::before).
const MCAB_STATE: Record<CabState, string> = {
  free: 'border-hair bg-field',
  selected:
    "border-blue bg-[color-mix(in_srgb,var(--blue)_10%,var(--raise-1))] before:absolute before:-right-2 before:-top-2 before:grid before:h-5 before:w-5 before:place-items-center before:rounded-full before:bg-blue before:text-[11px] before:font-black before:text-white before:content-['✓']",
  booked:
    'cursor-not-allowed border-dashed border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--danger)_9%,transparent)]',
  held: 'cursor-not-allowed border-dashed border-[color-mix(in_srgb,var(--warn)_45%,transparent)] bg-[color-mix(in_srgb,var(--warn)_12%,transparent)]',
  spare:
    'border-[color-mix(in_srgb,var(--warn)_40%,transparent)] bg-[color-mix(in_srgb,var(--warn)_12%,transparent)]',
};

// Cabin name colour per state (was .mcab.<state> .mcab-n).
const MCAB_NAME: Record<CabState, string> = {
  free: 'text-ink',
  selected: 'text-blue',
  booked: 'text-danger',
  held: 'text-warn',
  spare: 'text-ink',
};

// Legend swatch (was .bhull-legend i / i.lg-*).
const LG = 'inline-block h-[13px] w-[13px] rounded-[3px] border-2';

/**
 * Boat-shaped cabin layout (§3). A hull with a pointed bow, decks laid out top
 * to bottom, and one "window" per cabin in a 2-column grid — ported from the
 * customer boats-public preview (haorboat-boat.html renderMap) into React and
 * remapped onto the owner design tokens.
 *
 * free / selected cabins are clickable; booked / held are inert. Reused by the
 * counter-sale and departure screens.
 */
export function BoatCabinMap({
  decks,
  onSelect,
}: {
  decks: MapDeck[];
  onSelect?: (cabin: MapCabin) => void;
}) {
  return (
    // .bhull-wrap only declared the --hull local var; set it here so the hull
    // border/bow/keel all resolve.
    <div className="[--hull:color-mix(in_srgb,var(--blue)_40%,var(--hair))]">
      <div className={HULL}>
        <span className="absolute left-1/2 top-2 z-[2] -translate-x-1/2 text-[11px] font-extrabold tracking-[0.05em] text-blue">
          ⚑ Bow
        </span>
        {decks.map((deck) => (
          <div key={deck.id}>
            <div className={DECK}>{deck.name}</div>
            <div className="grid grid-cols-2 gap-2.5">
              {deck.cabins.map((c) => {
                const selectable =
                  Boolean(onSelect) && (c.state === 'free' || c.state === 'selected');
                const Tag = selectable ? 'button' : 'div';
                return (
                  <Tag
                    key={c.id}
                    type={selectable ? 'button' : undefined}
                    className={`${MCAB_BASE} ${selectable ? MCAB_HOVER : ''} ${MCAB_STATE[c.state]}`}
                    onClick={selectable ? () => onSelect?.(c) : undefined}
                  >
                    <span className={`text-[11.5px] font-extrabold ${MCAB_NAME[c.state]}`}>
                      {c.name}
                    </span>
                    <span className="text-[9.5px] font-semibold text-muted">
                      {c.state === 'free'
                        ? (c.caption ?? STATUS_WORD.free)
                        : c.state === 'selected'
                          ? STATUS_WORD.selected
                          : (c.caption ?? STATUS_WORD[c.state])}
                    </span>
                    {c.price !== null && c.price !== undefined ? (
                      <span className="text-[10px] font-bold text-blue">{money(c.price)}</span>
                    ) : null}
                  </Tag>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3.5 flex flex-wrap gap-3.5 text-[11.5px] font-semibold text-muted">
        <span className="inline-flex items-center gap-1.5">
          <i className={`${LG} border-hair bg-field`} /> Free
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className={`${LG} border-blue bg-[color-mix(in_srgb,var(--blue)_10%,var(--raise-1))]`} /> Picked
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i
            className={`${LG} border-dashed border-danger bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]`}
          />{' '}
          Sold / held
        </span>
      </div>
    </div>
  );
}
