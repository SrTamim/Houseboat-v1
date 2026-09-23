'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Right slide-over panel on desktop; a full-screen bottom sheet on mobile
 * (≤1024px). Rendered only when `open` so its content isn't in the tree (and
 * isn't fetching) while hidden.
 *
 * On mobile the sheet can be dismissed by dragging the handle (or header) down.
 * The gesture is bound to the handle/header only — never the scrollable body —
 * so it doesn't fight body scroll.
 */
export function Drawer({
  open,
  title,
  onClose,
  footer,
  children,
}: {
  open: boolean;
  title: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  // Live drag offset (px) while swiping the sheet down on mobile. 0 = at rest.
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);

  // Escape closes. Registered only while open so a stray listener doesn't
  // swallow Escape elsewhere on the page.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Reset the drag offset whenever the sheet (re)opens, so a prior swipe-close
  // doesn't leave it pushed down on the next open.
  useEffect(() => {
    if (open) setDragY(0);
  }, [open]);

  if (!open) return null;

  // Only treat the drag as a dismiss gesture on the mobile bottom-sheet layout.
  const isMobile = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width:1024px)').matches;

  function onPointerDown(e: React.PointerEvent) {
    if (!isMobile()) return;
    dragStart.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (dragStart.current === null) return;
    setDragY(Math.max(0, e.clientY - dragStart.current));
  }
  function onPointerEnd() {
    if (dragStart.current === null) return;
    // Past ~120px of pull, treat it as a dismiss; otherwise spring back.
    if (dragY > 120) {
      onClose();
    } else {
      setDragY(0);
    }
    dragStart.current = null;
  }

  return (
    <>
      {/* Scrim (was .drawer-sc.open). Hidden when printing so the statement/
          invoice inside prints clean. */}
      <div
        className="fixed inset-0 z-[80] bg-[rgba(8,12,20,0.5)] backdrop-blur-[3px] animate-fade print:hidden"
        onClick={onClose}
      />
      {/* Panel (was .drawer.open). Desktop: right slide-over. Mobile (≤1024px):
          full-width bottom sheet at 92vh (an 8vh scrim peek reads as a sheet).
          On print it flattens to normal flow so the statement/invoice prints in
          place (was the @media print .drawer rules). */}
      <aside
        className="owner-print-root fixed right-0 top-0 z-[81] flex h-screen w-[min(480px,95vw)] translate-x-0 flex-col border-l border-hair bg-raise-1 shadow-e3 max-[1024px]:inset-x-0 max-[1024px]:top-auto max-[1024px]:bottom-0 max-[1024px]:h-[92vh] max-[1024px]:w-full max-[1024px]:rounded-t-2xl max-[1024px]:border-l-0 max-[1024px]:border-t max-[1024px]:animate-slide-up max-[1024px]:motion-reduce:animate-none print:static print:h-auto print:w-auto print:max-w-none print:translate-x-0 print:rounded-none print:inset-auto print:border-none print:shadow-none"
        role="dialog"
        aria-modal="true"
        // Apply the live drag offset only while actually dragging, so it never
        // fights the slide-up animation or the desktop layout.
        style={dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
      >
        {/* Drag handle — mobile only, and the gesture surface. */}
        <div
          className="hidden touch-none cursor-grab pt-2.5 pb-1 max-[1024px]:block print:hidden"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          <div className="mx-auto h-1.5 w-11 rounded-full bg-hair" />
        </div>
        {/* Header (was .dh) — hidden when printing. */}
        <div className="flex items-center justify-between border-b border-hair-2 px-[22px] py-[18px] print:hidden">
          <h3 className="text-[16px] font-semibold">{title}</h3>
          <button
            className="h-[34px] w-[34px] rounded-sm border border-hair bg-raise-1 text-[15px] text-bodytext transition-[border-color,color] duration-dur ease-ease hover:border-danger hover:text-danger"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {/* Body (was .db) — overflow drops for print. On mobile, contain the
            overscroll so scrolling the sheet doesn't chain to the page. */}
        <div className="flex-1 overflow-y-auto p-[22px] max-[1024px]:overscroll-contain print:overflow-visible print:p-0">
          {children}
        </div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2.5 border-t border-hair-2 px-[22px] py-4 print:hidden">
            {footer}
          </div>
        ) : null}
      </aside>
    </>
  );
}
