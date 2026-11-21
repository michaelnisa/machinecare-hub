import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../config/supabase";
import { colors, radii, spacing } from "../../theme";
import { Card } from "../../components/Card";
import { StatusBadge } from "../../components/StatusBadge";
import {
  Truck,
  QrCode,
  ClipboardCheck,
  Receipt,
  Radio,
  MapPin,
  Wallet,
  Gauge,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
} from "lucide-react-native";

interface DriverHomeScreenProps {
  onNavigate: (screen: string) => void;
}

export const DriverHomeScreen: React.FC<DriverHomeScreenProps> = ({ onNavigate }) => {
  const { driverVehicle, unpairDriverVehicle } = useAuth();
  const [activeTrip, setActiveTrip] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadActiveTrip = async () => {
    if (!driverVehicle?.vehicleId) {
      setActiveTrip(null);
      return;
    }

    try {
      const { data } = await supabase
        .from("trips")
        .select("*")
        .eq("machine_id", driverVehicle.vehicleId)
        .eq("status", "in_progress")
        .order("start_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        let meta: any = {};
        if (data.cargo_description?.startsWith("{")) {
          try {
            meta = JSON.parse(data.cargo_description);
          } catch {}
        }
        setActiveTrip({ ...data, meta });
      } else {
        setActiveTrip(null);
      }
    } catch (e) {
      console.warn("Failed to load active trip:", e);
    }
  };

  useEffect(() => {
    loadActiveTrip();
  }, [driverVehicle?.vehicleId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadActiveTrip();
    setRefreshing(false);
  };

  const poshoDays = activeTrip?.meta?.safari_float?.posho_days ?? 3;
  const poshoDaily = activeTrip?.meta?.safari_float?.daily_posho_rate ?? 30000;
  const poshoTotal = poshoDays * poshoDaily;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* 1. Coupled Truck Card */}
      {driverVehicle ? (
        <Card variant="highlight" style={styles.truckCard}>
          <View style={styles.truckHeader}>
            <View style={styles.truckLeft}>
              <View style={styles.truckIconCircle}>
                <Truck size={24} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.truckPlate}>{driverVehicle.plateNumber || driverVehicle.name}</Text>
                <Text style={styles.truckCode}>
                  ID: {driverVehicle.vehicleCode} · {driverVehicle.makeModel || "Commercial Prime Mover"}
                </Text>
              </View>
            </View>
            <StatusBadge status="running" label="COUPLED" />
          </View>

          {driverVehicle.linkedTrailerPlate && (
            <View style={styles.trailerRow}>
              <Text style={styles.trailerLabel}>Coupled Trailer:</Text>
              <Text style={styles.trailerValue}>{driverVehicle.linkedTrailerPlate}</Text>
            </View>
          )}

          <View style={styles.truckStatsRow}>
            <View style={styles.truckStatItem}>
              <Gauge size={14} color={colors.textMuted} />
              <Text style={styles.statLabel}>Odometer:</Text>
              <Text style={styles.statValue}>
                {driverVehicle.odometerKm ? `${driverVehicle.odometerKm.toLocaleString()} km` : "Synchronized"}
              </Text>
            </View>
            <TouchableOpacity onPress={unpairDriverVehicle} style={styles.unpairBtn}>
              <Text style={styles.unpairText}>Switch Truck</Text>
            </TouchableOpacity>
          </View>
        </Card>
      ) : (
        <TouchableOpacity
          style={styles.pairPromptCard}
          onPress={() => onNavigate("QrTruckSignIn")}
          activeOpacity={0.8}
        >
          <View style={styles.pairIconBox}>
            <QrCode size={32} color={colors.primary} />
          </View>
          <View style={styles.pairPromptTextContainer}>
            <Text style={styles.pairPromptTitle}>Scan Truck QR Code to Begin</Text>
            <Text style={styles.pairPromptSub}>
              Piga picha QR Code ya gari lililopo kwenye usukani au mlango ili kuanza kazi.
            </Text>
          </View>
          <ChevronRight size={20} color={colors.primary} />
        </TouchableOpacity>
      )}

      {/* 2. Active Trip Corridor Card */}
      {activeTrip ? (
        <Card style={styles.tripCard}>
          <View style={styles.tripHeader}>
            <View style={styles.tripTag}>
              <MapPin size={12} color={colors.blue} />
              <Text style={styles.tripTagText}>ACTIVE HIGHWAY TRIP</Text>
            </View>
            <StatusBadge status="in_progress" label="EN ROUTE" />
          </View>

          <Text style={styles.tripRoute}>
            {activeTrip.origin || "Dar es Salaam"} ➔ {activeTrip.destination || "Destination"}
          </Text>

          {activeTrip.meta?.client && (
            <Text style={styles.tripClient}>Client Consignor: {activeTrip.meta.client}</Text>
          )}

          {/* Posho & Float Strip */}
          <View style={styles.floatStrip}>
            <View style={styles.floatItem}>
              <Wallet size={16} color={colors.amber} />
              <View>
                <Text style={styles.floatLabel}>Safari Posho Allowance</Text>
                <Text style={styles.floatAmount}>
                  TZS {poshoTotal.toLocaleString()} ({poshoDays} Days)
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.receiptSnapShortcut}
              onPress={() => onNavigate("ReceiptSnapper")}
            >
              <Receipt size={14} color={colors.text} />
              <Text style={styles.receiptSnapText}>Snap Receipt</Text>
            </TouchableOpacity>
          </View>
        </Card>
      ) : null}

      {/* 3. Driver 4 Core Action Dock */}
      <Text style={styles.sectionHeader}>Daily Driver Operations (Huduma za Dereva)</Text>

      <View style={styles.actionGrid}>
        {/* Receipt Snapper */}
        <TouchableOpacity
          style={[styles.actionCard, { borderColor: colors.primary }]}
          onPress={() => onNavigate("ReceiptSnapper")}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconBox, { backgroundColor: colors.primarySoft }]}>
            <Receipt size={24} color={colors.primary} />
          </View>
          <Text style={styles.actionTitle}>Snap Road Receipt</Text>
          <Text style={styles.actionDesc}>
            Weka risiti ya mafuta, mizani (weighbridge), tozo, au faini papo hapo.
          </Text>
        </TouchableOpacity>

        {/* 60-Sec Walkaround Inspection */}
        <TouchableOpacity
          style={[styles.actionCard, { borderColor: colors.blue }]}
          onPress={() => onNavigate("PreStartInspection")}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconBox, { backgroundColor: colors.blueSoft }]}>
            <ClipboardCheck size={24} color={colors.blue} />
          </View>
          <Text style={styles.actionTitle}>60-Sec Inspection</Text>
          <Text style={styles.actionDesc}>
            Ukaguzi wa tairi, breki, taa, na mafuta kabla ya kuwasha gari.
          </Text>
        </TouchableOpacity>

        {/* Pair / Switch Truck QR */}
        <TouchableOpacity
          style={[styles.actionCard, { borderColor: colors.purple }]}
          onPress={() => onNavigate("QrTruckSignIn")}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconBox, { backgroundColor: colors.purpleSoft }]}>
            <QrCode size={24} color={colors.purple} />
          </View>
          <Text style={styles.actionTitle}>QR Truck Coupling</Text>
          <Text style={styles.actionDesc}>
            Scan QR code ya gari au trela unaloliendesha leo.
          </Text>
        </TouchableOpacity>

        {/* Roadside Emergency SOS */}
        <TouchableOpacity
          style={[styles.actionCard, { borderColor: colors.rose, backgroundColor: colors.roseSoft }]}
          onPress={() => onNavigate("RoadsideSos")}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconBox, { backgroundColor: colors.rose }]}>
            <Radio size={24} color="#FFF" />
          </View>
          <Text style={[styles.actionTitle, { color: colors.rose }]}>Roadside Emergency SOS</Text>
          <Text style={styles.actionDesc}>
            Uharibifu barabarani? Bonyeza hapa kutuma GPS location kwa karakana mara moja.
          </Text>
        </TouchableOpacity>
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
    padding: spacing.lg,
    paddingBottom: spacing.xxxl * 2,
    gap: spacing.lg,
  },
  truckCard: {
    padding: spacing.lg,
  },
  truckHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  truckLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  truckIconCircle: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  truckPlate: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: -0.3,
  },
  truckCode: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  trailerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.cardSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.md,
    marginTop: spacing.md,
  },
  trailerLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  trailerValue: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  truckStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  truckStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  statValue: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  unpairBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: colors.border,
  },
  unpairText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "600",
  },
  pairPromptCard: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  pairIconBox: {
    width: 54,
    height: 54,
    borderRadius: radii.lg,
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  pairPromptTextContainer: {
    flex: 1,
  },
  pairPromptTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  pairPromptSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },
  tripCard: {
    backgroundColor: colors.cardSecondary,
    borderLeftWidth: 4,
    borderLeftColor: colors.blue,
  },
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tripTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tripTagText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.blue,
    letterSpacing: 0.5,
  },
  tripRoute: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.text,
    marginTop: spacing.sm,
  },
  tripClient: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  floatStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.borderLight,
  },
  floatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  floatLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  floatAmount: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.amber,
  },
  receiptSnapShortcut: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.md,
  },
  receiptSnapText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
  actionGrid: {
    gap: spacing.md,
  },
  actionCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1.5,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  actionDesc: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },
});
