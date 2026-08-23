'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { formatDate } from '@/lib/owner/format';
import { CalendarPanel, iso } from '@/components/customer/CalendarPanel';
import type { Ac } from './filters';

/**
 * Compact sticky search bar (design: haorboat-search.html lines 400–422, CSS
 * 70–84). The home hero has a taller, roomier version of these same fields; this
 * one is the condensed variant that sits under the nav on the results page, so
 * it uses its own smaller field chrome rather than reusing _home/'s pickers.
 *
 * Sticky offset is `top-[72px]` — the real CustomerNav row is h-[72px]; the
 * preview's 76px assumed a taller nav.
 */

const FIELD_BASE =
  'relative block w-full cursor-pointer rounded border bg-field px-[14px] py-[9px] text-left transition-[border-color,box-shadow] duration-dur ease-ease hover:border-[color-mix(in_srgb,var(--blue)_30%,var(--hair))]';
const FIELD_IDLE = 'border-hair';
const FIELD_ACTIVE = 'border-blue shadow-ring';
const FIELD_LABEL =
  'flex items-center gap-[5px] text-[10.5px] font-bold uppercase tracking-[.05em] text-muted';
const FIELD_VALUE = 'mt-[2px] block truncate font-display text-[15px] font-bold text-ink';
const POPOVER =
  'absolute left-0 top-full z-[200] mt-[6px] w-full min-w-[240px] rounded-xl border border-hair bg-raise-2 p-[6px] shadow-[var(--e3),var(--top-hi)] animate-ddIn';

export interface Destination {
  name: string;
  region: string | null;
}

/** Close on outside click + Escape, mirroring _home/DestinationPicker. */
function useDismiss(
  open: boolean,
  close: () => void,
  refs: React.RefObject<HTMLElement | null>[],
) {
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!refs.some((r) => r.current?.contains(t))) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

