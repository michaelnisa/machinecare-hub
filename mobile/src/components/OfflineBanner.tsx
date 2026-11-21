import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useOfflineSync } from "../context/OfflineSyncContext";
import { colors, radii, spacing } from "../theme";
import { RefreshCw, CloudOff } from "lucide-react-native";

export const OfflineBanner: React.FC = () => {
  const { pendingCount, isSyncing, triggerSync } = useOfflineSync();

  if (pendingCount === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <CloudOff size={16} color={colors.amber} />
        <Text style={styles.text}>
          {pendingCount} offline item{pendingCount > 1 ? "s" : ""} queued for sync
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => triggerSync()}
        disabled={isSyncing}
        style={styles.syncBtn}
      >
        <RefreshCw size={14} color={colors.text} />
        <Text style={styles.syncText}>{isSyncing ? "Syncing..." : "Sync Now"}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardSecondary,
    borderBottomWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  text: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "500",
  },
  syncBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  syncText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "600",
  },
});
