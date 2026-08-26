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
/**
 * Right-aligned numeric column HEADER. The base table CSS forces
 * `thead th { text-align: left }` via a descendant-variant selector, which
 * out-specifies a plain `text-right` utility — so numeric headers drift left of
 * their right-aligned numbers. This `!text-right` overrides that so a numeric
 * header sits directly above its column. Use on `<th>` for any TD_NUM column.
 */
export const TH_NUM = '!text-right';
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

/* ---------- payout receipt (printable, modern invoice design) ----------
   Ported from the owner booking invoice (`INV_*` in owner/styles.ts): fixed
   hex, not theme tokens, because the receipt always prints on white paper. On
   screen it lives inside the pay-to-vendors drawer; the `.admin-print-root`
   @media print rule in globals.css reveals only this subtree. Add
   `[print-color-adjust:exact]` to the root so the blue accent prints. */

/** Header band with the single blue accent underline (was `.inv-head`). */
export const PINV_HEAD =
  'flex items-center justify-between gap-4 border-b-2 border-[#1a73e8] px-2 pb-4 pt-1';
export const PINV_ID = 'flex items-center gap-3';
/** Platform ⚓ mark in a solid blue tile (paper-safe, prints in colour). */
export const PINV_LOGO =
  'grid h-11 w-11 flex-none place-items-center rounded-[11px] bg-[#1a73e8] text-[18px] text-white';
/** HaorBoat wordmark (blue "Boat"). */
export const PINV_NAME = 'text-[18px] font-extrabold tracking-[-0.02em] text-[#111]';
export const PINV_NAME_ACCENT = 'text-[#1a73e8]';
/** Platform contact line under the wordmark. */
export const PINV_CONTACT = 'mt-0.5 text-[10.5px] leading-[1.5] text-[#667085]';
export const PINV_TAG =
  'mt-px text-[11px] font-semibold uppercase tracking-[0.18em] text-[#667085]';
/** Short-id mono caption under a party name (vendor/account id). */
export const PINV_ID_CAPTION =
  'mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.04em] text-[#98a2b3]';
export const PINV_BAND_META = 'text-right text-[12px] leading-[1.5] text-[#475467]';
export const PINV_NO = 'text-[14px] font-bold tracking-[0.04em] text-[#111]';
/** Parties row: "Paid to" vendor + bank on the left, status/meta on the right. */
export const PINV_PARTIES =
  'flex justify-between gap-6 px-2 pb-5 pt-[18px] [&_h5]:m-0 [&_h5]:mb-1.5 [&_h5]:text-[10.5px] [&_h5]:font-bold [&_h5]:uppercase [&_h5]:tracking-[0.1em] [&_h5]:text-[#667085] [&_strong]:block [&_strong]:text-[14px] [&_strong]:text-[#111] [&>div>div]:mt-0.5 [&>div>div]:text-[#475467]';
export const PINV_META = 'text-right';
/** Status chip base + tones (from batch status). */
export const PINV_STATUS =
  'mb-2 inline-block rounded-full border border-current px-2.5 py-0.5 text-[11px] font-bold tracking-[0.03em]';
export const PINV_STATUS_TONE: Record<'paid' | 'pending', string> = {
  paid: 'text-[#12925a]',
  pending: 'text-[#b7791f]',
};
/** Line-item table (was `.inv-items` + th/td). */
export const PINV_ITEMS =
  'mt-0.5 w-full border-collapse ' +
  '[&_th]:border-y [&_th]:border-[#e4e7ec] [&_th]:px-2 [&_th]:py-[9px] [&_th]:text-left [&_th]:text-[10.5px] [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-[#667085] ' +
  '[&_td]:border-b [&_td]:border-[#eef1f4] [&_td]:px-2 [&_td]:py-3 [&_td]:align-top [&_td]:text-[#111] ' +
  '[&_th.num]:text-right [&_td.num]:text-right';
export const PINV_SUB = 'mt-[3px] text-[11px] text-[#667085]';
/** Totals box (was `.inv-totals` + rows/grand). */
export const PINV_TOTALS =
  'ml-auto mr-2 mt-[18px] max-w-[300px] overflow-hidden rounded-lg border border-[#e4e7ec]';
export const PINV_ROW =
  'flex justify-between gap-4 px-3.5 py-[9px] text-[13px] [&>span:first-child]:text-[#475467] [&>span:last-child]:text-[#111]';
export const PINV_GRAND =
  'border-t border-[#e4e7ec] text-[15px] font-extrabold text-[#1a73e8] [&>span:first-child]:!text-[#1a73e8] [&>span:last-child]:!text-[#1a73e8]';
export const PINV_FOOT =
  'mx-2 mt-6 flex items-center justify-between gap-3 border-t border-[#eef1f4] pt-3.5 text-[11.5px] text-[#667085]';
export const PINV_PLAT = 'whitespace-nowrap font-semibold tracking-[0.04em]';

/* ---------- invoice breakdown rows (was .bd) ---------- */

/** Money breakdown grid (was `.bd`). Rows use BD_LBL / BD_VAL; BD_RULE = divider. */
export const BD = 'grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-[9px] text-[13.5px]';
export const BD_LBL = 'font-medium text-muted';
export const BD_VAL = 'text-right font-display font-semibold tabular-nums text-ink';
export const BD_RULE = 'col-span-2 my-[3px] h-px bg-hair-2';
