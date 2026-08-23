import type { PillTone } from '@/lib/admin/status';
import { TAG } from './styles';

/* Status pill base (was `.pill`) — the leading dot is a `::before` in currentColor;
   `.lock` replaces it with a padlock glyph. Tones were `.pill.blue/.ok/…`. */
const PILL_BASE =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[11.5px] font-semibold leading-[1.5] before:h-1.5 before:w-1.5 before:flex-none before:rounded-full before:bg-current before:content-['']";

// Padlock variant (was `.pill.lock::before`) — glyph instead of a dot.
const PILL_LOCK =
  "before:h-auto before:w-auto before:rounded-none before:bg-transparent before:text-[9px] before:content-['🔒']";

const PILL_TONE: Record<PillTone, string> = {
  blue: 'border-[color-mix(in_srgb,var(--blue)_20%,transparent)] bg-[color-mix(in_srgb,var(--blue)_12%,transparent)] text-blue-600',
  ok: 'border-[color-mix(in_srgb,var(--ok)_22%,transparent)] bg-[color-mix(in_srgb,var(--ok)_13%,transparent)] text-ok',
  warn: 'border-[color-mix(in_srgb,var(--warn)_24%,transparent)] bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] text-warn',
  danger:
    'border-[color-mix(in_srgb,var(--danger)_22%,transparent)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-danger',
  amb: 'border-[color-mix(in_srgb,var(--amber)_26%,transparent)] bg-[color-mix(in_srgb,var(--amber)_16%,transparent)] text-amber-700 dark:text-amber',
  mut: 'border-hair bg-chip text-muted',
};

export function Pill({
  tone = 'mut',
  lock = false,
  children,
}: {
  tone?: PillTone;
  lock?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className={`${PILL_BASE} ${PILL_TONE[tone]}${lock ? ` ${PILL_LOCK}` : ''}`}>
      {children}
    </span>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return <span className={TAG}>{children}</span>;
}
