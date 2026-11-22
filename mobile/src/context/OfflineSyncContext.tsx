import React, { createContext, useContext, useEffect, useState } from "react";
import { storageService, OfflineReceiptItem } from "../services/storageService";
import { syncEngine, SyncResult } from "../services/syncEngine";

interface OfflineSyncContextType {
  isSyncing: boolean;
  pendingCount: number;
  triggerSync: () => Promise<SyncResult>;
  queueReceipt: (item: OfflineReceiptItem) => Promise<void>;
  queueInspection: (item: any) => Promise<void>;
  refreshPendingCount: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextType>({
  isSyncing: false,
  pendingCount: 0,
  triggerSync: async () => ({
    receiptsSynced: 0,
    inspectionsSynced: 0,
    downtimesSynced: 0,
    scrapsSynced: 0,
    errors: [],
  }),
  queueReceipt: async () => {},
  queueInspection: async () => {},
  refreshPendingCount: async () => {},
});

export const OfflineSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = async () => {
    const [receipts, inspections, downtimes, scraps] = await Promise.all([
      storageService.getOfflineReceipts(),
      storageService.getOfflineInspections(),
      storageService.getOfflineDowntimes(),
      storageService.getOfflineScraps(),
    ]);
    setPendingCount(receipts.length + inspections.length + downtimes.length + scraps.length);
  };

  useEffect(() => {
    refreshPendingCount();

    // Auto sync on mount and every 30 seconds
    const interval = setInterval(() => {
      triggerSync();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const triggerSync = async (): Promise<SyncResult> => {
    setIsSyncing(true);
    try {
      const res = await syncEngine.syncAll();
      await refreshPendingCount();
      return res;
    } finally {
      setIsSyncing(false);
    }
  };

  const queueReceipt = async (item: OfflineReceiptItem) => {
    await storageService.queueOfflineReceipt(item);
    await refreshPendingCount();
    // Attempt immediate background sync
    triggerSync().catch(() => {});
  };

  const queueInspection = async (item: any) => {
    await storageService.queueOfflineInspection(item);
    await refreshPendingCount();
    triggerSync().catch(() => {});
  };

  return (
    <OfflineSyncContext.Provider
      value={{
        isSyncing,
        pendingCount,
        triggerSync,
        queueReceipt,
        queueInspection,
        refreshPendingCount,
      }}
    >
      {children}
    </OfflineSyncContext.Provider>
  );
};

export const useOfflineSync = () => useContext(OfflineSyncContext);
