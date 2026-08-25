/* ────────────────────────────────────────────────────────────
   Owner console shared Tailwind class strings.

   A 1:1 translation of the reusable design-system classes that used to
   live in app/owner/owner.css (`.btn*`, `.icon-btn`, `.field`, `.select`,
   `.search`, `.seg*`, `.pill*`, tables, cards, cabin grid, drawer, …).
   Kept as shared consts (not components) so markup stays flat —
   `<Link className={BTN_O}>` — and every page converts to the same single
   source of truth.

   Colours/radii/shadows resolve through the CSS vars in globals.css
   (`:root` + `:root[data-theme="dark"]`, plus the owner-only overrides on
   `.owner-scope`), so token utilities like `bg-raise-1` / `text-ink` /
   `shadow-e2` theme-switch on `[data-theme]` with no per-utility `dark:`.
   ──────────────────────────────────────────────────────────── */

/* ---------- buttons (was .btn / .btn-*) ---------- */

/** Base shape shared by every button (was `.btn`). */
export const BTN =
  'inline-flex items-center gap-[7px] whitespace-nowrap rounded border border-transparent px-4 py-[9px] text-[13.5px] font-semibold leading-none transition-[background,border-color,box-shadow,transform] duration-dur ease-ease active:translate-y-[0.5px] disabled:cursor-not-allowed disabled:opacity-45 disabled:grayscale-[0.3] disabled:shadow-none';

/** Small size (was `.btn-sm`). Append after a base+variant. */
export const BTN_SM = 'px-[11px] py-1.5 text-[12.5px]';

/** Primary blue (was `.btn.btn-b`). */
export const BTN_B = `${BTN} bg-blue text-white shadow-[var(--e1),inset_0_1px_0_rgba(255,255,255,0.18)] hover:bg-blue-600`;

/** Outline / secondary (was `.btn.btn-o`). */
export const BTN_O = `${BTN} border-hair bg-raise-1 text-ink shadow-e1 hover:border-[color-mix(in_srgb,var(--blue)_45%,var(--hair))] hover:bg-[color-mix(in_srgb,var(--blue)_6%,var(--raise-1))] hover:text-blue`;

/** Positive / confirm (was `.btn.btn-ok`). */
export const BTN_OK = `${BTN} bg-ok text-white shadow-e1 hover:brightness-[1.06]`;

/** Destructive (was `.btn.btn-danger`). */
export const BTN_DANGER = `${BTN} border-[color-mix(in_srgb,var(--danger)_22%,transparent)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-danger hover:border-transparent hover:bg-danger hover:text-white`;

/* ---------- icon button (was .icon-btn) ---------- */

/** 40×40 outlined icon button (was `.icon-btn`). */
export const ICON_BTN =
  'relative grid h-10 w-10 place-items-center rounded border border-hair bg-raise-1 text-[16px] text-bodytext transition-[border-color,color,transform] duration-dur ease-ease hover:-translate-y-px hover:border-[color-mix(in_srgb,var(--blue)_40%,var(--hair))] hover:text-blue';

/** Red notification dot inside an ICON_BTN (was `.icon-btn .dot`). */
export const ICON_BTN_DOT =
  'absolute right-[9px] top-2 h-2 w-2 rounded-full border-2 border-bg bg-danger';

/* ---------- form fields (was .field / .select / .search input) ---------- */

/** Field wrapper (was `.field` — display:block). */
export const FIELD = 'block';

/** Field wrapper that also styles its bare child controls, reproducing the
    old `.field input/select/textarea` (+hover/focus/placeholder) descendant
    rules so pages can keep passing an unclassed `<input>`. Checkboxes and
    radios are excluded exactly as in owner.css. */
