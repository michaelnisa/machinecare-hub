import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useAuth } from "../context/AuthContext";
import { colors, radii, spacing } from "../theme";
import { Users, Truck, Wrench, Navigation, Radio } from "lucide-react-native";

interface HeaderProps {
  title?: string;
  onSwitchRolePress?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, onSwitchRolePress }) => {
  const { role } = useAuth();

  const getRoleMeta = () => {
    switch (role) {
      case "driver":
        return { label: "DRIVER", icon: Truck, color: colors.primary };
      case "mechanic":
        return { label: "GARAGE", icon: Wrench, color: colors.blue };
      case "dispatcher":
        return { label: "DISPATCH", icon: Navigation, color: colors.purple };
      case "telematics":
        return { label: "GPS TECH", icon: Radio, color: colors.amber };
      default:
        return { label: "FIELD", icon: Users, color: colors.textMuted };
    }
  };

  const meta = getRoleMeta();
  const IconComp = meta.icon;

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.brandTitle}>MachineCare Hub</Text>
        {title ? (
          <Text style={styles.subTitle}>{title}</Text>
        ) : (
          <Text style={styles.subTitle}>Field Operations Portal</Text>
        )}
      </View>

      <TouchableOpacity
        onPress={onSwitchRolePress}
        style={[styles.roleBadge, { borderColor: meta.color + "55" }]}
      >
        <IconComp size={14} color={meta.color} />
        <Text style={[styles.roleText, { color: meta.color }]}>{meta.label}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: -0.3,
  },
  subTitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  roleText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
