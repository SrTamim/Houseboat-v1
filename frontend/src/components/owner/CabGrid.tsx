'use client';

import { money } from '@/lib/owner/format';

export type CabState = 'free' | 'held' | 'booked' | 'spare' | 'selected';

export interface CabTile {
  id: string;
  name: string;
  /** Category name, or the guest's name once booked. */
  caption?: string | null;
  price?: string | number | null;
  state: CabState;
  /** Short status word in the corner. Defaults to the state. */
  statusLabel?: string;
}

const DEFAULT_LABEL: Record<CabState, string> = {
  free: 'free',
  held: 'held',
  booked: 'sold',
  spare: 'spare',
  selected: 'picked',
};

/**
 * Cabin tiles for the counter-sale and departure screens.
 *
 * Booked and held cabins are rendered as non-interactive: a held cabin belongs
 * to someone else's in-flight checkout, and clicking it would only produce a
 * "just taken" error from the hold endpoint.
 */
export function CabGrid({
  cabins,
  onSelect,
}: {
  cabins: CabTile[];
  onSelect?: (cabin: CabTile) => void;
}) {
  return (
    <div className="cabgrid">
      {cabins.map((c) => {
        const selectable =
          Boolean(onSelect) && (c.state === 'free' || c.state === 'selected');
        const Tag = selectable ? 'button' : 'div';
        return (
          <Tag
            key={c.id}
            type={selectable ? 'button' : undefined}
            className={`cab ${c.state}`}
            onClick={selectable ? () => onSelect?.(c) : undefined}
          >
            <span className="st">{c.statusLabel ?? DEFAULT_LABEL[c.state]}</span>
            <div className="cn">{c.name}</div>
            {c.caption ? <div className="cc">{c.caption}</div> : null}
            {c.price !== null && c.price !== undefined ? (
              <div className="cp">{money(c.price)}</div>
            ) : null}
          </Tag>
        );
      })}
    </div>
  );
}
