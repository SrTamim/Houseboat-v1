'use client';

import { useEffect, useId } from 'react';
import {
  AMENITIES,
  RATING_OPTIONS,
  SIZE_BUCKETS,
  type Ac,
  type SearchFilters,
  type SizeKey,
} from './filters';

/**
 * Filters rail (design: haorboat-search.html lines 446–494, CSS 99–120).
 * Desktop: a sticky 270px card. ≤1040px: a right-side drawer over a scrim,
 * opened from the toolbar's ⚙️ Filters button.
 *
 * Checkbox/radio chrome is rebuilt with `peer` utilities — a real focusable
 * input plus a styled box — so the controls stay keyboard-operable and
 * screen-reader-visible, which the preview's `input{display:none}` was not.
 */

const GROUP = 'border-b border-hair py-[18px] last:border-b-0';
const GROUP_TITLE =
  'mb-[14px] font-display text-[13px] uppercase tracking-[.06em] text-ink';
const OPT_ROW =
  'flex cursor-pointer items-center gap-[10px] py-[6px] text-sm font-semibold text-bodytext';
const BOX_BASE =
  'grid h-[19px] w-[19px] flex-none place-items-center border-[1.5px] border-muted text-xs text-white transition-all duration-dur ease-ease peer-checked:border-blue peer-checked:bg-blue peer-focus-visible:shadow-ring';
const COUNT = 'ml-auto text-[12.5px] font-semibold text-muted';

/**
 * Two independent checkboxes → the tri-state `ac` value. Neither ticked means
 * "no cabin-type filter", same as both ticked — an empty result set would be a
 * dead end the user has to undo.
 */
function acFrom(ac: boolean, nonAc: boolean): Ac {
  if (ac && !nonAc) return 'ac';
  if (nonAc && !ac) return 'nonac';
  return 'both';
}

function Checkbox({
  label,
  checked,
  count,
  disabled,
  onChange,
}: {
  label: React.ReactNode;
  checked: boolean;
  count?: number;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className={`${OPT_ROW} ${disabled ? 'cursor-not-allowed opacity-45' : ''}`}>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={`${BOX_BASE} rounded-[5px] after:content-[''] peer-checked:after:content-['✓']`} />
      <span>{label}</span>
      {count != null && <span className={COUNT}>{count}</span>}
    </label>
  );
}

function Radio({
  name,
  label,
  checked,
  count,
  onChange,
}: {
  name: string;
  label: React.ReactNode;
  checked: boolean;
  count?: number;
  onChange: () => void;
}) {
  return (
    <label className={OPT_ROW}>
      <input
        type="radio"
        name={name}
        className="peer sr-only"
        checked={checked}
        onChange={onChange}
      />
      <span
        className={`${BOX_BASE} rounded-full peer-checked:after:h-2 peer-checked:after:w-2 peer-checked:after:rounded-full peer-checked:after:bg-white peer-checked:after:content-['']`}
      />
      <span className="min-w-0 truncate">{label}</span>
      {count != null && <span className={COUNT}>{count}</span>}
    </label>
  );
}

