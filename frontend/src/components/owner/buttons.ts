/* ────────────────────────────────────────────────────────────
   Owner console button class strings (Tailwind).

   A 1:1 translation of the `.btn` / `.btn-b` / `.btn-o` / `.btn-ok` /
   `.btn-danger` / `.btn-sm` rules that used to live in owner.css. Kept as
   shared consts (not a component) so pages keep their existing markup —
   `<Link className={BTN_O}>` — and every page converts to the same source.

   Compose a base with a variant: `` `${BTN} ${BTN_B}` ``, or use the
   pre-composed exports. `disabled:` states match `.btn[disabled]`.
   ──────────────────────────────────────────────────────────── */

/** Base shape shared by every button (was `.btn`). */
export const BTN =
  'inline-flex items-center gap-[7px] whitespace-nowrap rounded border border-transparent px-4 py-[9px] text-[13.5px] font-semibold leading-none transition-[background,border-color,box-shadow,transform] duration-dur ease-ease active:translate-y-[0.5px] disabled:cursor-not-allowed disabled:opacity-45 disabled:grayscale-[0.3] disabled:shadow-none';

/** Small size (was `.btn-sm`). Append to a base+variant. */
export const BTN_SM = 'px-[11px] py-1.5 text-[12.5px]';

/** Primary blue (was `.btn.btn-b`). */
export const BTN_B = `${BTN} bg-blue text-white shadow-[var(--e1),inset_0_1px_0_rgba(255,255,255,0.18)] hover:bg-blue-600`;

/** Outline / secondary (was `.btn.btn-o`). */
export const BTN_O = `${BTN} bg-raise-1 border-hair text-ink shadow-e1 hover:border-[color-mix(in_srgb,var(--blue)_45%,var(--hair))] hover:text-blue hover:bg-[color-mix(in_srgb,var(--blue)_6%,var(--raise-1))]`;

/** Positive / confirm (was `.btn.btn-ok`). */
export const BTN_OK = `${BTN} bg-ok text-white shadow-e1 hover:brightness-[1.06]`;

/** Destructive (was `.btn.btn-danger`). */
export const BTN_DANGER = `${BTN} border-[color-mix(in_srgb,var(--danger)_22%,transparent)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-danger hover:border-transparent hover:bg-danger hover:text-white`;
