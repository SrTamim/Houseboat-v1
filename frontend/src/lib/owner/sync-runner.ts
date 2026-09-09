/**
 * Flush the offline capture queue to the backend replay endpoint.
 *
 * Reads pending intents (offline-queue.ts), POSTs them in bounded batches to
 * POST /sync/replay, then reconciles each result:
 *   - applied / duplicate → the intent took effect (idempotent), so drop it;
 *   - unauthorized / conflict / error → keep it and surface it. The server has
 *     already logged conflicts as `sync_conflict` audit rows, which the sync
 *     page's "Conflicts" card shows.
 *
 * A double-send is safe: the server dedupes by intentId, so a network blip
 * mid-flush never double-applies.
 */
import { api } from '@/lib/api';
import { listPending, remove, type QueuedIntent } from './offline-queue';

/** Mirrors backend IntentResult (sync.service.ts). */
interface IntentResult {
  intentId: string;
  status: 'applied' | 'duplicate' | 'unauthorized' | 'conflict' | 'error';
  message?: string;
}

interface ReplayResponse {
  summary: string;
  results: IntentResult[];
}

export interface FlushOutcome {
  /** How many pending intents were sent this run. */
  sent: number;
  /** Applied or duplicated → removed from the queue. */
  cleared: number;
  /** Left in the queue (unauthorized / conflict / error). */
  kept: number;
  /** True when nothing could be sent (offline, or queue empty/unavailable). */
  skipped: boolean;
}

/** The server's per-request cap (SyncBatchDto @ArrayMaxSize). */
const BATCH_SIZE = 200;

/** Whether the browser currently reports a network connection. */
export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

/**
 * Send all pending intents. Safe to call repeatedly (it no-ops when offline or
 * empty). Returns a summary the caller can surface as a toast/status line.
 */
export async function flushQueue(): Promise<FlushOutcome> {
  if (!isOnline()) {
    return { sent: 0, cleared: 0, kept: 0, skipped: true };
  }

  const pending = await listPending();
  if (pending.length === 0) {
    return { sent: 0, cleared: 0, kept: 0, skipped: true };
  }

  let cleared = 0;
  let kept = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const intents = batch.map((row: QueuedIntent) => ({
      intentId: row.intentId,
      houseboatId: row.houseboatId,
      action: row.action,
      payload: row.payload,
      deviceTime: row.deviceTime,
    }));

    const { data } = await api.post<ReplayResponse>('/sync/replay', { intents });
    const byId = new Map(data.results.map((r) => [r.intentId, r.status]));

    const done: string[] = [];
    for (const row of batch) {
      const status = byId.get(row.intentId);
      if (status === 'applied' || status === 'duplicate') {
        done.push(row.intentId);
      } else {
        // unauthorized / conflict / error / missing → keep for review/retry.
        kept += 1;
      }
    }
    await remove(done);
    cleared += done.length;
  }

  return { sent: pending.length, cleared, kept, skipped: false };
}
