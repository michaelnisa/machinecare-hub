import { createStore, get, set, del, keys, type UseStore } from "idb-keyval";
import { useCallback, useEffect, useState } from "react";

export type QueuedOpKind =
  | "pre_start_inspection"
  | "checklist_response_update"
  | "checklist_complete";

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
}

async function markFailed(op: QueuedOp, err: unknown): Promise<void> {
  const updated: QueuedOp = {
    ...op,
    attempts: op.attempts + 1,
    lastError: err instanceof Error ? err.message : String(err),
  };
  await set(op.id, updated, getStore());
}

/**
 * Whether a failure looks network-related (vs. a real validation/permission
 * error). We deliberately err toward "queue it" — losing a filled-out
 * inspection is worse than an unnecessary local save that syncs immediately.
 */
export function looksOffline(err: unknown): boolean {
  if (!navigator.onLine) return true;
  if (err instanceof TypeError) return true; // "Failed to fetch" etc.
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /fetch|network|offline/i.test(message);
}

export type FlushHandlers = Partial<Record<QueuedOpKind, (payload: any) => Promise<void>>>;

export async function flushAll(handlers: FlushHandlers): Promise<{ succeeded: string[]; failed: string[] }> {
  const succeeded: string[] = [];
  const failed: string[] = [];
  if (!navigator.onLine) return { succeeded, failed };

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
  return { succeeded, failed };
}

/** Tracks queue size and auto-flushes on reconnect / a periodic interval while items are pending. */
export function useOfflineQueue(handlers: FlushHandlers) {
  const [pendingCount, setPendingCount] = useState(0);

  const refreshCount = useCallback(async () => {
    const ops = await listPending();
    setPendingCount(ops.length);
  }, []);

  const flushNow = useCallback(async () => {
    await flushAll(handlers);
    await refreshCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshCount]);

  useEffect(() => {
    refreshCount();
    flushNow();

    const onOnline = () => flushNow();
    window.addEventListener("online", onOnline);

    const interval = setInterval(() => {
      if (navigator.onLine) flushNow();
    }, 20000);

    return () => {
      window.removeEventListener("online", onOnline);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { pendingCount, flushNow, refreshCount };
}