export const FIELD_BLOCK =
  'block ' +
  '[&_:is(input:not([type=checkbox]):not([type=radio]),select,textarea)]:h-[42px] ' +
  '[&_:is(input:not([type=checkbox]):not([type=radio]),select,textarea)]:w-full ' +
  '[&_:is(input:not([type=checkbox]):not([type=radio]),select,textarea)]:rounded ' +
  '[&_:is(input:not([type=checkbox]):not([type=radio]),select,textarea)]:border ' +
  '[&_:is(input:not([type=checkbox]):not([type=radio]),select,textarea)]:border-[var(--field-line)] ' +
  '[&_:is(input:not([type=checkbox]):not([type=radio]),select,textarea)]:bg-field ' +
  '[&_:is(input:not([type=checkbox]):not([type=radio]),select,textarea)]:px-3 ' +
  '[&_:is(input:not([type=checkbox]):not([type=radio]),select,textarea)]:text-[15px] ' +
  '[&_:is(input:not([type=checkbox]):not([type=radio]),select,textarea)]:font-semibold ' +
  '[&_:is(input:not([type=checkbox]):not([type=radio]),select,textarea)]:text-ink ' +
  '[&_:is(input:not([type=checkbox]):not([type=radio]),select,textarea)]:transition-[border-color,box-shadow] ' +
  '[&_:is(input:not([type=checkbox]):not([type=radio]),select,textarea)]:duration-dur ' +
  '[&_:is(input:not([type=checkbox]):not([type=radio]),select,textarea):hover]:border-muted ' +
  '[&_:is(input:not([type=checkbox]):not([type=radio]),select,textarea):focus]:border-blue ' +
  '[&_:is(input:not([type=checkbox]):not([type=radio]),select,textarea):focus]:shadow-ring ' +
  '[&_:is(input:not([type=checkbox]):not([type=radio]),select,textarea):focus]:outline-none ' +
  '[&_:is(input,textarea)::placeholder]:font-medium [&_:is(input,textarea)::placeholder]:text-muted ' +
  // textarea: taller, top-aligned padding, resizable
  '[&_textarea]:h-auto [&_textarea]:min-h-24 [&_textarea]:resize-y [&_textarea]:py-2.5 [&_textarea]:leading-[1.5] ' +
  // inline-prefix: the wrapper is the box, its input goes bare (was `.field .with-pre input`)
  '[&_.with-pre]:flex [&_.with-pre]:h-[42px] [&_.with-pre]:items-center [&_.with-pre]:gap-2 [&_.with-pre]:rounded [&_.with-pre]:border [&_.with-pre]:border-[var(--field-line)] [&_.with-pre]:bg-field [&_.with-pre]:px-3 ' +
  '[&_.with-pre:focus-within]:border-blue [&_.with-pre:focus-within]:shadow-ring ' +
  '[&_.with-pre>.pre]:flex-none [&_.with-pre>.pre]:text-[15px] [&_.with-pre>.pre]:font-bold [&_.with-pre>.pre]:text-muted ' +
  '[&_.with-pre_input]:h-auto [&_.with-pre_input]:w-auto [&_.with-pre_input]:flex-1 [&_.with-pre_input]:border-none [&_.with-pre_input]:bg-transparent [&_.with-pre_input]:p-0 [&_.with-pre_input]:shadow-none [&_.with-pre_input]:hover:border-transparent ' +
  // content helpers used inside a field (e.g. read-only name/phone): was `.t1`/`.t2`
  '[&_.t1]:font-semibold [&_.t1]:text-ink [&_.t2]:mt-px [&_.t2]:text-[12px] [&_.t2]:text-muted';

/** Uppercase caption above a control (was `.field label`). */
export const FIELD_LABEL =
  'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-muted';

/** Text/number/select/textarea control (was `.field input/select/textarea`). */
export const FIELD_INPUT =
  'h-[42px] w-full rounded border border-[var(--field-line)] bg-field px-3 text-[15px] font-semibold text-ink transition-[border-color,box-shadow] duration-dur ease-ease placeholder:font-medium placeholder:text-muted hover:border-muted focus:border-blue focus:shadow-ring focus:outline-none';

/** Textarea variant of FIELD_INPUT (was `.field textarea`). Append to it. */
export const FIELD_TEXTAREA = 'h-auto min-h-24 resize-y py-2.5 leading-[1.5]';

/** Inline-prefix wrapper — the box is the wrapper, the input goes bare
    (was `.field .with-pre`). */
export const WITH_PRE =
  'flex h-[42px] items-center gap-2 rounded border border-[var(--field-line)] bg-field px-3 focus-within:border-blue focus-within:shadow-ring';
/** The ৳ / +880 prefix glyph (was `.field .with-pre .pre`). */
export const WITH_PRE_PRE = 'flex-none text-[15px] font-bold text-muted';
/** Bare input inside a WITH_PRE (was `.field .with-pre input`). */
export const WITH_PRE_INPUT =
  'h-auto w-auto flex-1 border-none bg-transparent p-0 text-[15px] font-semibold text-ink shadow-none placeholder:text-muted focus:outline-none';

