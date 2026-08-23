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

// Per-state border / background (was `.cab.<state>`).
const STATE_BOX: Record<CabState, string> = {
  free: 'cursor-pointer border-[color-mix(in_srgb,var(--ok)_45%,var(--hair))] hover:border-ok hover:bg-[color-mix(in_srgb,var(--ok)_7%,var(--raise-1))]',
  held: 'border-[color-mix(in_srgb,var(--warn)_45%,var(--hair))] bg-[color-mix(in_srgb,var(--warn)_9%,var(--raise-1))]',
  booked: 'border-hair bg-field opacity-80',
  selected: 'border-blue bg-[color-mix(in_srgb,var(--blue)_10%,var(--raise-1))] shadow-ring',
  spare: 'border-[color-mix(in_srgb,var(--blue)_45%,var(--hair))] bg-[color-mix(in_srgb,var(--blue)_8%,var(--raise-1))]',
};
// Corner status-word colour (was `.cab.<state> .st`).
const STATE_ST: Record<CabState, string> = {
  free: 'text-ok',
  held: 'text-warn',
  booked: 'text-muted',
  selected: 'text-blue',
  spare: 'text-blue',
};
const CAB_ACT =
  'inline-flex h-6 w-6 items-center justify-center rounded-md border border-hair bg-raise-1 text-[12px] leading-none text-muted shadow-e1 transition-[border-color,color] duration-dur ease-ease';

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
  onEdit,
  onDelete,
}: {
  cabins: CabTile[];
  onSelect?: (cabin: CabTile) => void;
  /** Owner-only inline edit; when set, an edit control appears on each tile. */
  onEdit?: (cabin: CabTile) => void;
  /** Owner-only inline delete; when set, a delete control appears on each tile. */
  onDelete?: (cabin: CabTile) => void;
}) {
  const manage = Boolean(onEdit || onDelete);
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
      {cabins.map((c) => {
        const selectable =
          Boolean(onSelect) && (c.state === 'free' || c.state === 'selected');
        const Tag = selectable ? 'button' : 'div';
        return (
          <Tag
            key={c.id}
            type={selectable ? 'button' : undefined}
            className={`group relative rounded-xl border border-hair bg-raise-1 p-3 text-left shadow-e1 transition-[border-color,transform,box-shadow] duration-dur ease-ease hover:-translate-y-0.5 hover:shadow-e2 ${STATE_BOX[c.state]}`}
            onClick={selectable ? () => onSelect?.(c) : undefined}
          >
            <span
              className={`absolute right-2.5 top-2.5 text-[9.5px] font-bold uppercase tracking-[0.04em] ${STATE_ST[c.state]}`}
            >
              {c.statusLabel ?? DEFAULT_LABEL[c.state]}
            </span>
            <div className="font-display text-[15px] font-semibold text-ink">{c.name}</div>
            {c.caption ? (
              <div className="mt-0.5 text-[11px] font-semibold text-muted">{c.caption}</div>
            ) : null}
            {c.price !== null && c.price !== undefined ? (
              <div className="mt-2 font-display text-[13px] font-semibold tabular-nums text-ink">
                {money(c.price)}
              </div>
            ) : null}
            {manage ? (
              <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 transition-opacity duration-dur ease-ease group-hover:opacity-100 group-focus-within:opacity-100">
                {onEdit ? (
                  <button
                    type="button"
                    className={`${CAB_ACT} hover:border-blue hover:text-blue`}
                    title="Edit cabin"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(c);
                    }}
                  >
                    ✎
                  </button>
                ) : null}
                {onDelete ? (
                  <button
                    type="button"
                    className={`${CAB_ACT} hover:border-danger hover:text-danger`}
                    title="Delete cabin"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(c);
                    }}
                  >
                    🗑
                  </button>
                ) : null}
              </div>
            ) : null}
          </Tag>
        );
      })}
    </div>
  );
}
