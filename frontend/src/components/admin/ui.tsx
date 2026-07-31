'use client';

// Small presentational helpers shared across admin pages.

import { useEffect, useState } from 'react';

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

export function Card({
  title,
  sub,
  head,
  flush = false,
  children,
  style,
}: {
  title?: string;
  sub?: React.ReactNode;
  head?: React.ReactNode;
  flush?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="card2" style={style}>
      {title || head ? (
        <div className="ch">
          {title ? <h3>{title}</h3> : null}
          {sub ? <span className="sub">{sub}</span> : null}
          {head}
        </div>
      ) : null}
      <div className={`cb${flush ? ' flush' : ''}`}>{children}</div>
    </div>
  );
}

export function TableWrap({
  minWidth,
  children,
}: {
  minWidth?: number;
  children: React.ReactNode;
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
  kind?: 'info' | 'warn' | 'danger' | 'ok';
  icon: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`note ${kind}`} style={style}>
      <span className="ic">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

/**
 * Search box.
 *
 * Controlled ONLY when `value` is supplied — pages that haven't been wired to
 * an API yet pass nothing and keep their existing uncontrolled behaviour, so
 * adopting this is incremental rather than a 30-page rewrite.
 *
 * Typing is debounced internally so callers can use the value directly as a
 * query key without firing a request per keystroke.
 */
export function Search({
  placeholder,
  defaultValue,
  maxWidth,
  value,
  onChange,
  debounceMs = 300,
}: {
  placeholder?: string;
  defaultValue?: string;
  maxWidth?: number;
  value?: string;
  onChange?: (value: string) => void;
  debounceMs?: number;
}) {
  const controlled = value !== undefined;
  // Mirror keystrokes locally so the input stays responsive while the
  // debounced value settles.
  const [draft, setDraft] = useState(value ?? '');

  useEffect(() => {
    if (controlled) setDraft(value);
  }, [controlled, value]);

  useEffect(() => {
    if (!controlled || !onChange || draft === value) return;
    const t = setTimeout(() => onChange(draft), debounceMs);
    return () => clearTimeout(t);
  }, [controlled, draft, value, onChange, debounceMs]);

  return (
    <div className="search" style={maxWidth ? { maxWidth } : undefined}>
      <span className="mag">🔍</span>
      <input
        placeholder={placeholder}
        {...(controlled
          ? { value: draft, onChange: (e) => setDraft(e.target.value) }
          : { defaultValue })}
      />
    </div>
  );
}

/** A choice whose wire value differs from its label (e.g. advance_paid → Advance Paid). */
export type SelectOption = { value: string; label: string };

export function Select({
  options,
  style,
  value,
  onChange,
}: {
  /** Plain strings when value and label are the same. */
  options: (string | SelectOption)[];
  style?: React.CSSProperties;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const items: SelectOption[] = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o,
  );
  const controlled = value !== undefined;

  return (
    <select
      className="select"
      style={style}
      {...(controlled
        ? { value, onChange: (e) => onChange?.(e.target.value) }
        : {})}
    >
      {items.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ── Async states ────────────────────────────────────────────────────────────

/**
 * Placeholder rows while a table loads. Rendered inside <TableWrap> so column
 * widths don't jump when the real data arrives.
 */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <tbody aria-hidden="true">
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }, (_, c) => (
            <td key={c}>
              <span className="skel" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export function EmptyState({
  icon = '∅',
  title,
  desc,
  action,
}: {
  icon?: string;
  title: string;
  desc?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="ic">{icon}</span>
      <div className="t1">{title}</div>
      {desc ? <p className="t2">{desc}</p> : null}
      {action}
    </div>
  );
}

/**
 * Failure state for a list.
 *
 * The backend returns a generic message in production by design (it must not
 * enumerate its schema), so this shows what it can and offers a retry rather
 * than pretending to explain.
 */
export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const message =
    (error as { response?: { data?: { message?: unknown } } })?.response?.data
      ?.message ?? 'Could not load this data.';
  const text = Array.isArray(message) ? message.join(', ') : String(message);

  return (
    <div className="empty-state">
      <span className="ic">⚠</span>
      <div className="t1">Something went wrong</div>
      <p className="t2">{text}</p>
      {onRetry ? (
        <button className="btn" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

/**
 * Picks the right state for an async table so pages don't each hand-roll the
 * loading/error/empty ternary. Renders `children` only when there is data.
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
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (isLoading) return <>{skeleton ?? <TableSkeleton />}</>;
  if (isEmpty) {
    return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  }
  return <>{children}</>;
}