/** Standalone select control (was `.select`). */
export const SELECT =
  'h-10 cursor-pointer rounded border border-hair bg-field px-3 text-[13.5px] font-medium text-ink focus:border-blue focus:shadow-ring focus:outline-none';

/** Standalone search input (was `.search input`). Pair inside a relative wrapper. */
export const SEARCH_INPUT =
  'h-10 w-full rounded border border-hair bg-field pl-[38px] pr-[14px] text-[14px] text-ink placeholder:text-muted transition-[border-color,box-shadow] duration-dur ease-ease focus:border-blue focus:shadow-ring focus:outline-none';

/** Small inline search input used in card headers (was `.inv-search`). */
export const INV_SEARCH =
  'min-w-[200px] rounded border border-hair bg-raise-1 px-[11px] py-[7px] text-[13px] font-medium text-ink placeholder:text-muted focus:border-ink focus:outline-none';

/* ---------- filter bar + segmented control (was .filterbar / .seg / .seg-b) ---------- */

/** Row of filters above a table (was `.filterbar`). */
export const FILTERBAR = 'mb-[18px] flex flex-wrap items-center gap-3';
/** Bare date/month/select dropped into a filter bar (was `.filterbar > input/select`). */
export const FILTERBAR_CTRL =
  'h-10 cursor-pointer rounded border border-hair bg-field px-3 text-[13.5px] font-medium text-ink placeholder:text-muted focus:border-blue focus:shadow-ring focus:outline-none [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:[filter:var(--picker-icon-filter,none)]';

/** Child-variant version applied to the FilterBar container so bare `<input>` /
    `<select>` children inherit the filter control look (was `.filterbar > input`
    / `.filterbar > select` + the date-picker-indicator tint). */
export const FILTERBAR_CHILDREN =
  '[&>input]:h-10 [&>input]:cursor-pointer [&>input]:rounded [&>input]:border [&>input]:border-hair [&>input]:bg-field [&>input]:px-3 [&>input]:text-[13.5px] [&>input]:font-medium [&>input]:text-ink [&>input::placeholder]:text-muted [&>input:focus]:border-blue [&>input:focus]:shadow-ring [&>input:focus]:outline-none ' +
  '[&>select]:h-10 [&>select]:cursor-pointer [&>select]:rounded [&>select]:border [&>select]:border-hair [&>select]:bg-field [&>select]:px-3 [&>select]:text-[13.5px] [&>select]:font-medium [&>select]:text-ink [&>select:focus]:border-blue [&>select:focus]:shadow-ring [&>select:focus]:outline-none ' +
  '[&>input[type=date]::-webkit-calendar-picker-indicator]:cursor-pointer [&>input[type=date]::-webkit-calendar-picker-indicator]:[filter:var(--picker-icon-filter,none)] [&>input[type=month]::-webkit-calendar-picker-indicator]:cursor-pointer [&>input[type=month]::-webkit-calendar-picker-indicator]:[filter:var(--picker-icon-filter,none)]';
/** Segmented-control track (was `.seg`). */
export const SEG = 'inline-flex rounded border border-hair bg-field p-[3px]';
/** One segment button, base (was `.seg-b`). Add SEG_B_ON when active. */
export const SEG_B =
  'rounded-[7px] border-none bg-transparent px-[13px] py-[7px] text-[12.5px] font-semibold text-bodytext transition-all duration-dur ease-ease hover:text-blue';
/** Active segment (was `.seg-b.on`). Append to SEG_B. */
export const SEG_B_ON = 'bg-raise-1 text-blue shadow-e1';
/** Count suffix inside a segment (was `.seg-b .ct`). */
export const SEG_B_CT = 'ml-1 tabular-nums opacity-65';

/* ---------- misc reused bits ---------- */

/** Currency-symbol span inside a figure (was `.kpi .n .u`). */
export const UNIT = 'mr-px text-[17px] font-semibold text-muted';

/** Neutral chip/tag (was `.tag`). */
export const TAG =
  'inline-block rounded-sm border border-hair bg-chip px-[9px] py-[3px] text-[11px] font-semibold text-bodytext';

