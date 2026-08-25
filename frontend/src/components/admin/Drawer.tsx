'use client';

import { useEffect } from 'react';

// Right-side slide-in drawer. Controlled by `open`/`onClose`.
// Replaces the previews' data-drawer / #drawer DOM toggling.
export function Drawer({
  open,
  onClose,
  title,
  wide = false,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  wide?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Don't render the panel at all when closed. Relying on a `translate-x-full`
  // class to park it off-screen leaves it visible (and its children mounted +
  // fetching) if that utility isn't in the compiled CSS. Not mounting is robust
  // and also stops the child SWR call from running while closed.
  if (!open) return null;

  return (
    <>
      {/* Scrim (was `.drawer-sc`). Hidden in print. */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[80] block animate-fade bg-[rgba(8,12,20,0.5)] backdrop-blur-[3px] print:hidden"
      />
      {/* Panel (was `.drawer` / `.drawer.wide` / `.drawer.open`). In print it
          becomes static full-width so the open drawer prints as the invoice. */}
      <aside
        className={`fixed right-0 top-0 z-[81] flex h-screen translate-x-0 flex-col border-l border-hair bg-raise-1 shadow-e3 ${
          wide ? 'w-[min(780px,96vw)]' : 'w-[min(480px,95vw)]'
        } print:static print:h-auto print:w-full print:border-none print:shadow-none`}
      >
        <div className="flex items-center justify-between border-b border-hair-2 px-[22px] py-[18px]">
          <h3 className="text-[16px] font-semibold">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-[34px] w-[34px] place-items-center rounded-sm border border-hair bg-raise-1 text-[15px] text-bodytext transition-[border-color,color] duration-dur ease-ease hover:border-danger hover:text-danger"
          >
            ✕
          </button>
        </div>
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
