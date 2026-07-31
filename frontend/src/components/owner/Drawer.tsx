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
      <div className="drawer-sc open" onClick={onClose} />
      <aside className="drawer open" role="dialog" aria-modal="true">
        <div className="dh">
          <h3>{title}</h3>
          <button className="x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="db">{children}</div>
        {footer ? <div className="df">{footer}</div> : null}
      </aside>
    </>
  );
}