/** Tabular-numeric utility (was `.tnum`). */
export const TNUM = 'tabular-nums';

/** Display-font monetary figure (was `.money`). Add MONEY_NEG for negatives. */
export const MONEY = 'font-display font-semibold tabular-nums text-ink';
/** Negative money colour (was `.money.neg`). Append to MONEY. */
export const MONEY_NEG = 'text-danger';
/** Tertiary/caption text (was `.muted`). */
export const MUTED = 'text-muted';

/* ---------- data table (was table.tbl + thead/tbody/hover combinators) ---------- */

/** Full data-table styling (was `table.tbl`). Child cells opt into
    `.t1`/`.t2`/`.num` via the TD_* consts. Wrap in an `overflow-x-auto` div. */
export const TBL =
  'w-full border-separate border-spacing-0 text-[13.5px] ' +
  // thead th
  '[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-[1] [&_thead_th]:whitespace-nowrap [&_thead_th]:border-b [&_thead_th]:border-hair [&_thead_th]:bg-raise-1 [&_thead_th]:px-[18px] [&_thead_th]:py-3 [&_thead_th]:text-left [&_thead_th]:text-[10.5px] [&_thead_th]:font-bold [&_thead_th]:uppercase [&_thead_th]:tracking-[0.06em] [&_thead_th]:text-muted ' +
  // tbody td
  '[&_tbody_td]:h-14 [&_tbody_td]:border-b [&_tbody_td]:border-hair-2 [&_tbody_td]:px-[18px] [&_tbody_td]:py-[14px] [&_tbody_td]:align-middle [&_tbody_td]:text-bodytext ' +
  '[&_tbody_tr:last-child_td]:border-b-0 ' +
  // row hover
  '[&_tbody_tr]:transition-colors [&_tbody_tr]:duration-dur [&_tbody_tr:hover]:bg-hover ' +
  '[&_tbody_tr:hover_td:first-child]:shadow-[inset_3px_0_0_color-mix(in_srgb,var(--blue)_55%,transparent)] ' +
  // tfoot td
  '[&_tfoot_td]:border-t [&_tfoot_td]:border-hair [&_tfoot_td]:bg-hover [&_tfoot_td]:px-[18px] [&_tfoot_td]:py-[13px] [&_tfoot_td]:font-semibold [&_tfoot_td]:text-ink ' +
  // cell content helpers (was `.tbl td .t1/.t2`, `.tbl .num/.num.neg`, `.tbl .rowact`)
  '[&_.t1]:font-semibold [&_.t1]:text-ink ' +
  '[&_.t2]:mt-px [&_.t2]:text-[12px] [&_.t2]:text-muted ' +
  '[&_.num]:whitespace-nowrap [&_.num]:text-right [&_.num]:font-display [&_.num]:font-semibold [&_.num]:tabular-nums [&_.num]:tracking-[-0.01em] [&_.num]:text-ink ' +
  '[&_.num.neg]:text-danger ' +
  '[&_.rowact]:flex [&_.rowact]:justify-end [&_.rowact]:gap-1.5 [&_.rowact]:opacity-55 [&_.rowact]:transition-opacity [&_.rowact]:duration-dur ' +
  '[&_tbody_tr:hover_.rowact]:opacity-100 [&_.rowact]:[@media(hover:none)]:opacity-100';

/* ---------- table cell content (was .tbl td .t1/.t2/.num/.rowact) ---------- */

/** Primary cell text (was `.tbl td .t1`). */
export const TD_T1 = 'font-semibold text-ink';
/** Secondary caption under a cell (was `.tbl td .t2`). */
export const TD_T2 = 'mt-px text-[12px] text-muted';
/** Right-aligned numeric cell (was `.tbl .num`). Add TD_NEG for negatives. */
export const TD_NUM =
  'whitespace-nowrap text-right font-display font-semibold tracking-[-0.01em] tabular-nums text-ink';
/** Negative-amount colour (was `.tbl .num.neg`). Append to TD_NUM. */
export const TD_NEG = 'text-danger';
/** Right-aligned row-action cluster, revealed on row hover (was `.tbl .rowact`).
    Put `group` on the `<tr>` for the hover reveal. */
export const ROWACT =
  'flex justify-end gap-1.5 opacity-55 transition-opacity duration-dur group-hover:opacity-100 [@media(hover:none)]:opacity-100';

