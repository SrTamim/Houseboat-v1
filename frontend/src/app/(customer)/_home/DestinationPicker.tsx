'use client';

import { useEffect, useId, useRef, useState } from 'react';

export interface DestOption {
  label: string;
  sub?: string;
}

/**
 * Modern custom destination dropdown that replaces the native <select> (whose
 * option list is unreadable in dark mode). Trigger fills the `.field` slot; the
 * menu renders inline as an absolute child of that slot so the browser keeps it
 * glued to the trigger during scroll — repositioning a portaled fixed menu from
 * JS always trails by a frame. The hero deliberately has no `overflow-hidden`
 * so this can escape it. Mirrors the click-outside + Escape pattern from
 * components/owner/BoatSwitcher.tsx.
 */
export function DestinationPicker({
  options,
  value,
  onChange,
}: {
  options: DestOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      // The menu is portaled out of the trigger's subtree, so check both.
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) {
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
  }, [open]);

  const current = options.find((o) => o.label === value) ?? options[0];
  const shownLabel = current?.label || 'Select destination';
  const shownSub = current?.sub;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        className={`group relative block w-full cursor-pointer rounded border bg-field px-4 py-3 text-left transition-[border-color,box-shadow] duration-dur ease-ease hover:border-[color-mix(in_srgb,var(--blue)_30%,var(--hair))] ${
          open
            ? 'border-blue shadow-ring'
            : 'border-hair focus-within:border-blue focus-within:shadow-ring'
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-[6px] text-[11.5px] font-bold uppercase tracking-[.05em] text-muted">
          📍 Destination
        </span>
        <span className="mt-[3px] block font-display text-[17px] font-semibold text-ink">
          {shownLabel}
        </span>
        <span className="mt-px block text-[12.5px] font-medium text-muted">
          {shownSub || ' '}
        </span>
      </button>

      {open && (
          <ul
            ref={menuRef}
            className="absolute left-0 top-full z-[200] m-0 mt-[6px] max-h-[320px] w-full list-none overflow-auto rounded-xl border border-hair bg-raise-2 p-[6px] shadow-[var(--e3),var(--top-hi)] animate-ddIn"
            role="listbox"
            id={listId}
            aria-label="Destination"
          >
            {options.map((o) => {
              const selected = o.label === value;
              return (
                <li
                  key={o.label}
                  role="option"
                  aria-selected={selected}
                  className={`flex cursor-pointer items-start gap-[10px] rounded p-[10px_12px] transition-colors duration-dur ease-ease hover:bg-hover ${
                    selected ? 'bg-[color-mix(in_srgb,var(--blue)_10%,transparent)]' : ''
                  }`}
                  onClick={() => {
                    onChange(o.label);
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
                      {o.label}
                    </span>
                    {o.sub && (
                      <span className="text-[12.5px] font-medium text-muted">
                        {o.sub}
                      </span>
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
