'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDate } from '@/lib/owner/format';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Local YYYY-MM-DD (avoids UTC off-by-one from toISOString). */
function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Modern custom date picker: the whole `.field` is the trigger and clicking
 * anywhere on it opens a hand-built, token-styled calendar popover (readable in
 * light + dark, unlike the OS-painted native date input). Value/onChange use
 * YYYY-MM-DD; the field displays "10 Aug 2026" via the shared formatDate().
 * Days before `min` are disabled. Click-outside + Escape close, mirroring
 * components/owner/BoatSwitcher.tsx.
 */
export function DatePicker({
  value,
  onChange,
  min,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const calRef = useRef<HTMLDivElement>(null);

  const selected = value ? new Date(`${value}T00:00:00`) : null;
  const minDate = min ? new Date(`${min}T00:00:00`) : null;

  // Month currently shown in the grid (defaults to the selected month / today).
  const [view, setView] = useState(() => {
    const base = selected ?? new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });

  useEffect(() => {
    if (!open) return;
    // Re-sync the grid to the selected month each time it opens.
    const base = selected ?? new Date();
    setView({ year: base.getFullYear(), month: base.getMonth() });
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !calRef.current?.contains(t)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        className={`block w-full cursor-pointer rounded border bg-field px-4 py-3 text-left transition-[border-color,box-shadow] duration-dur ease-ease hover:border-[color-mix(in_srgb,var(--blue)_30%,var(--hair))] ${
          open
            ? 'border-blue shadow-ring'
            : 'border-hair focus-within:border-blue focus-within:shadow-ring'
        }`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-[6px] text-[11.5px] font-bold uppercase tracking-[.05em] text-muted">
          📅 Departure
        </span>
        <span className="mt-[3px] block font-display text-[17px] font-semibold text-ink">
          {value ? formatDate(value) : 'Pick a date'}
        </span>
        <span className="mt-px block text-[12.5px] font-medium text-muted">
          {value ? 'Tap to change' : 'Flexible'}
        </span>
      </button>

      {open && (
          <div
            ref={calRef}
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
                    setOpen(false);
                  }}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