/* ---------- layout helpers (was .stack / .grid-2 / .grid-3 / .form-grid) ---------- */

/** Vertical stack of cards (was `.stack`). */
export const STACK = 'flex flex-col gap-5';
/** 2fr/1fr split that collapses ≤1024px (was `.grid-2`). */
export const GRID_2 = 'grid grid-cols-[2fr_1fr] items-start gap-5 max-[1024px]:grid-cols-1';
/** Three even columns that collapse ≤1024px (was `.grid-3`). */
export const GRID_3 = 'grid grid-cols-3 gap-4 max-[1024px]:grid-cols-1';
/** Auto-fill form field grid (was `.form-grid`). */
export const FORM_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5';

/* ---------- notes (was .note / .note.info/.warn/.danger/.ok) ---------- */

/** Callout note base (was `.note`). Append a NOTE_TONE. */
export const NOTE =
  'flex items-start gap-2.5 rounded border border-transparent px-[15px] py-3 text-[13px] font-medium leading-[1.5]';
/** Tone fills (was `.note.info/.warn/.danger/.ok` + dark info override). */
export const NOTE_TONE: Record<'info' | 'warn' | 'danger' | 'ok', string> = {
  info: 'border-[color-mix(in_srgb,var(--blue)_18%,transparent)] bg-[color-mix(in_srgb,var(--blue)_8%,transparent)] text-blue-700 dark:text-blue',
  warn: 'border-[color-mix(in_srgb,var(--warn)_20%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] text-warn',
  danger:
    'border-[color-mix(in_srgb,var(--danger)_20%,transparent)] bg-[color-mix(in_srgb,var(--danger)_9%,transparent)] text-danger',
  ok: 'border-[color-mix(in_srgb,var(--ok)_20%,transparent)] bg-[color-mix(in_srgb,var(--ok)_10%,transparent)] text-ok',
};
/** Leading glyph inside a NOTE (was `.note .ic`). */
export const NOTE_IC = 'flex-none text-[15px] leading-[1.3]';

/* ---------- cards / panels (was .card2) ---------- */

/** Card shell (was `.card2`). */
export const CARD = 'rounded-2xl border border-hair bg-raise-1 shadow-[var(--e2),var(--top-hi)]';
/** Card header row (was `.card2 .ch`). */
export const CARD_HEAD =
  'flex items-center justify-between gap-3 border-b border-hair-2 px-5 py-4';
/** Card header title (was `.card2 .ch h3`). */
export const CARD_HEAD_H = 'text-[15px] font-semibold';
/** Card header sub-label (was `.card2 .ch .sub`). */
export const CARD_HEAD_SUB = 'text-[12px] font-medium text-muted';
/** Card body (was `.card2 .cb`). */
export const CARD_BODY = 'p-5';
/** Flush card body (was `.card2 .cb.flush`). */
export const CARD_BODY_FLUSH = 'p-0';

/* ---------- page head (was .page-head) ---------- */

/** Page header row (was `.page-head`). */
export const PAGE_HEAD = 'mb-6 flex flex-wrap items-start justify-between gap-[18px]';
/** Page title (was `.page-head h1`). */
export const PAGE_HEAD_H1 = 'text-[27px] tracking-[-0.03em] max-[560px]:text-[22px]';
/** Page description (was `.page-head p`). */
export const PAGE_HEAD_P = 'mt-2 max-w-[74ch] text-[13.5px] leading-[1.55] text-muted';
/** Header action cluster (was `.page-head .acts`). */
export const PAGE_HEAD_ACTS = 'flex flex-wrap gap-2.5';

/* ---------- content slot (was .content + its stagger) ---------- */

/** The main content region (was `.content` + `.content > *` stagger). Padding,
    max-width, ≤560px padding, and the page-load rise animation on direct
    children with nth-child delays; reduced-motion disables the animation. */
export const CONTENT =
  'w-full max-w-[1360px] px-6 py-7 max-[560px]:px-4 max-[560px]:py-[18px] ' +
  '[&>*]:animate-rise-owner [&>*]:motion-reduce:animate-none ' +
  '[&>*:nth-child(2)]:[animation-delay:0.04s] ' +
  '[&>*:nth-child(3)]:[animation-delay:0.08s] ' +
  '[&>*:nth-child(4)]:[animation-delay:0.12s] ' +
  '[&>*:nth-child(5)]:[animation-delay:0.16s]';

