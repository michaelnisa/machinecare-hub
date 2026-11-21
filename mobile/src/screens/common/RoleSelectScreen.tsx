import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { colors, radii, spacing } from "../../theme";
import { MobileRole } from "../../services/storageService";
import { Truck, Wrench, Navigation, Radio, ArrowRight, ShieldCheck } from "lucide-react-native";

interface RoleSelectScreenProps {
  onRoleSelected?: () => void;
}

export const RoleSelectScreen: React.FC<RoleSelectScreenProps> = ({ onRoleSelected }) => {
  const { role, switchRole } = useAuth();

  const roles: {
    id: MobileRole;
    title: string;
    swahili: string;
    description: string;
    icon: any;
    color: string;
    bg: string;
  }[] = [
    {
      id: "driver",
      title: "Commercial Fleet Driver",
      swahili: "Dereva wa Safari & Malori",
      description: "1-Tap QR truck coupling, 60s walkaround inspection, snap road cash receipts & SOS beacon.",
      icon: Truck,
      color: colors.primary,
      bg: colors.primarySoft,
    },
    {
      id: "mechanic",
      title: "Garage & Workshop Mechanic",
      swahili: "Fundi Karakana & Matengenezo",
      description: "Digital Job Cards, spare parts requisitions, vehicle QR history & rapid defect intake.",
      icon: Wrench,
      color: colors.blue,
      bg: colors.blueSoft,
    },
    {
      id: "dispatcher",
      title: "Fleet & Logistics Dispatcher",
      swahili: "Msimamizi wa Safari & Magari",
      description: "Live GPS fleet map, trip dispatch milestones, route ETAs & quick fuel log entry.",
      icon: Navigation,
      color: colors.purple,
      bg: colors.purpleSoft,
    },
    {
      id: "telematics",
      title: "GPS & Telematics Technician",
      swahili: "Fundi wa Ufungaji GPS",
      description: "Barcode IMEI scanner, vehicle binding, satellite fix diagnostics & ignition wire test.",
      icon: Radio,
      color: colors.amber,
      bg: colors.amberSoft,
    },
  ];

  const handleSelect = async (r: MobileRole) => {
    await switchRole(r);
    if (onRoleSelected) onRoleSelected();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.brandBadge}>
          <ShieldCheck size={16} color={colors.primary} />
          <Text style={styles.brandBadgeText}>MachineCare Field Suite</Text>
        </View>
        <Text style={styles.title}>Select Your Field Role</Text>
        <Text style={styles.subtitle}>
          Choose your active operational mode. You can switch between roles at any time.
        </Text>
      </View>

      <View style={styles.cardsContainer}>
        {roles.map((item) => {
          const isSelected = role === item.id;
          const IconComp = item.icon;

          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.card,
                isSelected && { borderColor: item.color, backgroundColor: colors.cardSecondary },
              ]}
              onPress={() => handleSelect(item.id)}
              activeOpacity={0.8}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconBox, { backgroundColor: item.bg }]}>
                  <IconComp size={22} color={item.color} />
                </View>
                {isSelected && (
                  <View style={[styles.activePill, { backgroundColor: item.bg }]}>
                    <Text style={[styles.activePillText, { color: item.color }]}>ACTIVE</Text>
                  </View>
                )}
              </View>

              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSwahili}>{item.swahili}</Text>
              <Text style={styles.cardDesc}>{item.description}</Text>

              <View style={styles.cardFooter}>
                <Text style={[styles.actionText, { color: item.color }]}>
                  {isSelected ? "Continue into Portal" : "Switch to this Mode"}
                </Text>
                <ArrowRight size={16} color={item.color} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl * 2,
  },
  header: {
    marginBottom: spacing.xxl,
  },
  brandBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radii.full,
    alignSelf: "flex-start",
    marginBottom: spacing.md,
  },
  brandBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  cardsContainer: {
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    justifyContent: "center",
    alignItems: "center",
  },
  activePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  cardSwahili: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
    marginTop: 2,
  },
  cardDesc: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.borderLight,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
