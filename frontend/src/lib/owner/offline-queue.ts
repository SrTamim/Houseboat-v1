/**
 * Offline capture queue for owner-console actions.
 *
 * When a boat has no signal, an eligible owner mutation is stored here instead
 * of hitting the network; sync-runner.ts flushes the queue to POST /sync/replay
 * once connectivity returns. Each row is shaped like the backend SyncIntentDto
 * (sync/dto/sync.dto.ts) so a pending row can be sent verbatim.
 *
 * Storage is IndexedDB (survives reloads, unlike memory), accessed through a
 * tiny promise wrapper — no external dependency. Every call is guarded so a
 * browser with IndexedDB blocked/absent degrades to "queue unavailable" rather
 * than throwing into the console UI.
 */

/** The actions the backend replay engine accepts (mirror of OFFLINE_ALLOWED). */
export type OfflineAction =
  | 'cost_add'
  | 'stock_movement'
  | 'mark_cash_paid'
  | 'mark_not_arrived'
  | 'date_change'
  | 'maintenance_request'
  | 'checkin_set';

export interface QueuedIntent {
  /** Client-generated UUID — idempotency key for replay. */
  intentId: string;
  houseboatId: string;
  action: OfflineAction;
  payload: Record<string, unknown>;
  /** ISO8601 device clock at capture time. */
  deviceTime: string;
  /** Local bookkeeping (never sent): when it was enqueued. */
  enqueuedAt: string;
}

const DB_NAME = 'houseboat-offline';
const DB_VERSION = 1;
const STORE = 'pending_intents';

/** Open (and lazily create) the database. Rejects if IndexedDB is unavailable. */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'intentId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

/** Run one transaction against the pending store, resolving with `result`. */
function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest | void,
  result: (store: IDBObjectStore) => T,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        let out: T;
        try {
          fn(store);
          out = result(store);
        } catch (e) {
          reject(e);
          return;
        }
        t.oncomplete = () => {
          db.close();
          resolve(out);
        };
        t.onerror = () => {
          db.close();
          reject(t.error ?? new Error('IndexedDB transaction failed'));
        };
      }),
  );
}

/** True when the browser can hold an offline queue at all. */
export function offlineQueueSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

/** Add an intent to the queue. Generates the intentId + timestamps. */
export async function enqueue(input: {
  houseboatId: string;
  action: OfflineAction;
  payload: Record<string, unknown>;
  /** Override the device time (tests); defaults to now. */
  deviceTime?: string;
}): Promise<QueuedIntent> {
  const now = new Date().toISOString();
  const row: QueuedIntent = {
    intentId:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    houseboatId: input.houseboatId,
    action: input.action,
    payload: input.payload,
    deviceTime: input.deviceTime ?? now,
    enqueuedAt: now,
  };
  await tx(
    'readwrite',
    (store) => store.put(row),
    () => undefined,
  );
  return row;
}

/** All pending rows, oldest first. Returns [] when the queue is unavailable. */
export async function listPending(): Promise<QueuedIntent[]> {
  try {
    const rows = await tx<QueuedIntent[]>(
      'readonly',
      () => undefined,
      (store) => {
        const acc: QueuedIntent[] = [];
        // getAll isn't universally available on old engines; use a cursor.
        store.openCursor().onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
          if (cursor) {
            acc.push(cursor.value as QueuedIntent);
            cursor.continue();
          }
        };
        return acc;
      },
    );
    return rows.sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt));
  } catch {
    return [];
  }
}

/** Remove rows by intentId (called after they are applied/duplicated). */
export async function remove(intentIds: string[]): Promise<void> {
  if (intentIds.length === 0) return;
  await tx(
    'readwrite',
    (store) => {
      for (const id of intentIds) store.delete(id);
    },
    () => undefined,
  );
}

/** Count of pending rows (0 when unavailable). */
export async function pendingCount(): Promise<number> {
  const rows = await listPending();
  return rows.length;
}
