'use client';

import { useRef, useState } from 'react';
import { formatDate } from '@/lib/owner/format';
import { CalendarPanel } from '@/components/customer/CalendarPanel';

/**
 * Modern custom date picker: the whole `.field` is the trigger and clicking
 * anywhere on it opens a hand-built, token-styled calendar popover (readable in
 * light + dark, unlike the OS-painted native date input). Value/onChange use
 * YYYY-MM-DD; the field displays "10 Aug 2026" via the shared formatDate().
 * Days before `min` are disabled. Click-outside + Escape close, mirroring
 * components/owner/BoatSwitcher.tsx.
 *
 * The calendar itself lives in components/customer/CalendarPanel.tsx, shared
 * with the search bar's compact departure field.
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
        <CalendarPanel
          value={value}
          onChange={onChange}
          min={min}
          onClose={() => setOpen(false)}
          anchorRef={triggerRef}
        />
      )}
    </div>
  );
}