/* ---------- key/value + drawer bodies (was .kv / .drawer .dh/.db/.df) ---------- */

/** Two-column key/value grid (was `.kv`). Children: KV_DT / KV_DD. */
export const KV = 'grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[13.5px]';
export const KV_DT = 'font-medium text-muted';
export const KV_DD = 'm-0 text-right font-semibold text-ink';

/* ---------- loading / empty / error states (was .skel / .state) ---------- */

/** Shimmer skeleton bar (was `.skel`). */
export const SKEL =
  'block h-3.5 rounded-sm bg-[linear-gradient(90deg,var(--field)_25%,var(--hover)_37%,var(--field)_63%)] bg-[length:400%_100%] animate-shimmer-owner motion-reduce:animate-none';
/** Empty/error state container (was `.state`). */
export const STATE = 'px-6 py-11 text-center text-muted';
export const STATE_IC = 'mb-2.5 text-[26px]';
export const STATE_H4 = 'mb-1.5 text-[15px] text-ink';
export const STATE_P = 'mx-auto max-w-[46ch] text-[13px] leading-[1.55]';

/* ---------- facility checkbox grid (was .facility-grid / .facility-opt) ---------- */

/** Two-column facility checkbox grid (was `.facility-grid`). */
export const FACILITY_GRID = 'grid grid-cols-2 gap-x-3.5 gap-y-1.5';
/** One facility row — pins the checkbox to its intrinsic size so the label
    stays inline (was `.facility-opt` + its checkbox rule). */
export const FACILITY_OPT =
  'flex flex-row items-center gap-2.5 text-[13px] font-medium leading-none text-ink cursor-pointer ' +
  '[&>input[type=checkbox]]:m-0 [&>input[type=checkbox]]:h-[15px] [&>input[type=checkbox]]:w-[15px] [&>input[type=checkbox]]:min-w-[15px] [&>input[type=checkbox]]:flex-[0_0_15px] [&>input[type=checkbox]]:cursor-pointer [&>input[type=checkbox]]:appearance-auto [&>input[type=checkbox]]:align-middle [&>input[type=checkbox]]:[accent-color:var(--blue)]';

/* ---------- permission list (was .perm-*) ---------- */

/** Permission list container (was `.perm-list`). */
export const PERM_LIST = 'flex flex-col';
/** One permission row (was `.perm-row`). */
export const PERM_ROW = 'flex items-center gap-3 border-b border-hair px-0.5 py-[11px] last:border-b-0';
/** Permission name (was `.perm-row .perm-name`). */
export const PERM_NAME = 'flex-[1_1_auto] text-[13.5px] font-medium text-ink';
/** Toggle cluster (was `.perm-toggles`). */
export const PERM_TOGGLES = 'flex flex-[0_0_auto] gap-4';
/** One toggle label + its pinned checkbox (was `.perm-toggle` + checkbox rule). */
export const PERM_TOGGLE =
  'flex select-none items-center gap-[7px] text-[12px] font-medium text-muted cursor-pointer ' +
  '[&>input[type=checkbox]]:m-0 [&>input[type=checkbox]]:h-[15px] [&>input[type=checkbox]]:w-[15px] [&>input[type=checkbox]]:min-w-[15px] [&>input[type=checkbox]]:flex-[0_0_15px] [&>input[type=checkbox]]:cursor-pointer [&>input[type=checkbox]]:appearance-auto [&>input[type=checkbox]]:align-middle [&>input[type=checkbox]]:[accent-color:var(--blue)]';

/* ---------- payroll bits (was .linklike / .check) ---------- */

/** Name-as-link button (was `.linklike`). */
export const LINKLIKE =
  'cursor-pointer border-none bg-transparent p-0 text-left font-[inherit] text-[inherit] underline decoration-hair underline-offset-[3px] hover:text-blue hover:decoration-blue';
/** Adjust checkbox row (was `.check`). */
export const CHECK =
  'flex cursor-pointer items-center gap-[9px] text-[13px] text-muted [&>input]:h-4 [&>input]:w-4 [&>input]:[accent-color:var(--blue)]';

/* ---------- salary statement (was .statement-print / .stmt-*) ---------- */

/** Printable statement wrapper (was `.statement-print`). On screen it's a plain
    block; the Drawer's `print:` rules flatten the panel for printing. */
