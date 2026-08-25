'use client';

import { useEffect } from 'react';

/**
 * Right slide-over panel. Rendered only when `open` so its content isn't in the
 * tree (and isn't fetching) while hidden.
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

  if (!open) return null;

  return (
    <>
      {/* Scrim (was .drawer-sc.open). Hidden when printing so the statement/
          invoice inside prints clean. */}
      <div
        className="fixed inset-0 z-[80] bg-[rgba(8,12,20,0.5)] backdrop-blur-[3px] animate-fade print:hidden"
        onClick={onClose}
      />
      {/* Panel (was .drawer.open). On print it flattens to normal flow so the
          statement/invoice prints in place (was the @media print .drawer rules). */}
      <aside
        className="owner-print-root fixed right-0 top-0 z-[81] flex h-screen w-[min(480px,95vw)] translate-x-0 flex-col border-l border-hair bg-raise-1 shadow-e3 print:static print:h-auto print:w-auto print:max-w-none print:translate-x-0 print:border-none print:shadow-none"
        role="dialog"
        aria-modal="true"
      >
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
        {/* Body (was .db) — overflow drops for print. */}
        <div className="flex-1 overflow-y-auto p-[22px] print:overflow-visible print:p-0">
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
