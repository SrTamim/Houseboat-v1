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

  return (
    <>
      <div className={`drawer-sc${open ? ' open' : ''}`} onClick={onClose} />
      <aside className={`drawer${wide ? ' wide' : ''}${open ? ' open' : ''}`}>
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