function DestinationField({
  options,
  value,
  onChange,
}: {
  options: Destination[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  useDismiss(open, () => setOpen(false), [triggerRef, menuRef]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        className={`${FIELD_BASE} ${open ? FIELD_ACTIVE : FIELD_IDLE}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={FIELD_LABEL}>📍 Destination</span>
        <span className={`${FIELD_VALUE} ${value ? '' : 'text-muted'}`}>
          {value || 'Where to?'}
        </span>
      </button>

      {open && (
        <ul
          ref={menuRef}
          id={listId}
          role="listbox"
          aria-label="Destination"
          className={`${POPOVER} m-0 max-h-[320px] list-none overflow-auto`}
        >
          {options.length === 0 && (
            <li className="px-3 py-2.5 text-[13px] font-medium text-muted">
              No destinations available.
            </li>
          )}
          {options.map((o) => {
            const selected = o.name === value;
            return (
              <li
                key={o.name}
                role="option"
                aria-selected={selected}
                className={`flex cursor-pointer items-start gap-[10px] rounded p-[10px_12px] transition-colors duration-dur ease-ease hover:bg-hover ${
                  selected ? 'bg-[color-mix(in_srgb,var(--blue)_10%,transparent)]' : ''
                }`}
                onClick={() => {
                  onChange(o.name);
                  setOpen(false);
                }}
              >
                <span className="w-4 flex-none text-[13px] font-extrabold leading-[1.5] text-blue">
                  {selected ? '✓' : ''}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span
                    className={`font-display text-[15px] font-semibold ${
                      selected ? 'text-blue' : 'text-ink'
                    }`}
                  >
                    {o.name}
                  </span>
                  {o.region && (
                    <span className="text-[12.5px] font-medium text-muted">{o.region}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Departure field. Uses the shared CalendarPanel rather than a native
 * `<input type="date">`: browsers only open the native picker from its small
 * icon (clicking the field body did nothing), and the OS-painted popup is
 * unreadable in dark mode.
 */
function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        className={`${FIELD_BASE} ${open ? FIELD_ACTIVE : FIELD_IDLE}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={FIELD_LABEL}>📅 Departure</span>
        <span className={`${FIELD_VALUE} ${value ? '' : 'text-muted'}`}>
          {value ? formatDate(value) : 'Any date'}
        </span>
      </button>

      {open && (
        <CalendarPanel
          value={value}
          onChange={onChange}
          min={iso(new Date())}
          onClose={() => setOpen(false)}
          anchorRef={triggerRef}
        />
      )}
    </div>
  );
}

function GuestsField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const n = Number(value);
  const cabins = Number.isFinite(n) && n > 0 ? Math.max(1, Math.ceil(n / 2)) : 0;

  return (
    <label className={`${FIELD_BASE} ${FIELD_IDLE} focus-within:border-blue focus-within:shadow-ring`}>
      <span className={FIELD_LABEL}>👤 Guests &amp; cabins</span>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={100}
        placeholder="Any size"
        aria-label="Guests"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-[2px] w-full border-none bg-transparent p-0 font-display text-[15px] font-bold text-ink outline-none placeholder:font-bold placeholder:text-ink [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
      />
      {cabins > 0 && (
        <span className="pointer-events-none absolute bottom-[9px] right-[14px] text-[11px] font-semibold text-muted">
          ~{cabins} {cabins === 1 ? 'cabin' : 'cabins'}
        </span>
      )}
    </label>
  );
}

/**
 * The bar itself. Values are drafts held locally; nothing is applied until
 * Search is pressed — including the AC segmented control. The bar is a search
 * form; the sidebar is the instant-filter surface. Mixing the two models is what
 * made the fields read as "not working".
 *
 * Drafts re-sync from the URL, so a sidebar filter change is reflected here.
 */
export function SearchBar({
  destinations,
  route,
  date,
  guests,
  ac,
  onSearch,
}: {
  destinations: Destination[];
  route: string;
  date: string;
  guests: string;
  ac: Ac;
  onSearch: (next: { route: string; date: string; guests: string; ac: Ac }) => void;
}) {
  const [draftRoute, setDraftRoute] = useState(route);
  const [draftDate, setDraftDate] = useState(date);
  const [draftGuests, setDraftGuests] = useState(guests);
  const [draftAc, setDraftAc] = useState<Ac>(ac);

  // Re-sync when the URL changes underneath (back/forward, pill removal, and
  // the sidebar's own instant filters).
  useEffect(() => setDraftRoute(route), [route]);
  useEffect(() => setDraftDate(date), [date]);
  useEffect(() => setDraftGuests(guests), [guests]);
  useEffect(() => setDraftAc(ac), [ac]);

  // A search needs somewhere to go — you can't search "everywhere". Clearing a
  // destination is a filter-side action (toolbar pill ×, sidebar "Any
  // location", Clear), not something the search form does.
  const canSearch = draftRoute.trim().length > 0;

  const submit = () => {
    if (!canSearch) return;
    onSearch({ route: draftRoute, date: draftDate, guests: draftGuests, ac: draftAc });
  };

  return (
    <section className="sticky top-[72px] z-50 border-b border-hair bg-raise-1 max-[560px]:static">
      {/* Deliberately not `.reveal`: the bar sits above the fold under a sticky
          nav, so a scroll-in animation buys nothing and would leave it at
          opacity:0 if the observer never fired. */}
      <div className="mx-auto max-w-wrap px-6 py-4">
        <div className="grid items-stretch gap-3 [grid-template-columns:1.4fr_1.2fr_1fr_auto_auto] max-[820px]:[grid-template-columns:1fr_1fr] max-[560px]:[grid-template-columns:1fr]">
          <DestinationField options={destinations} value={draftRoute} onChange={setDraftRoute} />
          <DateField value={draftDate} onChange={setDraftDate} />
          <GuestsField value={draftGuests} onChange={setDraftGuests} />

          <div
            role="group"
            aria-label="Cabin type"
            className="inline-flex self-center rounded-full border border-hair bg-field p-[3px] max-[820px]:col-[1/-1] max-[820px]:justify-center"
          >
            {(
              [
                ['ac', 'AC'],
                ['nonac', 'Non-AC'],
                ['both', 'Both'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                aria-pressed={draftAc === val}
                className={`rounded-full border-none px-[14px] py-[7px] text-[13px] font-bold transition-all duration-dur ease-ease ${
                  draftAc === val
                    ? 'bg-raise-1 text-blue shadow-e1 dark:bg-[color-mix(in_srgb,var(--blue)_16%,var(--raise-1))]'
                    : 'bg-transparent text-bodytext hover:text-blue'
                }`}
                onClick={() => setDraftAc(val)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="self-center max-[820px]:col-[1/-1]">
            <button
              type="button"
              onClick={submit}
              disabled={!canSearch}
              title={canSearch ? undefined : 'Choose a destination to search'}
              className="btn-sheen inline-flex items-center justify-center gap-2 whitespace-nowrap rounded border border-transparent bg-blue px-5 py-[10px] text-[14px] font-bold text-white shadow-[var(--e1),inset_0_1px_0_rgba(255,255,255,.18)] transition-[background,transform] duration-dur ease-ease hover:bg-blue-600 active:translate-y-px disabled:pointer-events-none disabled:opacity-45 max-[820px]:w-full"
            >
              🔍 Search
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
