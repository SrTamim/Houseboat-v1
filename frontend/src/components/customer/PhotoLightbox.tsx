'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Full-screen photo viewer (design: haorboat-boat.html `.modal#imgModal`,
 * CSS 238–271 / 263–271, behaviour 1037–1065).
 *
 * Serves both galleries on the page — the boat-level mosaic and a cabin's own
 * photos — so prev/next, the `N / M` counter and the thumbnail strip behave
 * identically wherever photos are opened from. Index is owned by the caller so
 * a cabin can open straight onto a given shot.
 *
 * Prev/next wrap with modulo, matching the preview. The preview had no focus
 * management at all; this adds Escape-to-close, a backdrop click, focus restore
 * and `role="dialog"` without changing anything visual.
 */
export function PhotoLightbox({
  photos,
  title,
  index,
  onIndexChange,
  onClose,
}: {
  photos: string[];
  title: string;
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  const go = useCallback(
    (delta: number) => {
      if (photos.length === 0) return;
      onIndexChange((index + delta + photos.length) % photos.length);
    },
    [index, photos.length, onIndexChange],
  );

  // Remember what had focus, move it into the dialog, and hand it back on close
  // so keyboard users don't get dumped at the top of the document.
  useEffect(() => {
    restoreTo.current = document.activeElement as HTMLElement | null;
    boxRef.current?.focus();
    return () => restoreTo.current?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
      // Simple focus trap: the dialog holds only a handful of controls, so
      // cycling within the box is enough — no need for a full tabbable scan.
      if (e.key === 'Tab' && boxRef.current) {
        const items = boxRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  // Swipe / click-drag to page through. Pointer events cover touch, pen and
  // mouse in one path; anything shorter than the threshold is treated as a tap
  // so it doesn't fight the thumbnail and arrow buttons.
  const dragFrom = useRef<number | null>(null);
  const SWIPE_PX = 40;

  const onPointerDown = (e: React.PointerEvent) => {
    dragFrom.current = e.clientX;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragFrom.current === null) return;
    const dx = e.clientX - dragFrom.current;
    dragFrom.current = null;
    if (Math.abs(dx) >= SWIPE_PX) go(dx < 0 ? 1 : -1);
  };

  if (photos.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-5">
      <button
        type="button"
        aria-label="Close photos"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[rgba(10,20,40,.6)] backdrop-blur-[2px]"
      />
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex max-h-[88vh] w-[min(680px,100%)] flex-col overflow-hidden rounded-2xl bg-raise-1 shadow-e3 outline-none"
      >
        <div className="flex items-center gap-2.5 bg-[linear-gradient(120deg,var(--blue-700),var(--blue))] px-5 py-4 text-white">
          <span aria-hidden="true">🖼️</span>
          <h3 className="flex-1 font-display text-[17px] font-semibold text-white">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-[34px] w-[34px] place-items-center rounded-full border-none bg-white/20 text-base text-white transition-colors hover:bg-white/[.32]"
          >
            ✕
          </button>
        </div>

        <div
          className="relative aspect-[16/10] touch-pan-y select-none bg-black"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (dragFrom.current = null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[index]}
            alt={`${title} — photo ${index + 1} of ${photos.length}`}
            draggable={false}
            className="h-full w-full object-cover"
          />
          {photos.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous photo"
                className="absolute left-3 top-1/2 grid h-[42px] w-[42px] -translate-y-1/2 place-items-center rounded-full border-none bg-white/90 text-xl text-ink"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next photo"
                className="absolute right-3 top-1/2 grid h-[42px] w-[42px] -translate-y-1/2 place-items-center rounded-full border-none bg-white/90 text-xl text-ink"
              >
                ›
              </button>
            </>
          ) : null}
          <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[rgba(15,36,64,.7)] px-3 py-1 text-[12.5px] font-bold text-white">
            {index + 1} / {photos.length}
          </span>
        </div>

        {photos.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto p-3.5">
            {photos.map((p, i) => (
              <button
                key={`${p}-${i}`}
                type="button"
                onClick={() => onIndexChange(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === index}
                className={`h-[58px] w-20 flex-none overflow-hidden rounded-lg border-2 ${
                  i === index ? 'border-blue' : 'border-transparent'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
