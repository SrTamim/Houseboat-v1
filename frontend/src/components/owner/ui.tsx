'use client';

import { useEffect, useState } from 'react';

/* ────────────────────────────────────────────────────────────
   Owner console UI primitives.

   Class-name based, styled entirely by app/owner/owner.css — the
   same approach as the admin kit, but a separate set because the
   owner design system has its own card, KPI and pill structure.
   ──────────────────────────────────────────────────────────── */

export function PageHead({
  title,
  desc,
  actions,
}: {
  title: string;
  desc?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {desc ? <p>{desc}</p> : null}
      </div>
      {actions ? <div className="acts">{actions}</div> : null}
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
  return (
    <div className={`kpi${alert ? ' alert' : ''}`}>
      <div className="top">
        <span className="chip">{icon}</span>
        <span className="l">{label}</span>
      </div>
      <div className="n">
        {unit ? <span className="u">{unit}</span> : null}
        {value}
      </div>
      {delta || detail ? (
        <div className="d">
          {delta ? (
            <span className={`delta${delta.dir ? ` ${delta.dir}` : ''}`}>{delta.text}</span>
          ) : null}
          {detail}
        </div>
      ) : null}
    </div>
  );
}

export function Kpis({ children }: { children: React.ReactNode }) {
  return <div className="kpis">{children}</div>;
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
    <div className="card2" style={style}>
      {title ? (
        <div className="ch">
          <div>
            <h3>{title}</h3>
            {sub ? <div className="sub">{sub}</div> : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className={`cb${flush ? ' flush' : ''}`}>{children}</div>
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
    <div className="tbl-wrap">
      <table className="tbl" style={minWidth ? { minWidth } : undefined}>
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
  return (
    <div className={`note ${kind}`} style={style}>
      <span className="ic">{icon ?? fallback}</span>
      <span>{children}</span>
    </div>
  );
}

/** Key/value list used in drawers and summary panels. */
export function Kv({ rows }: { rows: [React.ReactNode, React.ReactNode][] }) {
  return (
    <dl className="kv">
      {rows.map(([k, v], i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
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
    <div className="seg">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`seg-b${o.value === value ? ' on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count !== undefined ? <span className="ct">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="filterbar">{children}</div>;
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
    <div className="search">
      <span className="mag">🔍</span>
      <input
        type="search"
        placeholder={placeholder}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
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
      className="select"
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
    <div className="field" style={style}>
      <label>{label}</label>
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
              <div className="skel" style={{ width: c === 0 ? '70%' : '45%' }} />
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
    <div className="state">
      <div className="ic">{icon}</div>
      <h4>{title}</h4>
      {message ? <p>{message}</p> : null}
      {action}
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
    <div className="state">
      <div className="ic">⚠</div>
      <h4>Could not load</h4>
      <p>{message}</p>
      {onRetry ? (
        <button className="btn btn-o btn-sm" onClick={onRetry}>
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
        <div className="skel" style={{ width: '60%' }} />
        <div className="skel" style={{ width: '85%' }} />
        <div className="skel" style={{ width: '40%' }} />
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
      <button className="btn btn-o btn-sm" onClick={onClick} disabled={isLoading}>
        {isLoading ? 'Loading…' : 'Load more'}
      </button>
    </div>
  );
}
