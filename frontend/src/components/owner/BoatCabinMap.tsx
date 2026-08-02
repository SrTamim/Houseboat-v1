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
    <div className="bhull-wrap">
      <div className="bhull">
        <span className="bhull-flag">⚑ Bow</span>
        {decks.map((deck) => (
          <div key={deck.id}>
            <div className="bhull-deck">{deck.name}</div>
            <div className="bhull-row">
              {deck.cabins.map((c) => {
                const selectable =
                  Boolean(onSelect) && (c.state === 'free' || c.state === 'selected');
                const Tag = selectable ? 'button' : 'div';
                return (
                  <Tag
                    key={c.id}
                    type={selectable ? 'button' : undefined}
                    className={`mcab ${c.state}`}
                    onClick={selectable ? () => onSelect?.(c) : undefined}
                  >
                    <span className="mcab-n">{c.name}</span>
                    <span className="mcab-s">
                      {c.state === 'free'
                        ? (c.caption ?? STATUS_WORD.free)
                        : c.state === 'selected'
                          ? STATUS_WORD.selected
                          : (c.caption ?? STATUS_WORD[c.state])}
                    </span>
                    {c.price !== null && c.price !== undefined ? (
                      <span className="mcab-p">{money(c.price)}</span>
                    ) : null}
                  </Tag>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="bhull-legend">
        <span>
          <i className="lg-free" /> Free
        </span>
        <span>
          <i className="lg-sel" /> Picked
        </span>
        <span>
          <i className="lg-full" /> Sold / held
        </span>
      </div>
    </div>
  );
}