export function FilterSidebar({
  filters,
  destinations,
  sizeCounts,
  amenityCounts,
  priceMin,
  priceMax,
  priceDraft,
  open,
  onClose,
  onPatch,
  onPriceDraft,
  onPriceCommit,
}: {
  filters: SearchFilters;
  destinations: { name: string; region: string | null; count: number }[];
  sizeCounts: Record<SizeKey, number>;
  amenityCounts: Record<string, number>;
  priceMin: number;
  priceMax: number;
  priceDraft: number;
  open: boolean;
  onClose: () => void;
  onPatch: (patch: Partial<SearchFilters>) => void;
  onPriceDraft: (v: number) => void;
  onPriceCommit: (v: number) => void;
}) {
  const routeName = useId();
  const rateName = useId();

  // Cabin type is rendered as two checkboxes but stored as the tri-state `ac`
  // value the URL and backend already use.
  const wantsAc = filters.ac === 'ac' || filters.ac === 'both';
  const wantsNonAc = filters.ac === 'nonac' || filters.ac === 'both';

  // Drawer: Escape closes, and the page behind must not scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const toggleSize = (key: SizeKey, on: boolean) =>
    onPatch({
      sizes: on ? [...filters.sizes, key] : filters.sizes.filter((s) => s !== key),
    });

  const toggleAmenity = (key: string, on: boolean) =>
    onPatch({
      amenities: on ? [...filters.amenities, key] : filters.amenities.filter((a) => a !== key),
    });

  const priceUsable = priceMax > priceMin;

  return (
    <>
      {/* scrim — drawer only */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-[80] bg-black/40 transition-opacity duration-[250ms] min-[1041px]:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        aria-label="Filters"
        className={`sticky top-[173px] self-start rounded-2xl border border-hair bg-raise-1 px-5 pb-5 pt-[6px] shadow-e1 dark:border-[color-mix(in_srgb,var(--blue)_12%,var(--hair))] dark:bg-[linear-gradient(160deg,color-mix(in_srgb,var(--blue)_8%,var(--raise-1)),var(--raise-1)_62%)] max-[1040px]:fixed max-[1040px]:inset-y-0 max-[1040px]:right-0 max-[1040px]:left-auto max-[1040px]:z-[90] max-[1040px]:w-[min(340px,86vw)] max-[1040px]:overflow-y-auto max-[1040px]:rounded-none max-[1040px]:shadow-e3 max-[1040px]:transition-transform max-[1040px]:duration-[250ms] ${
          open ? 'max-[1040px]:translate-x-0' : 'max-[1040px]:translate-x-full'
        }`}
      >
        <div className="hidden items-center justify-between pt-4 max-[1040px]:flex">
          <span className="font-display text-[15px] font-semibold text-ink">Filters</span>
          <button
            type="button"
            aria-label="Close filters"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-sm border border-hair bg-field text-base leading-none text-bodytext hover:border-[color-mix(in_srgb,var(--blue)_40%,var(--hair))] hover:text-blue"
          >
            ✕
          </button>
        </div>

        {/* Departure location — single-select (radio). */}
        <div className={GROUP}>
          <h4 className={GROUP_TITLE}>Departure location</h4>
          <Radio
            name={routeName}
            label="Any location"
            checked={!filters.route}
            onChange={() => onPatch({ route: undefined })}
          />
          {destinations.map((d) => (
            <Radio
              key={d.name}
              name={routeName}
              label={d.region ? `${d.name}, ${d.region}` : d.name}
              count={d.count}
              checked={filters.route === d.name}
              onChange={() => onPatch({ route: d.name })}
            />
          ))}
        </div>

        {/* Cabin type — multi-select (checkbox), mapped onto the tri-state `ac`
            value so the URL and backend contract stay unchanged. Unticking both
            falls back to no filter rather than showing zero results. */}
        <div className={GROUP}>
          <h4 className={GROUP_TITLE}>Cabin type</h4>
          <Checkbox
            label="AC"
            checked={filters.ac === 'ac' || filters.ac === 'both'}
            onChange={(on) => onPatch({ ac: acFrom(on, wantsNonAc) })}
          />
          <Checkbox
            label="Non-AC"
            checked={filters.ac === 'nonac' || filters.ac === 'both'}
            onChange={(on) => onPatch({ ac: acFrom(wantsAc, on) })}
          />
        </div>

        {/* Price */}
        <div className={GROUP}>
          <h4 className={GROUP_TITLE}>Price / person / cabin</h4>
          {priceUsable ? (
            <div className="mt-[6px]">
              <input
                type="range"
                aria-label="Maximum price per person"
                min={priceMin}
                max={priceMax}
                step={100}
                value={priceDraft}
                onChange={(e) => onPriceDraft(Number(e.target.value))}
                onPointerUp={(e) => onPriceCommit(Number((e.target as HTMLInputElement).value))}
                onKeyUp={(e) => onPriceCommit(Number((e.target as HTMLInputElement).value))}
                className="w-full accent-blue"
              />
              <div className="mt-2 flex justify-between text-[13px] font-bold tabular-nums text-ink">
                <span>৳{priceMin.toLocaleString('en-US')}</span>
                <span>৳{priceDraft.toLocaleString('en-US')}</span>
              </div>
            </div>
          ) : (
            <p className="m-0 text-[13px] font-medium text-muted">Pricing not published yet.</p>
          )}
        </div>

        {/* Boat size */}
        <div className={GROUP}>
          <h4 className={GROUP_TITLE}>Boat size</h4>
          {SIZE_BUCKETS.map((b) => (
            <Checkbox
              key={b.key}
              label={b.label}
              count={sizeCounts[b.key]}
              checked={filters.sizes.includes(b.key)}
              onChange={(on) => toggleSize(b.key, on)}
            />
          ))}
        </div>

        {/* Rating */}
        <div className={GROUP}>
          <h4 className={GROUP_TITLE}>Rating</h4>
          {RATING_OPTIONS.map((r) => (
            <Radio
              key={r.value}
              name={rateName}
              label={
                <span className="flex items-center gap-1">
                  <i className="not-italic text-amber">★</i> {r.label}
                </span>
              }
              checked={filters.rating === r.value}
              onChange={() => onPatch({ rating: r.value })}
            />
          ))}
          <Radio
            name={rateName}
            label="Any rating"
            checked={filters.rating == null}
            onChange={() => onPatch({ rating: undefined })}
          />
        </div>

        {/* Amenities */}
        <div className={GROUP}>
          <h4 className={GROUP_TITLE}>Amenities</h4>
          {AMENITIES.map((a) => {
            const count = amenityCounts[a.key] ?? 0;
            return (
              <Checkbox
                key={a.key}
                label={a.label}
                count={count}
                disabled={count === 0}
                checked={filters.amenities.includes(a.key)}
                onChange={(on) => toggleAmenity(a.key, on)}
              />
            );
          })}
        </div>
      </aside>
    </>
  );
}
