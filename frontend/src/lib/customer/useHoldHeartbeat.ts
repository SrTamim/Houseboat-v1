'use client';

import { useEffect } from 'react';
import { api } from '@/lib/api';

/** How often the page reports in. Server grace is 2 min (HOLD_GRACE_MIN). */
const HEARTBEAT_MS = 30_000;

/**
 * Tell the server this page is still open, so its cabin holds are not reclaimed.
 *
 * The server frees a hold whose heartbeat has been quiet for ~2 minutes. That
 * replaces releasing on `pagehide`/`sendBeacon`, which could not be trusted:
 * mobile browsers routinely skip unload events, and `sendBeacon` cannot set the
 * CSRF header this API requires — so a closed tab used to sit on its cabins for
 * the full 10–20 minute TTL.
 *
 * Presence asserted by the living page rather than inferred from a dying one, so
 * a dropped signal fails safe: the cabin returns to inventory instead of being
 * stranded.
 *
 * Does NOT extend the hold. The 10-minute deadline is unaffected — a parked tab
 * still expires on time; this only stops an *early* reclaim.
 *
 * @param departureId departure whose holds to keep alive, or null to do nothing
 * @param active      true while this page actually holds cabins
 */
export function useHoldHeartbeat(
  departureId: string | null | undefined,
  active: boolean,
): void {
  useEffect(() => {
    if (!departureId || !active) return;

    let cancelled = false;
    const ping = () => {
      if (cancelled) return;
      // Fire-and-forget: a failed beat is not worth surfacing, and the next one
      // is 30s away. Losing several in a row is exactly the case the server's
      // grace window is meant to resolve.
      void api
        .post(`/booking/departures/${departureId}/heartbeat`)
        .catch(() => {});
    };

    // Stamp immediately so a hold taken seconds ago is not judged on a heartbeat
    // it never had a chance to send.
    ping();
    const id = setInterval(ping, HEARTBEAT_MS);

    // Coming back to a backgrounded tab: browsers throttle timers to about once
    // a minute when hidden, so re-assert presence at once rather than waiting
    // out an interval that may have been stretched.
    const onVisible = () => {
      if (document.visibilityState === 'visible') ping();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [departureId, active]);
}
