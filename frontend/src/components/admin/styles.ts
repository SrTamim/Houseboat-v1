/* ────────────────────────────────────────────────────────────
   Admin console shared Tailwind class strings.

   A 1:1 translation of the reusable design-system classes that used to
   live in app/admin/admin.css (`.btn*`, `.icon-btn`, `.field`, `.select`,
   `.search`, `.pill*`, the `.kpi .n .u` unit span, `.tag`). Kept as shared
   consts (not components) so markup stays flat — `<Link className={BTN_O}>` —
   and every page converts to the same single source of truth.

   Colours/radii/shadows resolve through the CSS vars in globals.css
   (`:root` + `:root[data-theme="dark"]`), so token utilities like
   `bg-raise-1` / `text-ink` / `shadow-e2` theme-switch on `[data-theme]`
   with no per-utility `dark:`.
   ──────────────────────────────────────────────────────────── */

/* ---------- buttons (was .btn / .btn-*) ---------- */

/** Base shape shared by every button (was `.btn`). */
export const BTN =
  'inline-flex items-center gap-[7px] whitespace-nowrap rounded border border-transparent px-4 py-[9px] text-[13.5px] font-semibold leading-none transition-[background,border-color,box-shadow,transform] duration-dur ease-ease active:translate-y-[0.5px] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:grayscale-[0.3]';

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

/* ---------- form fields (was .field / .select / .search input) ---------- */

/** Wrapper carrying a floating label (was `.field`). */
export const FIELD =
  'relative rounded border border-hair bg-field px-[14px] py-[9px] transition-[border-color,box-shadow] duration-dur ease-ease focus-within:border-blue focus-within:shadow-ring';

/** Uppercase caption inside a FIELD (was `.field label`). */
export const FIELD_LABEL =
  'mb-[3px] block text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted';

/** Bare input/select inside a FIELD (was `.field input,.field select`). */
export const FIELD_INPUT =
  'w-full border-none bg-transparent p-0 text-[15px] font-semibold text-ink focus:outline-none';

/** Standalone select control (was `.select`). */
export const SELECT =
  'h-10 cursor-pointer rounded border border-hair bg-field px-3 text-[13.5px] font-medium text-ink focus:border-blue focus:shadow-ring focus:outline-none';

/** Standalone search input (was `.search input`). Pair inside a SEARCH_WRAP. */
export const SEARCH_INPUT =
  'h-10 w-full rounded border border-hair bg-field pl-[38px] pr-[14px] text-[14px] text-ink placeholder:text-muted focus:border-blue focus:shadow-ring focus:outline-none';

/* ---------- misc reused bits ---------- */

/** Currency symbol span inside a figure (was `.kpi .n .u`). */
export const UNIT = 'mr-px text-[17px] font-semibold text-muted';

/** Neutral chip/tag (was `.tag`). */
export const TAG =
  'inline-block rounded-sm border border-hair bg-chip px-[9px] py-[3px] text-[11px] font-semibold text-bodytext';

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

/* ---------- money / muted inline text ---------- */

/** Display-font monetary figure (was `.money`). Add MONEY_NEG for negatives. */
export const MONEY = 'font-display font-semibold tabular-nums text-ink';
/** Negative money colour (was `.money.neg`). Append to MONEY. */
export const MONEY_NEG = 'text-danger';
/** Tertiary/caption text (was `.muted`). */
export const MUTED = 'text-muted';

/* ---------- filter bar + segmented control (was .filterbar / .seg / .seg-b) ---------- */

/** Row of filters above a table (was `.filterbar`). */
export const FILTERBAR = 'mb-[18px] flex flex-wrap items-center gap-3';
/** Segmented-control track (was `.seg`). */
export const SEG = 'inline-flex rounded border border-hair bg-field p-[3px]';
/** One segment button, base (was `.seg-b`). Add SEG_B_ON when active. */
export const SEG_B =
  'rounded-[7px] border-none bg-transparent px-[13px] py-[7px] text-[12.5px] font-semibold text-bodytext transition-all duration-dur ease-ease hover:text-blue';
/** Active segment (was `.seg-b.on`). Append to SEG_B. */
export const SEG_B_ON = 'bg-raise-1 text-blue shadow-e1';

/* ---------- key/value + breakdown rows (drawer bodies) ---------- */

/** Two-column key/value grid (was `.kv`). Children: KV_DT / KV_DD. */
export const KV = 'grid grid-cols-[auto_1fr] gap-x-4 gap-y-[10px] text-[13.5px]';
export const KV_DT = 'font-medium text-muted';
export const KV_DD = 'm-0 text-right font-semibold text-ink';

/* ---------- drawer sections (was .dsec / .prose / .mini) ---------- */

/** Drawer body section (was `.dsec`). First section drops its top margin. */
export const DSEC = 'mt-[22px] first:mt-0';
/** Section caption (was `.dsec > h4`). */
export const DSEC_H4 =
  'mb-2.5 border-b border-hair-2 pb-[7px] text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted';
/** Paragraph copy inside a drawer (was `.prose`). */
export const PROSE = 'm-0 text-[13px] leading-[1.6] text-bodytext';

/** Nested mini-table (was `.mini`). Cells opt into MINI_TH / MINI_TD / MINI_TD_T1. */
export const MINI = 'w-full border-separate border-spacing-0 text-[12.5px]';
export const MINI_TH =
  'px-2 py-[5px] text-left text-[10px] font-bold uppercase tracking-[0.05em] text-muted';
export const MINI_TD = 'border-t border-hair-2 px-2 py-[7px] text-bodytext';
/** Emphasised mini-table cell (was `.mini td.t1`). Append to MINI_TD. */
export const MINI_TD_T1 = 'font-semibold text-ink';

/* ---------- layout helpers (was .stack / .grid-2 / .form-grid) ---------- */

/** Vertical stack of cards (was `.stack`). */
export const STACK = 'flex flex-col gap-5';
/** 2fr/1fr split that collapses ≤1024px (was `.grid-2`). */
export const GRID_2 = 'grid grid-cols-[2fr_1fr] items-start gap-5 max-[1024px]:grid-cols-1';
/** Auto-fill form field grid (was `.form-grid`). */
export const FORM_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5';

/* ---------- invoice breakdown rows (was .bd) ---------- */

/** Money breakdown grid (was `.bd`). Rows use BD_LBL / BD_VAL; BD_RULE = divider. */
export const BD = 'grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-[9px] text-[13.5px]';
export const BD_LBL = 'font-medium text-muted';
export const BD_VAL = 'text-right font-display font-semibold tabular-nums text-ink';
export const BD_RULE = 'col-span-2 my-[3px] h-px bg-hair-2';
