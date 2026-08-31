import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  errorMessage,
  looksOffline,
  enqueue,
  listPending,
  removeOp,
  flushAll,
} from "./offlineQueue";

const memStore = new Map<string, any>();

vi.mock("idb-keyval", () => ({
  createStore: vi.fn(() => ({})),
  get: vi.fn(async (key: string) => memStore.get(key)),
  set: vi.fn(async (key: string, val: any) => {
    memStore.set(key, val);
  }),
  del: vi.fn(async (key: string) => {
    memStore.delete(key);
  }),
  keys: vi.fn(async () => Array.from(memStore.keys())),
}));

describe("offlineQueue", () => {
  beforeEach(() => {
    memStore.clear();
  });

  describe("errorMessage", () => {
    it("extracts message from Error object or string or postgrest object", () => {
      expect(errorMessage(new Error("Disk full"))).toBe("Disk full");
      expect(errorMessage("Connection dropped")).toBe("Connection dropped");
      expect(errorMessage({ message: "Network error occurred" })).toBe("Network error occurred");
      expect(errorMessage(null, "Default error")).toBe("Default error");
    });
  });

  describe("looksOffline", () => {
    it("identifies network and fetch errors as offline", () => {
      expect(looksOffline(new TypeError("Failed to fetch"))).toBe(true);
      expect(looksOffline({ message: "Network connection lost" })).toBe(true);
      expect(looksOffline({ message: "offline status" })).toBe(true);
      expect(looksOffline({ message: "Validation error: name required" })).toBe(false);
    });
  });

  describe("queue operations", () => {
    it("enqueues, lists, and removes operations", async () => {
      const id = await enqueue("fault_report", { description: "Hydraulic pump leak" });
      expect(id).toBeDefined();

      const pending = await listPending();
      expect(pending.length).toBe(1);
      expect(pending[0].kind).toBe("fault_report");
      expect((pending[0].payload as any).description).toBe("Hydraulic pump leak");

      await removeOp(id);
      const afterRemove = await listPending();
      expect(afterRemove.length).toBe(0);
    });

    it("flushes queue operations with handlers", async () => {
      await enqueue("fault_report", { id: "fr-1" });
      await enqueue("safety_incident", { id: "si-1" });

      const handledFaults: any[] = [];
      const handledSafety: any[] = [];

      const result = await flushAll({
        fault_report: async (payload) => {
          handledFaults.push(payload);
        },
        safety_incident: async (payload) => {
          handledSafety.push(payload);
        },
      });

      expect(result.succeeded.length).toBe(2);
      expect(result.failed.length).toBe(0);
      expect(handledFaults.length).toBe(1);
      expect(handledSafety.length).toBe(1);

      const pending = await listPending();
      expect(pending.length).toBe(0);
    });
  });
});
