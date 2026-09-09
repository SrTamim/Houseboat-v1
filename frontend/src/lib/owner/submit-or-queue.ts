/**
 * Bridge an owner mutation to the offline capture queue.
 *
 * Console pages call the network exactly as before, wrapped in `submitOrQueue`.
 * On a genuine transport failure (the device is offline) the mapped intent is
 * stored in the IndexedDB queue (offline-queue.ts) instead of being lost, and
 * sync-runner.ts replays it once connectivity returns. A real HTTP error (the
 * server answered 4xx/5xx) is rethrown unchanged, so existing validation/CSRF
 * handling in each page's catch is untouched.
 *
 * Only the actions the backend replay engine accepts are queueable — the caller
 * supplies the intent, so it is responsible for passing a replayable action +
 * payload (see backend sync/dto/sync.dto.ts OFFLINE_ALLOWED).
 */
import { AxiosError } from 'axios';
import {
  enqueue,
  offlineQueueSupported,
  type OfflineAction,
  type QueuedIntent,
} from './offline-queue';
import { isOnline } from './sync-runner';

export interface OfflineIntent {
  houseboatId: string;
  action: OfflineAction;
  payload: Record<string, unknown>;
  /** Override the device time (tests); defaults to now in enqueue(). */
  deviceTime?: string;
}

export type SubmitResult<T> =
  | { status: 'sent'; data: T }
  | { status: 'queued'; intent: QueuedIntent };

/**
 * Thrown when the device is offline but cannot hold a queue (IndexedDB blocked
 * or absent). The action would otherwise be silently dropped, so we surface it
 * through the caller's existing catch instead. `offlineUnavailable` lets a page
 * show tailored copy via isOfflineUnavailable().
 */
export class OfflineUnavailableError extends Error {
  readonly offlineUnavailable = true;
  constructor() {
    super(
      'You appear to be offline and this device can’t save the action to sync later.',
    );
    this.name = 'OfflineUnavailableError';
  }
}

export function isOfflineUnavailable(e: unknown): boolean {
  return Boolean((e as { offlineUnavailable?: boolean })?.offlineUnavailable);
}

/**
 * A transport failure: the request left the browser but no server response
 * arrived (offline, DNS, connection reset). Distinct from an HTTP error, which
 * carries a `response`. Axios sets `code === 'ERR_NETWORK'` here.
 */
function isNetworkError(err: unknown): boolean {
  if (err instanceof AxiosError) return Boolean(err.request) && !err.response;
  const e = err as { request?: unknown; response?: unknown };
  return Boolean(e?.request) && !e?.response;
}

/**
 * Run the online call; capture to the offline queue on network failure.
 *
 * @param online the exact api.* call the page already makes (a thunk).
 * @param intent what to queue if the call can't reach the server.
 */
export async function submitOrQueue<T>(
  online: () => Promise<T>,
  intent: OfflineIntent,
): Promise<SubmitResult<T>> {
  // Fast path: the browser already knows it's offline — don't fire a doomed
  // request (which would also spin the 401-refresh interceptor on a stall).
  if (!isOnline()) return queueOrThrow(intent);
  try {
    return { status: 'sent', data: await online() };
  } catch (err) {
    if (isNetworkError(err)) return queueOrThrow(intent);
    // A real server answer (validation, CSRF, conflict…) — let the caller's
    // existing catch surface it exactly as before.
    throw err;
  }
}

async function queueOrThrow<T>(
  intent: OfflineIntent,
): Promise<SubmitResult<T>> {
  if (!offlineQueueSupported()) throw new OfflineUnavailableError();
  return { status: 'queued', intent: await enqueue(intent) };
}
