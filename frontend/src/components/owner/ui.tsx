'use client';

import { useEffect, useState } from 'react';
import { BTN_O, BTN_SM, FIELD_BLOCK, FILTERBAR_CHILDREN, SKEL, TBL } from './styles';

/* ────────────────────────────────────────────────────────────
   Owner console UI primitives.

   Tailwind-based (utilities + the shared consts in ./styles) — the
   same approach as the admin kit, but a separate set because the
   owner design system has its own card, KPI and pill structure.
   ──────────────────────────────────────────────────────────── */

export function PageHead({
  title,
  desc,
  actions,
  descHideOnMobile,
}: {
  title: string;
  desc?: React.ReactNode;
  actions?: React.ReactNode;
  /** Hide the description ≤1024px to save vertical space (desktop keeps it). */
  descHideOnMobile?: boolean;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-[18px]">
      <div>
        <h1 className="text-[27px] tracking-[-0.03em] max-[560px]:text-[22px]">{title}</h1>
        {desc ? (
          <p
            className={`mt-2 max-w-[74ch] text-[13.5px] leading-[1.55] text-muted${
              descHideOnMobile ? ' max-[1024px]:hidden' : ''
            }`}
          >
            {desc}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2.5">{actions}</div> : null}
    </div>
  );
}

export type Tone = 'info' | 'ok' | 'warn' | 'danger';

/** Stat card. `alert` turns the whole card red — reserve it for "act now". */
export function Kpi({
  icon,
  label,
  value,
  unit,
  detail,
  delta,
  alert,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
  unit?: string;
  detail?: React.ReactNode;
  /** 'up' | 'down' renders a coloured chip; anything else stays plain text. */
  delta?: { text: string; dir?: 'up' | 'down' };
  alert?: boolean;
}) {
  // Decorative corner glow (was .kpi::after) — tinted blue, red when alert.
  const glow = alert
    ? 'after:[background:radial-gradient(circle,color-mix(in_srgb,var(--danger)_13%,transparent),transparent_70%)]'
    : 'after:[background:radial-gradient(circle,color-mix(in_srgb,var(--blue)_12%,transparent),transparent_70%)]';
  // Icon chip gradient (was .kpi .chip) — blue, red when alert.
  const chip = alert
    ? 'text-danger [background:linear-gradient(145deg,color-mix(in_srgb,var(--danger)_20%,var(--raise-1)),color-mix(in_srgb,var(--danger)_9%,var(--raise-1)))] [box-shadow:inset_0_0_0_1px_color-mix(in_srgb,var(--danger)_22%,transparent),var(--top-hi)]'
    : 'text-blue [background:linear-gradient(145deg,color-mix(in_srgb,var(--blue)_22%,var(--raise-1)),color-mix(in_srgb,var(--blue)_10%,var(--raise-1)))] [box-shadow:inset_0_0_0_1px_color-mix(in_srgb,var(--blue)_24%,transparent),var(--top-hi)]';
  return (
    <div
      className={`relative flex min-h-[132px] max-[1024px]:min-h-0 flex-col overflow-hidden rounded-2xl border border-hair bg-raise-1 p-[18px] max-[1024px]:p-3 shadow-[var(--e2),var(--top-hi)] after:pointer-events-none after:absolute after:-right-10 after:-top-10 after:h-[130px] after:w-[130px] after:rounded-full after:content-[''] ${glow}${
        alert ? ' border-t-2 border-t-danger' : ''
      }`}
    >
      <div className="relative z-[1] flex items-center gap-[11px]">
        <span
          className={`grid h-[38px] w-[38px] max-[1024px]:h-7 max-[1024px]:w-7 max-[1024px]:text-[13px] flex-none place-items-center rounded-[11px] text-[17px] ${chip}`}
        >
          {icon}
        </span>
        <span className="text-[11.5px] font-semibold tracking-[0.01em] text-muted">{label}</span>
      </div>
      <div
        className={`mt-auto pt-[14px] max-[1024px]:pt-2 font-display text-[31px] max-[1024px]:text-[22px] font-semibold leading-none tracking-[-0.035em] tabular-nums ${
          alert ? 'text-danger' : 'text-ink'
        }`}
      >
        {unit ? <span className="mr-px text-[17px] font-semibold text-muted">{unit}</span> : null}
        {value}
      </div>
      {delta || detail ? (
        <div className="mt-[9px] flex items-center gap-1.5 text-[12px] font-medium leading-[1.35] text-muted">
          {delta ? (
            <span
              className={
                delta.dir
                  ? `flex-none whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-bold tabular-nums ${
                      delta.dir === 'up'
                        ? 'bg-[color-mix(in_srgb,var(--ok)_14%,transparent)] text-ok'
                        : 'bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] text-danger'
                    }`
                  : 'text-[12px] font-medium tabular-nums text-muted'
              }
            >
              {delta.text}
            </span>
          ) : null}
          {detail}
        </div>
      ) : null}
    </div>
  );
}

export function Kpis({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 grid grid-cols-[repeat(auto-fill,minmax(212px,1fr))] gap-4 max-[1024px]:grid-cols-2 max-[1024px]:gap-2.5">{children}</div>
  );
}

export function Card({
  title,
  sub,
  actions,
  flush,
  children,
  style,
}: {
  title?: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
  /** Drop body padding — use when the body is a full-bleed table. */
  flush?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="rounded-2xl border border-hair bg-raise-1 shadow-[var(--e2),var(--top-hi)]"
      style={style}
    >
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-hair-2 px-5 py-4">
          <div>
            <h3 className="text-[15px] font-semibold">{title}</h3>
            {sub ? <div className="text-[12px] font-medium text-muted">{sub}</div> : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className={flush ? 'p-0' : 'p-5'}>{children}</div>
    </div>
  );
}

export function TableWrap({
  children,
  minWidth,
}: {
  children: React.ReactNode;
  minWidth?: number;
}) {
  return (
    // Desktop scrolls a wide table sideways; on mobile (≤1024px) the TBL rules
    // reflow each row into a card, so the wrapper stops scrolling and the
    // inline min-width is released (see the `max-[1024px]:!min-w-0` in TBL).
    <div className="overflow-x-auto max-[1024px]:overflow-x-visible">
      <table className={TBL} style={{ minWidth: minWidth ?? 640 }}>
        {children}
      </table>
    </div>
  );
}

export function Note({
  kind = 'info',
  icon,
  children,
  style,
}: {
  kind?: Tone;
  icon?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const fallback = { info: 'ℹ', ok: '✓', warn: '⚠', danger: '⚠' }[kind];
  const tone = {
    info: 'border-[color-mix(in_srgb,var(--blue)_18%,transparent)] bg-[color-mix(in_srgb,var(--blue)_8%,transparent)] text-blue-700 dark:text-blue',
    ok: 'border-[color-mix(in_srgb,var(--ok)_20%,transparent)] bg-[color-mix(in_srgb,var(--ok)_10%,transparent)] text-ok',
    warn: 'border-[color-mix(in_srgb,var(--warn)_20%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] text-warn',
    danger:
      'border-[color-mix(in_srgb,var(--danger)_20%,transparent)] bg-[color-mix(in_srgb,var(--danger)_9%,transparent)] text-danger',
  }[kind];
  return (
    <div
      className={`flex items-start gap-2.5 rounded border px-[15px] py-3 text-[13px] font-medium leading-[1.5] ${tone}`}
      style={style}
    >
      <span className="flex-none text-[15px] leading-[1.3]">{icon ?? fallback}</span>
      <span>{children}</span>
    </div>
  );
}

/** Key/value list used in drawers and summary panels. */
export function Kv({ rows }: { rows: [React.ReactNode, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[13.5px]">
      {rows.map(([k, v], i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt className="font-medium text-muted">{k}</dt>
          <dd className="m-0 text-right font-semibold text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface SegOption {
  value: string;
  label: string;
  count?: number;
}

/** Segmented filter control. Controlled — the page owns the selection. */
export function Seg({
  options,
  value,
  onChange,
}: {
  options: SegOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex rounded border border-hair bg-field p-[3px] max-[1024px]:max-w-full max-[1024px]:overflow-x-auto">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`shrink-0 whitespace-nowrap rounded-[7px] px-[13px] py-[7px] text-[12.5px] font-semibold transition-all duration-dur ease-ease ${
            o.value === value
              ? 'bg-raise-1 text-blue shadow-e1'
              : 'bg-transparent text-bodytext hover:text-blue'
          }`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count !== undefined ? (
            <span className="ml-1 tabular-nums opacity-[0.65]">{o.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  // The old `.filterbar > input/select` element rules styled bare date/month/
  // select controls dropped straight in; reproduced here as child variants so
  // pages passing bare controls render identically (was owner.css).
  return <div className={`flex flex-wrap items-center gap-3 max-[1024px]:gap-2 ${FILTERBAR_CHILDREN}`}>{children}</div>;
}

/**
 * Debounced search box. Typing updates the visible value immediately but only
 * calls onChange after the user pauses, so each keystroke doesn't fire a query.
 */
export function Search({
  placeholder = 'Search…',
  value,
  onChange,
  debounceMs = 300,
}: {
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  debounceMs?: number;
}) {
  const [local, setLocal] = useState(value);

  // Adopt external resets (e.g. "clear filters") without fighting the user.
  useEffect(() => setLocal(value), [value]);

  useEffect(() => {
    if (local === value) return;
    const t = setTimeout(() => onChange(local), debounceMs);
    return () => clearTimeout(t);
    // onChange is typically an inline arrow; depending on it would reset the
    // timer every render and the debounce would never fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, debounceMs]);

  return (
    <div className="relative min-w-[200px] max-w-[340px] flex-1 max-[1024px]:max-w-full">
      <span className="absolute left-[13px] top-1/2 -translate-y-1/2 text-[14px] text-muted">
        🔍
      </span>
      <input
        type="search"
        placeholder={placeholder}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        className="h-10 max-[1024px]:h-9 w-full rounded border border-hair bg-field pl-[38px] pr-[14px] text-[14px] max-[1024px]:text-[13px] text-ink transition-[border-color,box-shadow] duration-dur ease-ease placeholder:text-muted focus:border-blue focus:shadow-ring focus:outline-none"
      />
    </div>
  );
}

export function Select({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: (string | { value: string; label: string })[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
}) {
  return (
    <select
      className="h-10 max-[1024px]:h-9 max-[1024px]:text-[13px] cursor-pointer rounded border border-hair bg-field px-3 text-[13.5px] font-medium text-ink focus:border-blue focus:shadow-ring focus:outline-none"
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => {
        const opt = typeof o === 'string' ? { value: o, label: o } : o;
        return (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        );
      })}
    </select>
  );
}

/** Labelled input wrapper matching the design system's floating-label field. */
export function Field({
  label,
  children,
  style,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className={FIELD_BLOCK} style={style}>
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c}>
              <div className={SKEL} style={{ width: c === 0 ? '70%' : '45%' }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export function EmptyState({
  icon = '🗂',
  title,
  message,
  action,
}: {
  icon?: string;
  title: string;
  message?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-6 py-11 text-center text-muted">
      <div className="mb-2.5 text-[26px]">{icon}</div>
      <h4 className="mb-1.5 text-[15px] text-ink">{title}</h4>
      {message ? <p className="mx-auto max-w-[46ch] text-[13px] leading-[1.55]">{message}</p> : null}
      {action ? <div className="mt-[14px]">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const message = (() => {
    const m = (error as { response?: { data?: { message?: unknown } } })?.response?.data
      ?.message;
    if (Array.isArray(m)) return m.join(', ');
    if (typeof m === 'string') return m;
    return 'Something went wrong loading this.';
  })();

  return (
    <div className="px-6 py-11 text-center text-muted">
      <div className="mb-2.5 text-[26px]">⚠</div>
      <h4 className="mb-1.5 text-[15px] text-ink">Could not load</h4>
      <p className="mx-auto max-w-[46ch] text-[13px] leading-[1.55]">{message}</p>
      {onRetry ? (
        <button className={`${BTN_O} ${BTN_SM} mt-[14px]`} onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

/**
 * Picks loading / error / empty / content for a table body so every page
 * doesn't re-implement the same four-way branch.
 */
export function AsyncTable({
  isLoading,
  error,
  isEmpty,
  onRetry,
  skeleton,
  empty,
  children,
}: {
  isLoading: boolean;
  error?: unknown;
  isEmpty: boolean;
  onRetry?: () => void;
  skeleton?: React.ReactNode;
  empty?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (error) {
    return (
      <tbody>
        <tr>
          <td colSpan={99} style={{ height: 'auto' }}>
            <ErrorState error={error} onRetry={onRetry} />
          </td>
        </tr>
      </tbody>
    );
  }
  if (isLoading) return <>{skeleton ?? <TableSkeleton />}</>;
  if (isEmpty) {
    return (
      <tbody>
        <tr>
          <td colSpan={99} style={{ height: 'auto' }}>
            {empty ?? <EmptyState title="Nothing here yet" />}
          </td>
        </tr>
      </tbody>
    );
  }
  return <>{children}</>;
}

/** Non-table async wrapper for card bodies and panels. */
export function AsyncBlock({
  isLoading,
  error,
  isEmpty,
  onRetry,
  empty,
  children,
}: {
  isLoading: boolean;
  error?: unknown;
  isEmpty?: boolean;
  onRetry?: () => void;
  empty?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className={SKEL} style={{ width: '60%' }} />
        <div className={SKEL} style={{ width: '85%' }} />
        <div className={SKEL} style={{ width: '40%' }} />
      </div>
    );
  }
  if (isEmpty) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  return <>{children}</>;
}

/** "Load more" footer for cursor-paged lists. */
export function LoadMore({
  hasMore,
  isLoading,
  onClick,
}: {
  hasMore: boolean;
  isLoading?: boolean;
  onClick: () => void;
}) {
  if (!hasMore) return null;
  return (
    <div style={{ padding: 16, textAlign: 'center' }}>
      <button className={`${BTN_O} ${BTN_SM}`} onClick={onClick} disabled={isLoading}>
        {isLoading ? 'Loading…' : 'Load more'}
      </button>
    </div>
  );
}
