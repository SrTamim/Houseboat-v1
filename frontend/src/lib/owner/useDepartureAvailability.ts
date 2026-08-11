'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

/**
 * Live cabin availability for one departure, over the backend's `/rt` socket
 * gateway (see backend availability.gateway.ts). Joins the departure room and
 * folds the `cabin` (held / released / converted) events into a set of cabin
 * ids that are currently unavailable, so the counter grid reflects a hold taken
 * by another operator within ~1s — no polling.
 *
 * Countdown timing does NOT come from here; it comes from the server-issued
 * expires_at returned when a hold is taken. This hook only answers "is this
 * cabin free right now?".
 *
 * Connection origin:
 *  - dev: NEXT_PUBLIC_WS_URL, else http://localhost:4000 (the Nest backend).
 *    Dev CSP allows ws: + http://localhost:*.
 *  - prod: NEXT_PUBLIC_WS_URL, else same-origin (''), which requires the deploy
 *    to proxy /socket.io to the backend so CSP connect-src 'self' holds.
 */
function wsOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_WS_URL;
  if (explicit) return explicit;
  return process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
}

export interface DepartureAvailability {
  /** Cabin ids currently held by anyone (this operator included). */
  held: Set<string>;
  /** True once the socket has connected at least once. */
  connected: boolean;
}

export function useDepartureAvailability(
  departureId: string | null | undefined,
  /**
   * Called when a cabin is CONVERTED (a hold became a confirmed booking),
   * possibly by another operator. Lets the caller revalidate its bookings list
   * so the just-sold cabin stops showing as free before the next manual refetch.
   */
  onConverted?: () => void,
): DepartureAvailability {
  const [held, setHeld] = useState<Set<string>>(new Set());
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  // Keep the latest callback without re-subscribing the socket on every render.
  const onConvertedRef = useRef(onConverted);
  onConvertedRef.current = onConverted;

  useEffect(() => {
    // Reset when the watched departure changes; a stale set would lock cabins
    // on the newly selected departure.
    setHeld(new Set());
    setConnected(false);
    if (!departureId) return;

    const socket = io(`${wsOrigin()}/rt`, {
      withCredentials: true,
      transports: ['websocket'],
    });
    socketRef.current = socket;

    const watch = () => socket.emit('watch:departure', { departureId });
    socket.on('connect', () => {
      setConnected(true);
      watch();
    });

    socket.on(
      'cabin',
      (msg: { departureId: string; cabinId: string; state: string }) => {
        if (msg.departureId !== departureId) return;
        setHeld((prev) => {
          const next = new Set(prev);
          // Only 'held' keeps a cabin locked; released/converted free the tile
          // (a converted cabin becomes a confirmed booking, surfaced separately
          // through the bookings read, so it must not linger in this set).
          if (msg.state === 'held') next.add(msg.cabinId);
          else next.delete(msg.cabinId);
          return next;
        });
        // A conversion means a new confirmed booking exists — tell the caller so
        // it can pull the bookings list and mark the cabin sold, not free.
        if (msg.state === 'converted') onConvertedRef.current?.();
      },
    );

    return () => {
      socket.emit('unwatch:departure', { departureId });
      socket.off('cabin');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [departureId]);

  return { held, connected };
}
