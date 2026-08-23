'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Local YYYY-MM-DD (avoids UTC off-by-one from toISOString). */
export function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Token-styled calendar popover, shared by the home hero's DatePicker and the
 * search bar's compact departure field. Extracted from _home/DatePicker.tsx —
 * the markup here is that component's panel verbatim, so the home page renders
 * identically to before the extraction.
 *
 * Callers own their own trigger (the two differ in size and layout) and render
 * this panel when open. `anchorRef` is the trigger, so an outside-click on it
 * doesn't immediately reopen the panel.
 */
export function CalendarPanel({
  value,
  onChange,
  min,
  onClose,
  anchorRef,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = value ? new Date(`${value}T00:00:00`) : null;
  const minDate = min ? new Date(`${min}T00:00:00`) : null;

  // Month currently shown in the grid (defaults to the selected month / today).
  const [view, setView] = useState(() => {
    const base = selected ?? new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !anchorRef?.current?.contains(t)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, anchorRef]);

  // 6-week grid of Date cells for the viewed month.
  const cells = useMemo(() => {
    const first = new Date(view.year, view.month, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay()); // back up to the Sunday
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [view]);

  const today = new Date();
  const isSameDay = (a: Date, b: Date | null) =>
    !!b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const step = (dir: number) =>
    setView((v) => {
      const m = v.month + dir;
      return { year: v.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });

  return (
    <div
      ref={panelRef}
      className="absolute left-0 top-full z-[200] mt-[6px] w-[296px] rounded-xl border border-hair bg-raise-2 p-3 shadow-[var(--e3),var(--top-hi)] animate-ddIn"
      role="dialog"
      aria-label="Choose departure date"
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          className="grid h-8 w-8 place-items-center rounded-sm border border-hair bg-field text-[18px] leading-none text-bodytext transition-all duration-dur ease-ease hover:border-[color-mix(in_srgb,var(--blue)_40%,var(--hair))] hover:text-blue"
          aria-label="Previous month"
          onClick={() => step(-1)}
        >
          ‹
        </button>
        <span className="font-display text-[15px] font-bold tracking-[-.02em] text-ink">
          {MONTHS[view.month]} {view.year}
        </span>
        <button
          type="button"
          className="grid h-8 w-8 place-items-center rounded-sm border border-hair bg-field text-[18px] leading-none text-bodytext transition-all duration-dur ease-ease hover:border-[color-mix(in_srgb,var(--blue)_40%,var(--hair))] hover:text-blue"
          aria-label="Next month"
          onClick={() => step(1)}
        >
          ›
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-[2px]">
        {WEEKDAYS.map((w) => (
          <span
            key={w}
            className="py-1 text-center text-[11px] font-bold uppercase tracking-[.04em] text-muted"
          >
            {w}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-[2px]">
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === view.month;
          const disabled = minDate ? d < minDate : false;
          const isSel = isSameDay(d, selected);
          const isToday = isSameDay(d, today);
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              className={[
                'h-[38px] rounded-sm border-none bg-transparent text-[13.5px] font-semibold tabular-nums text-ink transition-[background,color] duration-dur ease-ease',
                'enabled:hover:bg-hover',
                !inMonth ? 'text-muted opacity-55' : '',
                isToday && !isSel
                  ? 'shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--blue)_55%,transparent)]'
                  : '',
                isSel
                  ? 'bg-blue text-white shadow-[0_4px_12px_-4px_color-mix(in_srgb,var(--blue)_70%,transparent)] hover:bg-blue'
                  : '',
                'disabled:cursor-not-allowed disabled:text-muted disabled:opacity-35 disabled:line-through',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => {
                onChange(iso(d));
                onClose();
              }}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
