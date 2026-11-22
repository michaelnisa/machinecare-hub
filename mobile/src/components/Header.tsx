import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useAuth } from "../context/AuthContext";
import { colors, radii, spacing } from "../theme";
import { Users, Truck, Wrench, Navigation, Radio, LogIn, LogOut, Building2 } from "lucide-react-native";

interface HeaderProps {
  title?: string;
  onSwitchRolePress?: () => void;
  onOpenLogin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, onSwitchRolePress, onOpenLogin }) => {
  const { role, user, organisation, signOut } = useAuth();

  const handleSignOutPress = () => {
    Alert.alert(
      "Ondoka Kwenye Akaunti (Sign Out)",
      `Je, una uhakika unataka kuondoka kwenye akaunti ya ${organisation?.name || "MachineCare"}?`,
      [
        { text: "Hapana (Cancel)", style: "cancel" },
        {
          text: "Ndio, Ondoka",
          style: "destructive",
          onPress: signOut,
        },
      ]
    );
  };

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

  const orgLabel = organisation?.name || (user ? "Connected" : "Field QR Mode");

  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }}>
        <Text style={styles.brandTitle}>MachineCare Hub</Text>
        <View style={styles.orgRow}>
          <Building2 size={11} color={colors.primary} />
          <Text style={styles.orgText} numberOfLines={1}>
            {orgLabel}
          </Text>
        </View>
      </View>

      <View style={styles.rightDock}>
        <TouchableOpacity
          onPress={onSwitchRolePress}
          style={[styles.roleBadge, { borderColor: meta.color + "55" }]}
          activeOpacity={0.8}
        >
          <IconComp size={13} color={meta.color} />
          <Text style={[styles.roleText, { color: meta.color }]}>{meta.label}</Text>
        </TouchableOpacity>

        {user ? (
          <TouchableOpacity
            style={styles.authBtn}
            onPress={handleSignOutPress}
            activeOpacity={0.7}
          >
            <LogOut size={14} color={colors.rose} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.authBtn}
            onPress={onOpenLogin}
            activeOpacity={0.7}
          >
            <LogIn size={14} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: 0.3,
  },
  orgRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  orgText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "600",
  },
  rightDock: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.background,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  roleText: {
    fontSize: 10,
    fontWeight: "800",
  },
  authBtn: {
    padding: 6,
    borderRadius: radii.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
