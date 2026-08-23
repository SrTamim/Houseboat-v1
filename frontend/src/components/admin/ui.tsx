'use client';

// Small presentational helpers shared across admin pages.

import { useEffect, useState } from 'react';
import { BTN, SEARCH_INPUT, SELECT as SELECT_CLS } from './styles';

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
    <div className="mb-6 flex flex-wrap items-start justify-between gap-[18px]">
      <div>
        <h1 className="text-[27px] tracking-[-0.03em] max-[560px]:text-[22px]">{title}</h1>
        {desc ? (
          <p className="mt-2 max-w-[74ch] text-[13.5px] leading-[1.55] text-muted">{desc}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2.5">{actions}</div> : null}
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
    <div
      className="rounded-2xl border border-hair bg-raise-1 shadow-[var(--e2),var(--top-hi)]"
      style={style}
    >
      {title || head ? (
        <div className="flex items-center justify-between gap-3 border-b border-hair-2 px-5 py-4">
          {title ? <h3 className="text-[15px] font-semibold">{title}</h3> : null}
          {sub ? <span className="text-[12px] font-medium text-muted">{sub}</span> : null}
          {head}
        </div>
      ) : null}
      <div className={flush ? 'p-0' : 'p-5'}>{children}</div>
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
    <div className="overflow-x-auto">
      <table
        className={TBL}
        style={{ minWidth: minWidth ?? 640 }}
      >
        {children}
      </table>
    </div>
  );
}

/* Full data-table styling (was `table.tbl` + its thead/tbody/hover combinators
   in admin.css). Kept here so every `<TableWrap>` renders identically; child
   cells opt into `.t1`/`.t2`/`.num` via the TD_* consts below. */
const TBL =
  'w-full border-separate border-spacing-0 text-[13.5px] ' +
  // thead th
  '[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-[1] [&_thead_th]:whitespace-nowrap [&_thead_th]:border-b [&_thead_th]:border-hair [&_thead_th]:bg-raise-1 [&_thead_th]:px-[18px] [&_thead_th]:py-3 [&_thead_th]:text-left [&_thead_th]:text-[10.5px] [&_thead_th]:font-bold [&_thead_th]:uppercase [&_thead_th]:tracking-[0.06em] [&_thead_th]:text-muted ' +
  // tbody td
  '[&_tbody_td]:h-14 [&_tbody_td]:border-b [&_tbody_td]:border-hair-2 [&_tbody_td]:px-[18px] [&_tbody_td]:py-[14px] [&_tbody_td]:align-middle [&_tbody_td]:text-bodytext ' +
  '[&_tbody_tr:last-child_td]:border-b-0 ' +
  // row hover
  '[&_tbody_tr]:transition-colors [&_tbody_tr]:duration-dur [&_tbody_tr:hover]:bg-hover ' +
  '[&_tbody_tr:hover_td:first-child]:shadow-[inset_3px_0_0_color-mix(in_srgb,var(--blue)_55%,transparent)]';

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
    <div
      className={`flex items-start gap-2.5 rounded border px-[15px] py-3 text-[13px] font-medium leading-[1.5] ${NOTE_TONE[kind]}`}
      style={style}
    >
      <span className="flex-none text-[15px] leading-[1.3]">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

/* Note tone fills (was `.note.info/.warn/.danger/.ok` + the dark info override). */
const NOTE_TONE: Record<'info' | 'warn' | 'danger' | 'ok', string> = {
  info: 'border-[color-mix(in_srgb,var(--blue)_18%,transparent)] bg-[color-mix(in_srgb,var(--blue)_8%,transparent)] text-blue-700 dark:text-blue',
  warn: 'border-[color-mix(in_srgb,var(--warn)_20%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] text-warn',
  danger:
    'border-[color-mix(in_srgb,var(--danger)_20%,transparent)] bg-[color-mix(in_srgb,var(--danger)_9%,transparent)] text-danger',
  ok: 'border-[color-mix(in_srgb,var(--ok)_20%,transparent)] bg-[color-mix(in_srgb,var(--ok)_10%,transparent)] text-ok',
};

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
    <div
      className="relative min-w-[200px] max-w-[340px] flex-1"
      style={maxWidth ? { maxWidth } : undefined}
    >
      <span className="absolute left-[13px] top-1/2 -translate-y-1/2 text-[14px] text-muted">
        🔍
      </span>
      <input
        className={SEARCH_INPUT}
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
      className={SELECT_CLS}
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
              <span className={SKEL} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

/* Table-skeleton shimmer bar (was `.skel`). */
const SKEL =
  "block h-[11px] rounded-[4px] bg-[linear-gradient(90deg,var(--hair-2)_25%,var(--hair)_37%,var(--hair-2)_63%)] bg-[length:400%_100%] animate-skel-pulse motion-reduce:animate-none";

/* Empty/error state container + its icon/title/desc (was `.empty-state` + children). */
const EMPTY = 'flex flex-col items-center justify-center gap-2 px-6 py-11 text-center';
const EMPTY_IC = 'text-[26px] leading-none text-muted opacity-75';
const EMPTY_T1 = 'text-[14px] font-[650] text-ink';
const EMPTY_T2 = 'm-0 max-w-[52ch] text-[12.5px] leading-[1.55] text-muted';

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
    <div className={EMPTY}>
      <span className={EMPTY_IC}>{icon}</span>
      <div className={EMPTY_T1}>{title}</div>
      {desc ? <p className={EMPTY_T2}>{desc}</p> : null}
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
    <div className={EMPTY}>
      <span className={EMPTY_IC}>⚠</span>
      <div className={EMPTY_T1}>Something went wrong</div>
      <p className={EMPTY_T2}>{text}</p>
      {onRetry ? (
        <button className={`${BTN} mt-1.5`} onClick={onRetry}>
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