export const STATEMENT_PRINT = 'block';
/** Statement header (was `.stmt-head` + its h3). */
export const STMT_HEAD =
  'mb-[18px] flex items-start justify-between gap-4 border-b-2 border-hair pb-3.5 [&>h3]:m-0 [&>h3]:text-[18px]';
/** Right-aligned meta block (was `.stmt-meta`). */
export const STMT_META = 'text-right text-[12.5px] leading-[1.5]';
/** Total row — thick top border, bold cells (was `.stmt-total td`). */
export const STMT_TOTAL = '[&>td]:border-t-2 [&>td]:border-hair [&>td]:font-bold';

/* ---------- customer invoice (was .invoice-print / .inv-*) ----------
   Fixed hex, not theme tokens: this always prints on white paper. On screen it
   lives inside the bookings drawer but stays hidden (`hidden print:block`); the
   drawer's `print:` rules flatten the panel so only this prints. */

/** Hidden on screen, shown when printing (was `.invoice-print{display:none}` +
    its @media print reveal). */
export const INVOICE_PRINT = 'hidden print:block [print-color-adjust:exact]';
/** Header band with the single blue accent underline (was `.inv-head`). */
export const INV_HEAD =
  'flex items-center justify-between gap-4 border-b-2 border-[#1a73e8] px-2 pb-4 pt-1';
export const INV_ID = 'flex items-center gap-3';
export const INV_LOGO = 'h-11 w-11 flex-none rounded-full border border-[#e4e7ec] object-cover';
export const INV_LOGO_PH = 'grid place-items-center bg-[#f8fafc] text-[16px] font-bold text-[#475467]';
export const INV_NAME = 'text-[18px] font-extrabold tracking-[-0.01em]';
export const INV_TAG =
  'mt-px text-[11px] font-semibold uppercase tracking-[0.18em] text-[#667085]';
export const INV_BAND_META = 'text-right text-[12px] leading-[1.5] text-[#475467]';
export const INV_NO = 'text-[14px] font-bold tracking-[0.04em] text-[#111]';
export const INV_PARTIES = 'flex justify-between gap-6 px-2 pb-5 pt-[18px] [&_h5]:m-0 [&_h5]:mb-1.5 [&_h5]:text-[10.5px] [&_h5]:font-bold [&_h5]:uppercase [&_h5]:tracking-[0.1em] [&_h5]:text-[#667085] [&_strong]:block [&_strong]:text-[14px] [&>div>div]:mt-0.5 [&>div>div]:text-[#475467]';
export const INV_TRIP = 'text-right';
/** Status chip base + tones (was `.inv-status` / `--paid/--partial/--due`). */
export const INV_STATUS =
  'mb-2 inline-block rounded-full border border-current px-2.5 py-0.5 text-[11px] font-bold tracking-[0.03em]';
export const INV_STATUS_TONE: Record<'paid' | 'partial' | 'due', string> = {
  paid: 'text-[#12925a]',
  partial: 'text-[#b7791f]',
  due: 'text-[#d64242]',
};
/** Line-item table (was `.inv-items` + th/td). */
export const INV_ITEMS =
  'mt-0.5 w-full border-collapse ' +
  '[&_th]:border-y [&_th]:border-[#e4e7ec] [&_th]:px-2 [&_th]:py-[9px] [&_th]:text-left [&_th]:text-[10.5px] [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-[#667085] ' +
  '[&_td]:border-b [&_td]:border-[#eef1f4] [&_td]:px-2 [&_td]:py-3 [&_td]:align-top ' +
  '[&_.inv-c]:text-center [&_th.num]:text-right [&_td.num]:text-right';
export const INV_C = 'inv-c';
export const INV_SUB = 'mt-[3px] text-[11px] text-[#667085]';
/** Totals box (was `.inv-totals` + rows/grand/due/neg). */
export const INV_TOTALS =
  'ml-auto mr-2 mt-[18px] max-w-[300px] overflow-hidden rounded-lg border border-[#e4e7ec]';
