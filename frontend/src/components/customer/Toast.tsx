'use client';

import { useEffect, useState } from 'react';

/**
 * Centered transient message over a blurred, dimmed backdrop. Auto-closes after
 * `duration` (default 5s); dismissable via the × button or clicking the backdrop.
 * `role="status"` + aria-live so screen readers announce it; the pop-in is
 * skipped under reduced-motion.
 *
 * Controlled: render it only while a message should show, and pass `onClose` to
 * clear the parent's message state (fired by the timer, ×, and backdrop click).
 */
export function Toast({
  message,
  onClose,
  duration = 5000,
}: {
  message: string;
  onClose: () => void;
  duration?: number;
}) {
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion:reduce)').matches);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(id);
  }, [onClose, duration]);

  return (
    // Full-screen blurred backdrop; clicking it dismisses. The card is centered
    // and stops the click so only the backdrop (not the card) closes on tap.
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm"
    >
      <div
        role="status"
        aria-live="polite"
        onClick={(e) => e.stopPropagation()}
        className={`relative flex aspect-square w-[min(86vw,320px)] flex-col items-center justify-center gap-3 rounded-2xl border border-hair bg-raise-1 px-6 text-center text-sm font-semibold text-ink shadow-e3 ${
          reduced ? '' : 'animate-pop'
        }`}
      >
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onClose}
          className="absolute right-3 top-3 rounded p-1 text-muted transition-colors hover:text-ink"
        >
          ✕
        </button>
        <span className="text-3xl text-blue" aria-hidden="true">
          ℹ️
        </span>
        <p className="m-0 leading-snug">{message}</p>
      </div>
    </div>
  );
}
