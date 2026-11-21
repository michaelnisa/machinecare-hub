import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radii, spacing } from "../theme";

interface StatusBadgeProps {
  status: string;
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const norm = (status || "").toLowerCase().trim();

  let bg = colors.border;
  let fg = colors.textMuted;
  let text = label || status;

  if (norm === "running" || norm === "active" || norm === "operational" || norm === "completed" || norm === "ok") {
    bg = colors.primarySoft;
    fg = colors.primary;
  } else if (norm === "idle" || norm === "in_progress" || norm === "loading" || norm === "en_route" || norm === "pending") {
    bg = colors.blueSoft;
    fg = colors.blue;
  } else if (norm === "stopped" || norm === "waiting_parts" || norm === "breakdown" || norm === "due_soon") {
    bg = colors.amberSoft;
    fg = colors.amber;
  } else if (norm === "inactive" || norm === "emergency" || norm === "overdue" || norm === "failed") {
    bg = colors.roseSoft;
    fg = colors.rose;
  }

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{text.toUpperCase()}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
