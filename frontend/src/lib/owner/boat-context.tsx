'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { OwnerBoat } from './session';

const STORAGE_KEY = 'hb_owner_boat';

interface BoatContextValue {
  boats: OwnerBoat[];
  boat: OwnerBoat;
  /** Convenience: the id every owner API path is scoped by. */
  boatId: string;
  setBoatId: (id: string) => void;
  /** May the active member see this page? Drives the sidebar + page guard. */
  canView: (page: string) => boolean;
  /** May the active member edit this page? */
  canEdit: (page: string) => boolean;
}

const BoatContext = createContext<BoatContextValue | null>(null);

/**
 * Active-boat state for the whole console.
 *
 * The boat id is NOT in the URL. Every owner endpoint is already scoped by
 * :houseboatId, so keeping the choice in context + localStorage means switching
 * boats re-keys the SWR calls without rewriting 33 routes — and a link shared
 * between two owners still opens on the recipient's own boat rather than
 * 403-ing on someone else's.
 *
 * `boats` comes from the server layout, which resolved it from /me/boats, so
 * there is always at least one and the provider never renders an empty state.
 */
export function OwnerBoatProvider({
  boats,
  children,
}: {
  boats: OwnerBoat[];
  children: React.ReactNode;
}) {
  // Prefer a live boat that already has a weekly schedule for the initial
  // render: a draft or freshly-added boat has no schedule, bookings or money, so
  // landing there by accident looks like an empty (broken) console. Fall back to
  // any live boat, then the first boat.
  const fallback = useMemo(
    () =>
      boats.find((b) => b.status === 'live' && b.hasSchedule) ??
      boats.find((b) => b.status === 'live') ??
      boats[0],
    [boats],
  );

  // Start from the server-safe fallback and adopt the stored choice after
  // mount — reading localStorage during render would break hydration.
  const [boatId, setBoatIdState] = useState(fallback.houseboatId);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage can be unavailable (private mode, blocked cookies). Not fatal.
    }
    // Ignore a stored id the account no longer has access to — a boat can be
    // handed over or exited between sessions.
    if (stored && boats.some((b) => b.houseboatId === stored)) {
      setBoatIdState(stored);
    }
  }, [boats]);

  const setBoatId = useCallback(
    (id: string) => {
      if (!boats.some((b) => b.houseboatId === id)) return;
      setBoatIdState(id);
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {
        // Persistence is a convenience; the session still works without it.
      }
    },
    [boats],
  );

  const value = useMemo<BoatContextValue>(() => {
    const boat = boats.find((b) => b.houseboatId === boatId) ?? fallback;
    const perms = boat.permissions;

    // Default-open when the map is absent (older /me/boats payload) so a rollout
    // skew never locks a legitimate owner out. Dashboard is always visible — it
    // is the console landing and must stay reachable for any member.
    const canView = (page: string) => {
      if (page === 'dashboard') return true;
      if (!perms) return true;
      return Boolean(perms[page]?.view);
    };
    const canEdit = (page: string) => {
      if (!perms) return true;
      return Boolean(perms[page]?.edit);
    };

    return { boats, boat, boatId: boat.houseboatId, setBoatId, canView, canEdit };
  }, [boats, boatId, fallback, setBoatId]);

  return <BoatContext.Provider value={value}>{children}</BoatContext.Provider>;
}

/** The active boat. Throws outside the provider — that's a wiring bug. */
export function useActiveBoat(): BoatContextValue {
  const ctx = useContext(BoatContext);
  if (!ctx) {
    throw new Error('useActiveBoat must be used inside OwnerBoatProvider');
  }
  return ctx;
}

/**
 * Build an API path scoped to the active boat.
 *
 *   const path = useBoatPath('/bookings');  // /houseboats/<id>/bookings
 */
export function useBoatPath(suffix: string): string {
  const { boatId } = useActiveBoat();
  return `/houseboats/${boatId}${suffix}`;
}
