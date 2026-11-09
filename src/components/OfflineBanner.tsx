import React, { useState, useEffect } from "react";
import { WifiOff, CheckCircle2, RefreshCw, X } from "lucide-react";
import { useNetworkStatus } from "@/lib/offlineQueue";
import { Button } from "@/components/ui/button";

interface OfflineBannerProps {
  pendingCount?: number;
  isSyncing?: boolean;
  onSyncNow?: () => void;
}

export function OfflineBanner({ pendingCount = 0, isSyncing = false, onSyncNow }: OfflineBannerProps) {
  const { isOnline, wasOffline, setWasOffline } = useNetworkStatus();
  const [dismissed, setDismissed] = useState(false);
  const [showRestoredNotice, setShowRestoredNotice] = useState(false);

  // When connection transitions from offline to online
  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowRestoredNotice(true);
      const timer = setTimeout(() => {
        setShowRestoredNotice(false);
        setWasOffline(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline, setWasOffline]);

  // Reset dismissal when going offline again
  useEffect(() => {
    if (!isOnline) {
      setDismissed(false);
    }
  }, [isOnline]);

  if (isOnline && !showRestoredNotice) {
    return null;
  }

  if (dismissed && !showRestoredNotice) {
    // Show a minimal floating pill badge in corner when banner is collapsed
    return (
      <aside aria-label="Offline status" className="fixed bottom-4 left-4 z-50 animate-in fade-in slide-in-from-bottom-2">
        <button
          onClick={() => setDismissed(false)}
          className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-950/90 px-3 py-1.5 text-xs font-medium text-amber-200 shadow-lg backdrop-blur hover:bg-amber-900/90 transition-colors"
          title="Click to view offline status details"
        >
          <WifiOff className="h-3.5 w-3.5 animate-pulse text-amber-400" />
          <span>Offline</span>
          {pendingCount > 0 && (
            <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-semibold text-amber-300">
              {pendingCount}
            </span>
          )}
        </button>
      </aside>
    );
  }

  return (
    <aside aria-label="Network status banner" className="sticky top-0 z-50 w-full transition-all duration-300">
      {showRestoredNotice ? (
        <div className="flex items-center justify-between border-b border-emerald-500/30 bg-emerald-950/95 px-4 py-2.5 text-emerald-100 shadow-md backdrop-blur">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Connection restored. System is syncing your saved changes...</span>
          </div>
          <button
            onClick={() => setShowRestoredNotice(false)}
            className="rounded p-1 text-emerald-400 hover:bg-emerald-800/40 hover:text-emerald-200 transition-colors"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/40 bg-amber-950/95 px-4 py-2.5 text-amber-100 shadow-md backdrop-blur">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm">
            <WifiOff className="h-4 w-4 text-amber-400 shrink-0 animate-pulse" />
            <div>
              <span className="font-semibold text-amber-300">You are offline:</span>{" "}
              <span className="text-amber-200/90">
                Data is saved locally and will sync automatically when your internet connection is restored.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {pendingCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
                {pendingCount} {pendingCount === 1 ? "action" : "actions"} pending
              </span>
            )}

            {onSyncNow && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSyncNow}
                disabled={!isOnline || isSyncing}
                className="h-7 text-xs border-amber-500/40 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200"
              >
                {isSyncing ? "Syncing..." : "Sync Now"}
              </Button>
            )}

            <button
              onClick={() => setDismissed(true)}
              className="rounded p-1 text-amber-400 hover:bg-amber-900/50 hover:text-amber-200 transition-colors"
              aria-label="Collapse banner"
              title="Minimize offline banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
