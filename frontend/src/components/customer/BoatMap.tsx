'use client';

/**
 * Houseboat deck plan (design: haorboat-boat.html `.boatmap` / `.hull`,
 * CSS 197–233, render 851–866). Its own card below the price panel, not part
 * of it.
 *
 * The hull is pure CSS: an asymmetric border-radius gives the pointed bow, a
 * `::before` triangle is the mast and `::after` is the wake at the waterline.
 * Cabins are laid out two-per-row per deck, each a lit window.
 *
 * Clicking a slot opens that cabin's selection popup on the boat page (the map
 * is the primary cabin picker; there is no inline card list). Blocked cabins
 * (sold / held) are still clickable — the popup shows their status + waitlist.
 */
export interface BoatMapCabin {
  id: string;
  name: string;
  deck: string;
  capacity: number;
  /**
   * Why this cabin cannot be picked, so the tile can say which:
   *   'sold' — a confirmed booking, permanent (red).
   *   'held' — another guest's hold, expires in ~10 min (amber).
   *   null   — pickable.
   * Both block the tile; only the colour and caption differ.
   */
  unavailable: 'sold' | 'held' | null;
  guests: number;
}

export function BoatMap({
  cabins,
  onFocusCabin,
}: {
  cabins: BoatMapCabin[];
  onFocusCabin: (cabinId: string) => void;
}) {
  // Preserve deck order as given (the API already sorts decks by position).
  const decks: string[] = [];
  cabins.forEach((c) => {
    if (!decks.includes(c.deck)) decks.push(c.deck);
  });

  return (
    <div className="mt-5 rounded-2xl border border-hair bg-raise-1 p-5 shadow-e1 max-[940px]:p-2.5">
      <h3 className="font-display text-[15px] font-semibold text-ink">
        🗺️ Boat layout
      </h3>
      <p className="mb-4 mt-1 text-xs text-muted">
        Tap a cabin to choose guests and add it to your booking.
      </p>

      <div className="relative isolate rounded-[120px_120px_22px_22px/72px_72px_22px_22px] border-[2.5px] border-[var(--blue-100)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--blue)_8%,var(--raise-1)),var(--raise-1)_30%)] px-[18px] pb-[26px] pt-11 max-[940px]:px-2.5 shadow-[inset_0_2px_0_rgba(255,255,255,.5),0_10px_30px_-12px_var(--blue)] before:absolute before:-top-[22px] before:left-1/2 before:-translate-x-1/2 before:border-x-[11px] before:border-b-[22px] before:border-x-transparent before:border-b-[var(--blue-100)] before:content-[''] after:absolute after:-bottom-[9px] after:-left-0.5 after:-right-0.5 after:-z-10 after:h-3.5 after:rounded-b-[40%] after:bg-[linear-gradient(180deg,var(--blue-100),transparent)] after:opacity-70 after:content-[''] dark:shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_10px_30px_-12px_#000]">
        <span className="absolute left-1/2 top-2 z-[2] flex -translate-x-1/2 items-center gap-[5px] text-[11px] font-extrabold tracking-[.05em] text-blue">
          ⚑ Bow
        </span>

        {decks.map((deck, di) => (
          <div key={deck}>
            <div
              className={`flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.08em] text-blue after:h-px after:flex-1 after:bg-hair after:content-[''] ${
                di === 0 ? 'mb-2 mt-1' : 'mb-2 mt-4'
              }`}
            >
              {deck}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {cabins
                .filter((c) => c.deck === deck)
                .map((c) => {
                  const blocked = c.unavailable !== null;
                  const held = c.unavailable === 'held';
                  const selected = c.guests > 0 && !blocked;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onFocusCabin(c.id)}
                      className={`relative flex min-h-[56px] flex-col justify-center gap-[3px] rounded-lg border-2 px-1.5 py-[11px] text-center transition-all duration-150 ${
                        held
                          ? 'border-dashed border-[color-mix(in_srgb,var(--amber)_45%,transparent)] bg-[color-mix(in_srgb,var(--amber)_12%,transparent)] shadow-none'
                          : blocked
                            ? 'border-dashed border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--danger)_9%,transparent)] shadow-none'
                            : selected
                              ? 'border-blue bg-[var(--blue-050)] shadow-[inset_0_0_0_3px_var(--raise-1),0_6px_16px_-6px_var(--blue)]'
                              : 'border-hair bg-bg shadow-[inset_0_0_0_3px_var(--raise-1)] hover:-translate-y-0.5 hover:border-[var(--blue-100)]'
                      }`}
                    >
                      {selected ? (
                        <span
                          aria-hidden="true"
                          className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-blue text-[11px] font-black text-white shadow-e1"
                        >
                          ✓
                        </span>
                      ) : null}
                      <span
                        className={`text-[11.5px] font-extrabold ${
                          held
                            ? 'text-[var(--amber-700)] dark:text-amber'
                            : blocked
                              ? 'text-danger'
                              : selected
                                ? 'text-blue'
                                : 'text-ink'
                        }`}
                      >
                        {c.name.replace(/ Cabin| AC/g, '').trim()}
                      </span>
                      <span className="text-[9.5px] font-semibold text-muted">
                        {held
                          ? 'on hold'
                          : blocked
                            ? 'booked'
                            : c.guests > 0
                              ? `${c.guests} guest${c.guests > 1 ? 's' : ''}`
                              : `up to ${c.capacity}`}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3.5 flex flex-wrap gap-3.5 text-[11.5px] font-semibold text-muted">
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-[13px] w-[13px] rounded-[3px] border-2 border-hair" />{' '}
          Available
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-[13px] w-[13px] rounded-[3px] border-2 border-blue bg-[var(--blue-050)]" />{' '}
          Selected
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-[13px] w-[13px] rounded-[3px] border-2 border-dashed border-[var(--amber)] bg-[color-mix(in_srgb,var(--amber)_14%,transparent)]" />{' '}
          On hold
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-[13px] w-[13px] rounded-[3px] border-2 border-dashed border-danger bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]" />{' '}
          Fully booked
        </span>
      </div>
    </div>
  );
}
