'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChildPolicyBand, Departure, FoodMenu } from '@/lib/customer/types';

/**
 * Tabbed cabin / boat info dialog (design: haorboat-boat.html `.modal#infoModal`,
 * CSS 237–261, behaviour 1012–1035). Opened from a cabin's tab strip or from
 * "View full boat info →", landing on whichever tab was clicked.
 *
 * The preview hard-coded its inclusions, itinerary and policy copy. Here the
 * four panes are driven by real data — `foodMenu`, `childPolicy`, the boat's
 * safety text and the selected departure's package — and any pane whose data is
 * missing says so rather than inventing an itinerary.
 */
export type InfoTab = 'info' | 'incl' | 'itin' | 'pol';

const TABS: { id: InfoTab; label: string }[] = [
  { id: 'info', label: '⚓ Boat info' },
  { id: 'incl', label: '✔️ Inclusions' },
  { id: 'itin', label: '🗺️ Itinerary' },
  { id: 'pol', label: '🛡️ Policies' },
];

export interface CabinInfo {
  name: string;
  deck: string;
  isAc: boolean;
  capacity: number;
  facilities: string | null;
}

export function CabinInfoModal({
  cabin,
  boatName,
  safetyFeatures,
  cancellationPolicy,
  foodMenu,
  childPolicy,
  departure,
  initialTab,
  onClose,
}: {
  cabin: CabinInfo | null;
  boatName: string;
  safetyFeatures: string | null;
  cancellationPolicy: string | null;
  foodMenu: FoodMenu | null;
  childPolicy: ChildPolicyBand[] | null;
  departure: Departure | null;
  initialTab: InfoTab;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<InfoTab>(initialTab);
  const boxRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => setTab(initialTab), [initialTab]);

  useEffect(() => {
    restoreTo.current = document.activeElement as HTMLElement | null;
    boxRef.current?.focus();
    return () => restoreTo.current?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && boxRef.current) {
        const items = boxRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const meals = foodMenu
    ? (
        [
          ['Breakfast', foodMenu.breakfast],
          ['Brunch', foodMenu.brunch],
          ['Lunch', foodMenu.lunch],
          ['Snacks', foodMenu.snacks],
          ['Dinner', foodMenu.dinner],
        ] as const
      ).filter(([, v]) => v && v.trim())
    : [];

  const pkg = departure?.package;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-5">
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[rgba(10,20,40,.6)] backdrop-blur-[2px]"
      />
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-label={cabin ? cabin.name : boatName}
        tabIndex={-1}
        className="relative flex max-h-[88vh] w-[min(680px,100%)] flex-col overflow-hidden rounded-2xl bg-raise-1 shadow-e3 outline-none"
      >
        <div className="flex items-center gap-2.5 bg-[linear-gradient(120deg,var(--blue-700),var(--blue))] px-5 py-4 text-white">
          <span aria-hidden="true">⛵</span>
          <h3 className="flex-1 font-display text-[17px] font-semibold text-white">
            {cabin ? cabin.name : boatName}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-[34px] w-[34px] place-items-center rounded-full border-none bg-white/20 text-base text-white transition-colors hover:bg-white/[.32]"
          >
            ✕
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Boat information"
          className="flex gap-0.5 overflow-x-auto border-b border-hair bg-raise-1 px-3.5"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap border-b-[2.5px] px-3.5 py-3.5 text-[13.5px] font-bold transition-colors ${
                tab === t.id
                  ? 'border-b-blue text-blue'
                  : 'border-b-transparent text-muted hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto px-[22px] py-5">
          {tab === 'info' ? (
            <div>
              <h4 className="mb-2 font-display text-sm font-semibold text-ink">
                {cabin ? cabin.name : boatName}
              </h4>
              {cabin ? (
                <>
                  <Row label="Deck" value={cabin.deck} />
                  <Row label="Capacity" value={`Up to ${cabin.capacity} guests`} />
                  <Row
                    label="AC"
                    value={cabin.isAc ? 'Yes — air-conditioned' : 'No — ceiling fan'}
                  />
                  {cabin.facilities?.trim() ? (
                    <Row label="Facilities" value={cabin.facilities} />
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-bodytext">
                  Pick a cabin to see its deck, capacity and facilities.
                </p>
              )}
              {safetyFeatures?.trim() ? (
                <>
                  <h4 className="mb-2 mt-4 font-display text-sm font-semibold text-ink">
                    Safety
                  </h4>
                  <p className="text-sm text-bodytext">{safetyFeatures}</p>
                </>
              ) : null}
            </div>
          ) : null}

          {tab === 'incl' ? (
            <div>
              <h4 className="mb-2 font-display text-sm font-semibold text-ink">
                Meals on board
              </h4>
              {meals.length > 0 ? (
                meals.map(([label, text]) => (
                  <Row key={label} label={label} value={text as string} />
                ))
              ) : (
                <p className="text-sm text-bodytext">
                  The host hasn’t published a meal plan for this boat yet.
                </p>
              )}
            </div>
          ) : null}

          {tab === 'itin' ? (
            <div>
              {pkg ? (
                <div className="grid">
                  <Step
                    time="Board"
                    text={`${pkg.departureGhat ?? 'Boarding ghat announced before departure'}${
                      departure?.departureTime ? ` · ${departure.departureTime}` : ''
                    }`}
                  />
                  <Step
                    time="Cruise"
                    text={`${pkg.route?.name ?? 'Haor route'}${
                      pkg.durationLabel ? ` · ${pkg.durationLabel}` : ''
                    }`}
                  />
                  <Step
                    time="Return"
                    text={`${pkg.returnGhat ?? 'Return to the boarding ghat'}${
                      departure?.arrivalTime ? ` · ${departure.arrivalTime}` : ''
                    }`}
                  />
                </div>
              ) : (
                <p className="text-sm text-bodytext">
                  Select a departure date to see its itinerary.
                </p>
              )}
            </div>
          ) : null}

          {tab === 'pol' ? (
            <div>
              <h4 className="mb-2 font-display text-sm font-semibold text-ink">
                Children
              </h4>
              {childPolicy && childPolicy.length > 0 ? (
                childPolicy.map((b) => (
                  <Row
                    key={`${b.min}-${b.max}`}
                    label={`Age ${b.min}–${b.max}`}
                    value={
                      b.chargePct === 0
                        ? 'Free'
                        : b.chargePct === 100
                          ? 'Full fare'
                          : `${b.chargePct}% of adult fare`
                    }
                  />
                ))
              ) : (
                <p className="text-sm text-bodytext">
                  Standard fares apply to all guests.
                </p>
              )}
              <h4 className="mb-2 mt-4 font-display text-sm font-semibold text-ink">
                Cancellation
              </h4>
              <p className="whitespace-pre-line text-sm text-bodytext">
                {cancellationPolicy?.trim()
                  ? cancellationPolicy
                  : 'Cancellation terms and any refund are shown before you pay, and again on your booking.'}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2.5 border-b border-hair py-2 text-sm last:border-b-0">
      <b className="min-w-[120px] text-ink">{label}</b>
      <span className="text-bodytext">{value}</span>
    </div>
  );
}

function Step({ time, text }: { time: string; text: string }) {
  return (
    <div className="flex gap-3.5 border-b border-hair py-3 last:border-b-0">
      <span className="min-w-[66px] font-display text-[13px] font-extrabold text-blue">
        {time}
      </span>
      <span className="text-sm text-bodytext">{text}</span>
    </div>
  );
}
