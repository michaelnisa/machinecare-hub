import { createStore, get, set, del, keys, type UseStore } from "idb-keyval";
import { useCallback, useEffect, useState } from "react";

export type QueuedOpKind =
  | "pre_start_inspection"
  | "checklist_response_update"
  | "checklist_complete"
  | "fault_report"
  | "safety_incident"
  | "induction_complete";

export interface QueuedOp<TPayload = unknown> {
  id: string;
  kind: QueuedOpKind;
  payload: TPayload;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

let store: UseStore | null = null;
function getStore(): UseStore {
  if (!store) store = createStore("machinecare-offline", "queue");
  return store;
}

export async function enqueue<TPayload>(kind: QueuedOpKind, payload: TPayload): Promise<string> {
  const op: QueuedOp<TPayload> = {
    id: crypto.randomUUID(),
    kind,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  await set(op.id, op, getStore());
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("mc-offline-queue-changed"));
  }
  return op.id;
}

export async function listPending(): Promise<QueuedOp[]> {
  const s = getStore();
  const ids = await keys(s);
  const ops: QueuedOp[] = [];
  for (const id of ids) {
    const op = await get<QueuedOp>(id as string, s);
    if (op) ops.push(op);
  }
  return ops.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeOp(id: string): Promise<void> {
  await del(id, getStore());
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("mc-offline-queue-changed"));
  }
}

/**
 * Extracts a human-readable message from anything a failed request might
 * throw or resolve with. Deliberately does NOT gate on `instanceof Error`:
 * supabase-js's postgrest-js wraps fetch-level failures (DNS errors, dropped
 * connections, timeouts — exactly the flaky-signal conditions this queue
 * exists for) in a plain `{ message, details, hint, code }` object, not an
 * Error instance, so an `instanceof Error` check silently falls through to
 * "unknown error" on precisely the failures that should be recognized as
 * offline. See @supabase/postgrest-js PostgrestBuilder's own comment on this.
 */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  const message = (err as { message?: unknown })?.message;
  return typeof message === "string" && message ? message : (err ? String(err) : fallback);
}

async function markFailed(op: QueuedOp, err: unknown): Promise<void> {
  const updated: QueuedOp = {
    ...op,
    attempts: op.attempts + 1,
    lastError: errorMessage(err),
  };
  await set(op.id, updated, getStore());
}

const NETWORK_ERROR_REGEX =
  /fetch|network|offline|load failed|internet|err_internet_disconnected|err_name_not_resolved|err_connection_refused|err_connection_reset|err_connection_timed_out|err_network_changed|err_address_unreachable|failed to fetch dynamically imported module|aborted|pgrst301/i;

/**
 * Checks whether an error or system state indicates network disconnection or fetch failure.
 */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (err instanceof TypeError) return true;
  const msg = errorMessage(err, "");
  return NETWORK_ERROR_REGEX.test(msg);
}

/**
 * Backward-compatible alias for isNetworkError.
 */
export const looksOffline = isNetworkError;

export type FlushHandlers = Partial<Record<QueuedOpKind, (payload: any) => Promise<void>>>;

export async function flushAll(handlers: FlushHandlers): Promise<{ succeeded: string[]; failed: string[] }> {
  const succeeded: string[] = [];
  const failed: string[] = [];
  if (typeof navigator !== "undefined" && !navigator.onLine) return { succeeded, failed };

  const ops = await listPending();
  for (const op of ops) {
    const handler = handlers[op.kind];
    if (!handler) continue;
    try {
      await handler(op.payload);
      await removeOp(op.id);
      succeeded.push(op.id);
    } catch (err) {
      await markFailed(op, err);
      failed.push(op.id);
    }
  }
  if (succeeded.length > 0 && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("mc-offline-queue-changed"));
  }
  return { succeeded, failed };
}

/**
 * Reactive hook providing real-time device connection state.
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline, wasOffline, setWasOffline };
}

/** Tracks queue size and auto-flushes on reconnect / a periodic interval while items are pending. */
export function useOfflineQueue(handlers: FlushHandlers) {
  const [pendingCount, setPendingCount] = useState(0);

  const refreshCount = useCallback(async () => {
    const ops = await listPending();
    setPendingCount(ops.length);
  }, []);

  const flushNow = useCallback(async () => {
    const res = await flushAll(handlers);
    await refreshCount();
    return res;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshCount]);

  useEffect(() => {
    refreshCount();
    flushNow();

    const onOnline = () => flushNow();
    const onQueueChange = () => refreshCount();

    window.addEventListener("online", onOnline);
    window.addEventListener("mc-offline-queue-changed", onQueueChange);

    const interval = setInterval(() => {
      if (typeof navigator !== "undefined" && navigator.onLine) flushNow();
    }, 20000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("mc-offline-queue-changed", onQueueChange);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { pendingCount, flushNow, refreshCount };
}