export const INV_ROW = 'flex justify-between gap-4 px-3.5 py-[9px] text-[13px] [&>span:first-child]:text-[#475467]';
export const INV_NEG = '[&>span:last-child]:text-[#d64242]';
export const INV_GRAND = 'border-t border-[#e4e7ec] text-[15px] font-extrabold [&>span:first-child]:!text-[#111]';
export const INV_DUE = 'border-t border-[#e4e7ec] font-extrabold text-[#1a73e8] [&>span:first-child]:!text-[#1a73e8]';
export const INV_EMPTY =
  'mx-2 my-[18px] rounded-lg border border-dashed border-[#d0d5dd] p-4 text-center text-[13px] text-[#667085]';
export const INV_FOOT =
  'mx-2 mt-6 flex items-center justify-between gap-3 border-t border-[#eef1f4] pt-3.5 text-[11.5px] text-[#667085]';
export const INV_PLAT = 'whitespace-nowrap font-semibold tracking-[0.04em]';

/* ---------- media gallery (was .media-*) ---------- */

/** Thumbnail grid (was `.media-grid`). */
export const MEDIA_GRID =
  'grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2.5';
/** Square media tile (was `.media-tile`). */
export const MEDIA_TILE =
  'relative aspect-square overflow-hidden rounded-xl border border-hair bg-field shadow-e1 [&_img]:h-full [&_img]:w-full [&_img]:object-cover [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:border-0';
/** Video tile dims its thumbnail (was `.media-tile-video img`). Append to MEDIA_TILE. */
export const MEDIA_TILE_VIDEO = '[&_img]:opacity-85';
/** Corner delete button (was `.media-del`). */
export const MEDIA_DEL =
  'absolute right-1.5 top-1.5 inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border-none bg-[color-mix(in_srgb,#000_55%,transparent)] text-[11px] leading-none text-white transition-[background] duration-dur ease-ease hover:bg-danger';
/** Link-out anchor filling a tile (was `.media-linkout`). */
export const MEDIA_LINKOUT = 'relative block h-full w-full no-underline';
/** Link-out caption band (was `.media-linkout-label`). */
export const MEDIA_LINKOUT_LABEL =
  'absolute inset-x-0 bottom-0 bg-[color-mix(in_srgb,#000_60%,transparent)] px-2 py-1.5 text-center text-[11px] font-bold text-white';
/** Fallback ▶ glyph for un-embeddable providers (was `.media-video-fallback`). */
export const MEDIA_VIDEO_FALLBACK = 'grid h-full w-full place-items-center text-[26px] text-muted';
/** Provider badge (was `.media-badge`). */
export const MEDIA_BADGE =
  'absolute bottom-1.5 left-1.5 rounded-full bg-[color-mix(in_srgb,#000_55%,transparent)] px-1.5 py-0.5 text-[10px] font-bold text-white';
/** Action row under the grid (was `.media-actions`). */
export const MEDIA_ACTIONS = 'flex items-center gap-2.5';
/** Video-add row (was `.media-video-add`). Its input flexes to fill. */
export const MEDIA_VIDEO_ADD = 'flex items-center gap-2 [&_input]:flex-1';

/* ---------- status pills (was .pill / .pill.blue/.ok/.warn/…) ---------- */

/** Pill base (was `.pill`). Append a PILL_TONE. The leading dot is a
    `before:` pseudo reproducing `.pill::before`. */
export const PILL =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-transparent px-2.5 py-[3px] text-[11.5px] font-semibold leading-[1.5] before:h-1.5 before:w-1.5 before:flex-none before:rounded-full before:bg-current before:content-['']";
export const PILL_TONE: Record<
  'blue' | 'ok' | 'warn' | 'danger' | 'amb' | 'mut',
  string
> = {
  blue: 'border-[color-mix(in_srgb,var(--blue)_20%,transparent)] bg-[color-mix(in_srgb,var(--blue)_12%,transparent)] text-blue-600',
  ok: 'border-[color-mix(in_srgb,var(--ok)_22%,transparent)] bg-[color-mix(in_srgb,var(--ok)_13%,transparent)] text-ok',
  warn: 'border-[color-mix(in_srgb,var(--warn)_24%,transparent)] bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] text-warn',
  danger:
    'border-[color-mix(in_srgb,var(--danger)_22%,transparent)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-danger',
  amb: 'border-[color-mix(in_srgb,var(--amber)_26%,transparent)] bg-[color-mix(in_srgb,var(--amber)_16%,transparent)] text-amber-700 dark:text-amber',
  mut: 'border-hair bg-chip text-muted',
};
